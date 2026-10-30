import { useEffect, useRef } from 'react'
import { onSnap, useGame } from '../game/store'
import { S } from '../strings'
import { formatMult } from './format'

// big live multiplier; digits are written straight into the dom every frame
export function Multiplier() {
  const phase = useGame((s) => s.snap.phase)
  const root = useRef<HTMLDivElement>(null)
  const num = useRef<HTMLSpanElement>(null)

  useEffect(() => {
    let last = ''
    return onSnap((snap) => {
      const text = formatMult(snap.multiplier)
      if (text === last || !num.current || !root.current) return
      last = text
      num.current.textContent = text
      // integer digit count drives the type size so 1000.00× still fits
      root.current.dataset.digits = String(Math.min(4, text.indexOf('.')))
    })
  }, [])

  const idle = phase === 'betting' || phase === 'countdown'
  return (
    <div ref={root} className="hud-mult" data-idle={idle || undefined} data-faded={phase === 'result' || undefined}>
      <div className="mult-value">
        <span ref={num} className="mult-num" />
        <span className="mult-x">{S.times}</span>
      </div>
      <div className="hud-label mult-label">{S.multiplier}</div>
    </div>
  )
}
