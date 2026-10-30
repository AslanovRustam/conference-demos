import { AnimatePresence, motion } from 'motion/react'
import type { PointerEvent } from 'react'
import { AUTO_LADDER, BET_LADDER } from '../core/config'
import { runtime } from '../game/runtime'
import { useGame } from '../game/store'
import { S } from '../strings'
import { formatCredits, formatMult } from './format'

// pointerdown for instant response; primary mouse button or touch only
function press(fn: () => void) {
  return (e: PointerEvent<HTMLButtonElement>) => {
    if (e.button !== 0) return
    e.preventDefault()
    fn()
  }
}

interface StepsProps {
  down: string
  up: string
  canDown: boolean
  canUp: boolean
  onStep: (dir: 1 | -1) => void
}

function Steps({ down, up, canDown, canUp, onStep }: StepsProps) {
  return (
    <span className="steps">
      <button className="step" tabIndex={-1} aria-label={down} disabled={!canDown} onPointerDown={press(() => onStep(-1))}>
        <svg viewBox="0 0 12 12" aria-hidden>
          <path d="M2.5 6h7" />
        </svg>
      </button>
      <button className="step" tabIndex={-1} aria-label={up} disabled={!canUp} onPointerDown={press(() => onStep(1))}>
        <svg viewBox="0 0 12 12" aria-hidden>
          <path d="M2.5 6h7M6 2.5v7" />
        </svg>
      </button>
    </span>
  )
}

// BET 100 [−][+]   AUTO [on/off] 2.00× [−][+]; only exists while betting
export function BetControls() {
  const betting = useGame((s) => s.snap.phase === 'betting')
  const bet = useGame((s) => s.snap.bet)
  const balance = useGame((s) => s.snap.balance)
  const autoOn = useGame((s) => s.snap.auto.enabled)
  const autoValue = useGame((s) => s.snap.auto.value)
  const { engine } = runtime

  const bi = BET_LADDER.indexOf(bet)
  const ai = AUTO_LADDER.indexOf(autoValue)

  return (
    <div className="hud-bets">
      <AnimatePresence>
        {betting && (
          <motion.div
            key="bets"
            className="bets"
            initial={{ opacity: 0, y: 14 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 10, transition: { duration: 0.18, ease: 'easeIn' } }}
            transition={{ duration: 0.42, ease: [0.22, 1, 0.36, 1] }}
          >
            <div className="bet-group">
              <span className="hud-label bet-label">{S.bet}</span>
              <span className="bet-value">{formatCredits(bet)}</span>
              <Steps
                down={S.aria.betDown}
                up={S.aria.betUp}
                canDown={bi > 0}
                canUp={bi < BET_LADDER.length - 1 && BET_LADDER[bi + 1] <= balance}
                onStep={(d) => engine.stepBet(d)}
              />
            </div>
            <div className="bets-rule" aria-hidden />
            <div className="bet-group" data-off={!autoOn || undefined}>
              <button
                className="auto-toggle"
                tabIndex={-1}
                role="switch"
                aria-checked={autoOn}
                aria-label={S.aria.autoToggle}
                onPointerDown={press(() => engine.toggleAuto())}
              >
                <span className="hud-label bet-label">{S.auto}</span>
                <span className="switch">
                  <span className="switch-knob" />
                </span>
              </button>
              <span className="bet-value auto-value">
                {formatMult(autoValue)}
                <span className="auto-x">{S.times}</span>
              </span>
              <Steps
                down={S.aria.autoDown}
                up={S.aria.autoUp}
                canDown={ai > 0}
                canUp={ai < AUTO_LADDER.length - 1}
                onStep={(d) => engine.stepAuto(d)}
              />
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
