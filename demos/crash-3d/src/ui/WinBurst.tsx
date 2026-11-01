import { animate, AnimatePresence, motion } from 'motion/react'
import { useEffect, useRef, useState } from 'react'
import { runtime } from '../game/runtime'
import { vibrate } from '../platform/haptics'
import { S } from '../strings'
import { formatCredits, formatMult } from './format'

const COUNT_S = 1.1

// the win, under the capsule the camera follows: YOU WON, the payout counting up in Clickable Black with a red
// glow, and the multiplier it was cashed out at. it stays until the next round (the round's result needs no card)
export function WinBurst() {
  const [win, setWin] = useState<{ id: number; payout: number; at: number } | null>(null)
  const num = useRef<HTMLSpanElement>(null)

  useEffect(
    () =>
      runtime.emitter.on((e) => {
        if (e.type === 'cashout') {
          vibrate(40)
          setWin({ id: performance.now(), payout: e.payout, at: e.multiplier })
        } else if (e.type === 'betting') {
          setWin(null)
        }
      }),
    [],
  )

  useEffect(() => {
    if (!win) return
    const controls = animate(0, win.payout, {
      duration: COUNT_S,
      ease: [0.16, 1, 0.3, 1],
      onUpdate: (v) => {
        if (num.current) num.current.textContent = formatCredits(Math.round(v))
      },
    })
    return () => controls.stop()
  }, [win])

  return (
    <div className="hud-center hud-winburst" aria-live="polite">
      <AnimatePresence>
        {win && (
          <motion.div
            key={win.id}
            className="wincard"
            initial={{ opacity: 0, scale: 0.7, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, y: -16, transition: { duration: 0.35, ease: 'easeIn' } }}
            transition={{ type: 'spring', stiffness: 360, damping: 18 }}
          >
            <div className="wincard-glow" aria-hidden />
            <div className="wincard-label">{S.youWon}</div>
            <div className="wincard-amount">
              <span className="wincard-plus">+</span>
              <span ref={num}>0</span>
            </div>
            <motion.div
              className="wincard-rule"
              aria-hidden
              initial={{ scaleX: 0 }}
              animate={{ scaleX: 1 }}
              transition={{ delay: 0.25, duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
            />
            <div className="wincard-sub">
              {S.cashedOutAt} <b>{formatMult(win.at)}{S.times}</b>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
