import { AnimatePresence, motion } from 'motion/react'
import { useGame } from '../game/store'
import { S } from '../strings'
import { formatCredits, formatMult } from './format'

const ease = [0.22, 1, 0.36, 1] as const

// result card: YOU WON +437 / ROCKET REACHED 12.40×, or CRASHED @ 4.37× in red.
// AnimatePresence keeps the last element on exit, so the card does not flip while it fades
export function ResultOverlay() {
  const phase = useGame((s) => s.snap.phase)
  const cashedAt = useGame((s) => s.snap.cashedAt)
  const payout = useGame((s) => s.snap.payout)
  const crash = useGame((s) => s.snap.crashPoint)
  const show = phase === 'result' && crash !== null
  const won = cashedAt !== null

  return (
    <div className="hud-center hud-result">
      <AnimatePresence>
        {show && (
          <motion.div
            key="result"
            className="result"
            data-won={won || undefined}
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10, transition: { duration: 0.25, ease: 'easeIn' } }}
            transition={{ duration: 0.5, ease }}
          >
            <div className="result-scrim" aria-hidden />
            {won ? (
              <>
                <div className="hud-label result-label">{S.youWon}</div>
                <div className="result-amount">+{formatCredits(payout)}</div>
                <div className="result-sub">
                  {S.rocketReached} <span className="result-mult">{formatMult(crash)}</span>
                  <span className="x">{S.times}</span>
                </div>
              </>
            ) : (
              <div className="result-crash">
                <span className="result-crash-word">{S.crashedAt}</span>
                <span className="result-crash-mult">
                  {formatMult(crash)}
                  {S.times}
                </span>
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
