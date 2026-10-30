import { useEffect, useRef } from 'react'
import { onSnap, useGame } from '../game/store'
import { S } from '../strings'
import { formatMult } from './format'

// big live multiplier; digits are written straight into the dom every frame.
// after a cash out it holds the player's multiplier, and a pale line keeps counting where the rocket got to
export function Multiplier() {
  const phase = useGame((s) => s.snap.phase)
  const cashed = useGame((s) => s.snap.cashedAt !== null)
  const root = useRef<HTMLDivElement>(null)
  const num = useRef<HTMLSpanElement>(null)
  const ghost = useRef<HTMLSpanElement>(null)

  useEffect(() => {
    let last = ''
    let lastGhost = ''
    return onSnap((snap) => {
      const text = formatMult(snap.cashedAt ?? snap.multiplier)
      if (text !== last && num.current && root.current) {
        last = text
        num.current.textContent = text
        // integer digit count drives the type size so 1000.00× still fits
        root.current.dataset.digits = String(Math.min(4, text.indexOf('.')))
      }
      const g = snap.cashedAt !== null ? formatMult(snap.multiplier) : ''
      if (g !== lastGhost && ghost.current) {
        lastGhost = g
        ghost.current.textContent = g
      }
    })
  }, [])

  const idle = phase === 'betting' || phase === 'countdown'
  const showGhost = cashed && (phase === 'ejected' || phase === 'crashed')
  return (
    <div ref={root} className="hud-mult" data-idle={idle || undefined} data-faded={phase === 'result' || undefined}>
      <div className="mult-value">
        <span ref={num} className="mult-num" />
        <span className="mult-x">{S.times}</span>
      </div>
      <div className="hud-label mult-label">{S.multiplier}</div>
      <div className="mult-ghost" data-on={showGhost || undefined} aria-hidden={!showGhost}>
        {S.rocketReached} <span ref={ghost} className="mult-ghost-num" />
        <span className="mult-ghost-x">{S.times}</span>
      </div>
    </div>
  )
}
