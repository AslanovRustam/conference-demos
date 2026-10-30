import { animate } from 'motion/react'
import { useLayoutEffect, useRef } from 'react'
import { useGame } from '../game/store'
import { S } from '../strings'
import { formatCredits } from './format'

// balance rolls to its new value instead of jumping
export function Balance() {
  const balance = useGame((s) => s.snap.balance)
  const value = useRef<HTMLSpanElement>(null)
  const shown = useRef<number | null>(null)

  useLayoutEffect(() => {
    const el = value.current
    if (!el) return
    const write = (v: number) => {
      shown.current = v
      el.textContent = formatCredits(Math.round(v))
    }
    if (shown.current === null || shown.current === balance) {
      write(balance)
      return
    }
    const ctrl = animate(shown.current, balance, { duration: 0.6, ease: [0.22, 1, 0.36, 1], onUpdate: write })
    return () => ctrl.stop()
  }, [balance])

  return (
    <div className="hud-balance">
      <span className="hud-label">{S.balance}</span>
      <span ref={value} className="balance-value" />
    </div>
  )
}
