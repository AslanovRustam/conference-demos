import { useEffect, useRef } from 'react'
import { stageFloat } from '../core/stages'
import { onSnap } from '../game/store'
import { S } from '../strings'

const TICKS = [0, 1, 2, 3, 4, 5, 6]

// thin altitude rail on the right edge; the red marker rides at stageFloat / 6
export function AltitudeScale() {
  const carriage = useRef<HTMLDivElement>(null)
  const fill = useRef<HTMLDivElement>(null)

  useEffect(() => {
    let last = -1
    return onSnap((snap) => {
      const p = Math.min(1, Math.max(0, stageFloat(Math.max(1, snap.multiplier)) / 6))
      const q = Math.round(p * 2000) / 2000
      if (q === last || !carriage.current || !fill.current) return
      last = q
      carriage.current.style.transform = `translateY(${(-q * 100).toFixed(3)}%)`
      fill.current.style.transform = `scaleY(${q.toFixed(4)})`
    })
  }, [])

  return (
    <div className="hud-alt" role="img" aria-label={S.aria.altitude}>
      <div className="alt-rail" />
      <div ref={fill} className="alt-fill" />
      {TICKS.map((i) => (
        <div key={i} className="alt-tick" style={{ bottom: `${(i / 6) * 100}%` }} />
      ))}
      <div ref={carriage} className="alt-carriage">
        <div className="alt-marker" />
      </div>
    </div>
  )
}
