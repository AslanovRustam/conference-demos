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

const MINUS = 'M2.5 6h7'
const PLUS = 'M2.5 6h7M6 2.5v7'

function Step({ label, path, enabled, onStep }: { label: string; path: string; enabled: boolean; onStep: () => void }) {
  return (
    <button className="step" tabIndex={-1} aria-label={label} disabled={!enabled} onPointerDown={press(onStep)}>
      <svg viewBox="0 0 12 12" aria-hidden>
        <path d={path} />
      </svg>
    </button>
  )
}

// two cards over the launch button, only while betting: BET [−] 100 [+] and AUTO CASH OUT on/off [−] 2.00× [+].
// on a laptop the keys sit next to the labels
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
            <div className="bet-card ck-chamfer">
              <div className="bet-card-head">
                <span className="bet-card-label">{S.bet}</span>
                <kbd className="bet-keys">↑ ↓</kbd>
              </div>
              <div className="bet-card-row">
                <Step label={S.aria.betDown} path={MINUS} enabled={bi > 0} onStep={() => engine.stepBet(-1)} />
                <span className="bet-value">{formatCredits(bet)}</span>
                <Step
                  label={S.aria.betUp}
                  path={PLUS}
                  enabled={bi < BET_LADDER.length - 1 && BET_LADDER[bi + 1] <= balance}
                  onStep={() => engine.stepBet(1)}
                />
              </div>
            </div>
            <div className="bet-card ck-chamfer" data-off={!autoOn || undefined}>
              <div className="bet-card-head">
                <button
                  className="auto-toggle"
                  tabIndex={-1}
                  role="switch"
                  aria-checked={autoOn}
                  aria-label={S.aria.autoToggle}
                  onPointerDown={press(() => engine.toggleAuto())}
                >
                  <span className="bet-card-label">
                    <span className="label-long">{S.autoCashOut}</span>
                    <span className="label-short">{S.auto}</span>
                  </span>
                  <span className="switch">
                    <span className="switch-knob" />
                  </span>
                  <span className="auto-state">{autoOn ? S.on : S.off}</span>
                </button>
                <kbd className="bet-keys">A · ← →</kbd>
              </div>
              <div className="bet-card-row">
                <Step label={S.aria.autoDown} path={MINUS} enabled={ai > 0} onStep={() => engine.stepAuto(-1)} />
                <span className="bet-value auto-value">
                  {formatMult(autoValue)}
                  <span className="auto-x">{S.times}</span>
                </span>
                <Step label={S.aria.autoUp} path={PLUS} enabled={ai < AUTO_LADDER.length - 1} onStep={() => engine.stepAuto(1)} />
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
