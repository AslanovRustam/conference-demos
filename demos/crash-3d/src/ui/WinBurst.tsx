import { animate, AnimatePresence, motion } from 'motion/react'
import type { PointerEvent } from 'react'
import { useEffect, useRef, useState } from 'react'
import { PLAY_AGAIN_AFTER_S } from '../core/config'
import { runtime } from '../game/runtime'
import { exitToLobby } from '../platform/embed'
import { vibrate } from '../platform/haptics'
import { params } from '../platform/params'
import { S } from '../strings'
import { formatCredits, formatMult } from './format'

const COUNT_S = 1.1

// pointerdown like every other button here: no wait for the finger to lift
const press = (act: () => void) => (e: PointerEvent<HTMLButtonElement>) => {
  if (e.button !== 0) return
  e.preventDefault()
  act()
}

// the win, under the capsule the camera follows: YOU WON, the payout counting up in Clickable Black with a red
// glow and slow light rays behind it, and the multiplier it was cashed out at. once the amount is up: PLAY AGAIN
// (space; straight back to the bets) and, in the lobby, EXIT (esc). without either the card stays until the round
// has played out (the round's result needs no card)
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
            <div className="wincard-rays" aria-hidden />
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
            {/* in when the engine takes play again (core/round.ts), not before: a doubled cash out press skips nothing */}
            <motion.div
              className="wincard-actions"
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: PLAY_AGAIN_AFTER_S, duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
            >
              <button
                className="wincard-btn wincard-btn--again ck-chamfer"
                tabIndex={-1}
                onPointerDown={press(() => runtime.engine.playAgain())}
              >
                {S.playAgain}
                <kbd className="bet-keys">{S.keys.space}</kbd>
              </button>
              {params.embed && (
                <button className="wincard-btn ck-chamfer" tabIndex={-1} onPointerDown={press(() => exitToLobby())}>
                  {S.exit}
                  <kbd className="bet-keys">{S.keys.esc}</kbd>
                </button>
              )}
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
