import { AnimatePresence, motion } from 'motion/react'
import { useGame } from '../game/store'
import { S } from '../strings'
import { formatMult } from './format'

const ease = [0.22, 1, 0.36, 1] as const

// result card of a lost round: CRASHED @ 4.37× in red (a win keeps its card from the cash out, WinBurst).
// AnimatePresence keeps the last element on exit, so the card does not flip while it fades
export function ResultOverlay() {
  const phase = useGame((s) => s.snap.phase)
  const cashedAt = useGame((s) => s.snap.cashedAt)
  const crash = useGame((s) => s.snap.crashPoint)
  const won = cashedAt !== null
  // a win keeps its card from the cash out (WinBurst)
  const show = phase === 'result' && crash !== null && !won

  return (
    <div className="hud-center hud-result">
      <AnimatePresence>
        {show && (
          <motion.div
            key="result"
            className="result"
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10, transition: { duration: 0.25, ease: 'easeIn' } }}
            transition={{ duration: 0.5, ease }}
          >
            <div className="result-scrim" aria-hidden />
            <div className="result-crash">
              <span className="result-crash-word">{S.crashedAt}</span>
              <span className="result-crash-mult">
                {formatMult(crash)}
                {S.times}
              </span>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
