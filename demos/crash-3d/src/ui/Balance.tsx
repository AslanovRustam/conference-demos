import { animate } from 'motion/react'
import { useEffect, useLayoutEffect, useRef } from 'react'
import { runtime } from '../game/runtime'
import { useGame } from '../game/store'
import { S } from '../strings'
import { formatCredits } from './format'
import { CREDIT_LAND_S } from './winFxSim'

// balance rolls to its new value instead of jumping; a win fills it while the credits fly in (ui/WinFx.tsx), lit up
export function Balance() {
  const balance = useGame((s) => s.snap.balance)
  const box = useRef<HTMLDivElement>(null)
  const value = useRef<HTMLSpanElement>(null)
  const shown = useRef<number | null>(null)
  const win = useRef(false)

  useEffect(
    () =>
      runtime.emitter.on((e) => {
        // the idle loop's wins change no balance
        if (e.type === 'cashout') win.current = !runtime.engine.snapshot().attract
      }),
    [],
  )

  useLayoutEffect(() => {
    const el = value.current
    if (!el) return
    const write = (v: number) => {
      shown.current = v
      el.textContent = formatCredits(Math.round(v))
    }
    const fromWin = win.current
    win.current = false
    if (shown.current === null || shown.current === balance) {
      write(balance)
      return
    }
    const from = shown.current
    const lit = fromWin && balance > from
    const ctrl = animate(from, balance, {
      ...(lit
        ? { delay: CREDIT_LAND_S[0], duration: CREDIT_LAND_S[1] - CREDIT_LAND_S[0], ease: 'linear' }
        : { duration: 0.6, ease: [0.22, 1, 0.36, 1] }),
      onUpdate: (v) => {
        write(v)
        // lit from the first credit landing
        if (lit && v !== from) box.current?.setAttribute('data-win', '')
      },
      onComplete: () => box.current?.removeAttribute('data-win'),
    })
    return () => {
      ctrl.stop()
      box.current?.removeAttribute('data-win')
    }
  }, [balance])

  return (
    <div ref={box} className="hud-balance">
      <span className="hud-label">{S.balance}</span>
      <span ref={value} className="balance-value" />
    </div>
  )
}
