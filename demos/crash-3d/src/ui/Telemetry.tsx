import { useEffect, useRef } from 'react'
import { COUNTDOWN_S } from '../core/config'
import { telemetry } from '../core/telemetry'
import type { RoundSnapshot } from '../core/types'
import { onSnap, useGame } from '../game/store'
import { formatAlt, formatClock, formatVel } from './format'

// the clock holds at T-3 while betting, counts down, then runs from liftoff
function clockOf(snap: RoundSnapshot): string {
  if (snap.phase === 'betting') return formatClock(-COUNTDOWN_S)
  if (snap.phase === 'countdown') return formatClock(-snap.countdown)
  return formatClock(snap.t)
}

// broadcast telemetry line plus the camera label from the director
export function Telemetry() {
  const camLabel = useGame((s) => s.camLabel)
  const clock = useRef<HTMLSpanElement>(null)
  const alt = useRef<HTMLSpanElement>(null)
  const vel = useRef<HTMLSpanElement>(null)

  useEffect(() => {
    const els = [clock, alt, vel]
    const last = ['', '', '']
    return onSnap((snap) => {
      const tel = telemetry(snap.multiplier)
      const next = [clockOf(snap), formatAlt(tel.altKm), formatVel(tel.velKmS)]
      for (let i = 0; i < 3; i++) {
        const el = els[i].current
        if (!el || next[i] === last[i]) continue
        last[i] = next[i]
        el.textContent = next[i]
      }
    })
  }, [])

  return (
    <>
      <div className="hud-telemetry">
        <span ref={clock} className="tel-clock" />
        <span ref={alt} />
        <span ref={vel} />
      </div>
      {camLabel && <div className="hud-cam">{camLabel}</div>}
    </>
  )
}
