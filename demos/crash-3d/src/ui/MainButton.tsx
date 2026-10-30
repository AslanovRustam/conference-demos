import type { PointerEvent } from 'react'
import { useEffect, useRef } from 'react'
import { COUNTDOWN_S } from '../core/config'
import type { RoundSnapshot } from '../core/types'
import { primaryAction } from '../game/runtime'
import { onSnap, useGame } from '../game/store'
import { S } from '../strings'
import { formatCredits } from './format'

// action word, amount, and how much of the red fill is shown (0..1)
function view(snap: RoundSnapshot): [string, string, number] {
  const cashed = snap.cashedAt !== null ? `${S.dot} ${formatCredits(snap.payout)}` : ''
  switch (snap.phase) {
    case 'betting':
      return [S.launch, '', 1]
    case 'countdown':
      return [`${S.tMinus}${Math.max(1, Math.ceil(snap.countdown - 1e-9))}`, '', 1 - snap.countdown / COUNTDOWN_S]
    case 'flight':
      // same rounding as the engine payout
      return [S.cashOut, `${S.dot} ${formatCredits(Math.floor(snap.bet * snap.multiplier))}`, 1]
    case 'ejected':
      return [S.cashedOut, cashed, 0]
    default:
      return snap.cashedAt !== null ? [S.cashedOut, cashed, 0] : [S.launch, '', 0]
  }
}

// launch / cash out: the ejection handle. reacts on pointerdown for zero latency
export function MainButton() {
  const phase = useGame((s) => s.snap.phase)
  const action = useRef<HTMLSpanElement>(null)
  const amount = useRef<HTMLSpanElement>(null)
  const fill = useRef<HTMLSpanElement>(null)

  useEffect(() => {
    let lastAction = ''
    let lastAmount = ''
    let lastFill = -1
    let lastPhase = ''
    return onSnap((snap) => {
      const [a, m, f] = view(snap)
      if (a !== lastAction && action.current) action.current.textContent = lastAction = a
      if (m !== lastAmount && amount.current) amount.current.textContent = lastAmount = m
      if (!fill.current) return
      // the countdown charge follows the clock exactly; other changes ease
      if (snap.phase !== lastPhase) {
        lastPhase = snap.phase
        fill.current.style.transition = snap.phase === 'countdown' ? 'none' : ''
      }
      if (f !== lastFill) fill.current.style.transform = `scaleX(${(lastFill = f).toFixed(4)})`
    })
  }, [])

  const live = phase === 'betting' || phase === 'flight'
  const onDown = (e: PointerEvent<HTMLButtonElement>) => {
    if (e.button !== 0) return
    e.preventDefault()
    primaryAction()
  }

  return (
    <div className="hud-main" data-phase={phase}>
      <div className="mb-glow" aria-hidden />
      <button className="mb ck-chamfer" tabIndex={-1} disabled={!live} onPointerDown={onDown}>
        <span ref={fill} className="mb-fill" aria-hidden />
        <span className="mb-text">
          <span ref={action} className="mb-action" />
          <span ref={amount} className="mb-amount" />
        </span>
      </button>
    </div>
  )
}
