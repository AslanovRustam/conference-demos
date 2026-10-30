import { AnimatePresence, motion } from 'motion/react'
import { applyAction } from '../input/useControls'
import { useLobby } from '../state/store'

const coarse = typeof matchMedia !== 'undefined' && matchMedia('(pointer: coarse)').matches

function SoundIcon({ muted }: { muted: boolean }) {
  return (
    <svg viewBox="0 0 24 24" width="1em" height="1em" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M4 9v6h4l5 4V5L8 9H4z" fill="currentColor" stroke="none" />
      {muted ? <path d="M16 9l5 6M21 9l-5 6" /> : <path d="M16 8.5a5 5 0 0 1 0 7M18.5 6a8.5 8.5 0 0 1 0 12" />}
    </svg>
  )
}

export default function Hud() {
  const inLobby = useLobby((s) => s.phase === 'lobby')
  const slot = useLobby((s) => s.slots[s.activeIndex])
  const muted = useLobby((s) => s.muted)

  const title = slot?.kind === 'game' ? slot.game.title : (slot?.title ?? 'COMING SOON')
  const subtitle = slot?.kind === 'game' ? slot.game.subtitle : slot?.title ? 'COMING SOON' : 'More games on the way'

  return (
    <AnimatePresence>
      {inLobby && slot && (
        <motion.div className="hud" data-testid="hud" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0, transition: { duration: 0.25 } }}>
          <button className="hud-mute" data-testid="mute" aria-label="Sound" aria-pressed={muted} onClick={() => applyAction({ type: 'toggleMute' })}>
            <SoundIcon muted={muted} />
          </button>

          <button className="hud-arrow hud-arrow--prev ck-chamfer" data-testid="prev" aria-label="Previous game" onClick={() => applyAction({ type: 'step', dir: -1 })}>
            ‹
          </button>
          <button className="hud-arrow hud-arrow--next ck-chamfer" data-testid="next" aria-label="Next game" onClick={() => applyAction({ type: 'step', dir: 1 })}>
            ›
          </button>

          <div className="hud-caption">
            <motion.div key={slot.key} initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.35, ease: 'easeOut' }}>
              <div className="hud-title" data-testid="hud-title">
                {title}
              </div>
              <div className="hud-subtitle" data-testid="hud-subtitle">
                {subtitle}
              </div>
            </motion.div>
            <div className="hud-hint">{coarse ? 'Swipe to browse · Tap to play' : '← → to browse · ENTER to play'}</div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
