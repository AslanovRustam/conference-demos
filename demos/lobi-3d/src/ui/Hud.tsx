import { brandLogo } from '@brand/tokens'
import { AnimatePresence, motion } from 'motion/react'
import { useEffect, useState } from 'react'
import { useSwipeNudge } from '../input/swipeNudge'
import { applyAction } from '../input/useControls'
import { lobbyStore, useLobby } from '../state/store'
import { hudCaption, hudTag } from './hudTag'

const coarse = typeof matchMedia !== 'undefined' && matchMedia('(pointer: coarse)').matches

function SoundIcon({ muted }: { muted: boolean }) {
  return (
    <svg viewBox="0 0 24 24" width="1em" height="1em" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M4 9v6h4l5 4V5L8 9H4z" fill="currentColor" stroke="none" />
      {muted ? <path d="M16 9l5 6M21 9l-5 6" /> : <path d="M16 8.5a5 5 0 0 1 0 7M18.5 6a8.5 8.5 0 0 1 0 12" />}
    </svg>
  )
}

function Arrow({ dir }: { dir: 'left' | 'right' }) {
  return (
    <svg viewBox="0 0 24 24" width="1em" height="1em" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      {dir === 'left' ? <path d="M19 12H5M11 6l-6 6 6 6" /> : <path d="M5 12h14M13 6l6 6-6 6" />}
    </svg>
  )
}

function Chevron({ dir }: { dir: 'left' | 'right' }) {
  return (
    <svg viewBox="0 0 24 24" width="1em" height="1em" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
      <path d={dir === 'left' ? 'M15 5l-7 7 7 7' : 'M9 5l7 7-7 7'} />
    </svg>
  )
}

/** true once the carousel has moved off its first cabinet, by any means */
function useBrowsed(): boolean {
  const [browsed, setBrowsed] = useState(false)
  useEffect(() => lobbyStore.subscribe((s, prev) => void (s.activeIndex !== prev.activeIndex && setBrowsed(true))), [])
  return browsed
}

export default function Hud() {
  const inLobby = useLobby((s) => s.phase === 'lobby')
  const slots = useLobby((s) => s.slots)
  const activeIndex = useLobby((s) => s.activeIndex)
  const muted = useLobby((s) => s.muted)
  const slot = slots[activeIndex]
  // touch visitors are told, and shown, that there is more than one game until they browse
  const browsed = useBrowsed()
  const swipeHint = coarse && !browsed
  useSwipeNudge(inLobby && swipeHint)

  const playable = slot?.kind === 'game'
  const { title, subtitle } = slot ? hudCaption(slot) : { title: '', subtitle: '' }

  return (
    <AnimatePresence>
      {inLobby && slot && (
        <motion.div className="hud" data-testid="hud" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0, transition: { duration: 0.25 } }}>
          <a className="hud-logo-link" data-testid="hud-logo-link" href="https://clickable.agency/" target="_blank" rel="noopener">
            <img className="hud-logo" data-testid="hud-logo" src={brandLogo.white} alt="Clickable" />
          </a>
          <button className="hud-round hud-mute" data-testid="mute" aria-label="Sound" aria-pressed={muted} onClick={() => applyAction({ type: 'toggleMute' })}>
            <SoundIcon muted={muted} />
          </button>

          <div className="hud-caption">
            <AnimatePresence>
              {swipeHint && (
                <motion.div className="hud-swipe" data-testid="swipe-hint" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0, transition: { delay: 0.8 } }} exit={{ opacity: 0 }}>
                  <Chevron dir="left" />
                  <span>Swipe for more games</span>
                  <Chevron dir="right" />
                </motion.div>
              )}
            </AnimatePresence>
            <motion.div key={slot.key} initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.35, ease: 'easeOut' }}>
              <div className="hud-tag" data-testid="hud-tag">
                <i />
                {hudTag(slots, activeIndex)}
              </div>
              <div className="hud-title" data-testid="hud-title">
                {title}
              </div>
              <div className="hud-subtitle" data-testid="hud-subtitle">
                {subtitle}
              </div>
            </motion.div>
            <div className="hud-actions">
              <button
                className="hud-play"
                data-testid="play"
                disabled={!playable}
                onClick={(e) => {
                  e.currentTarget.blur()
                  applyAction({ type: 'enter' })
                }}
              >
                Play
                <Arrow dir="right" />
              </button>
              {/* touch screens get the swipe plate above the caption instead */}
              {!coarse && <span className="hud-hint">← → to browse · Enter to play</span>}
            </div>
          </div>

          <div className="hud-nav">
            <button className="hud-round" data-testid="prev" aria-label="Previous game" onClick={() => applyAction({ type: 'step', dir: -1 })}>
              <Arrow dir="left" />
            </button>
            {/* one dot per cabinet: how many games there are and which one is in front */}
            <div className="hud-dots" data-testid="dots">
              {slots.map((s, i) => (
                <button key={s.key} className="hud-dot" aria-label={`Cabinet ${i + 1}`} aria-current={i === activeIndex} onClick={() => lobbyStore.getState().focus(i)}>
                  <i />
                </button>
              ))}
            </div>
            <button className="hud-round" data-testid="next" aria-label="Next game" onClick={() => applyAction({ type: 'step', dir: 1 })}>
              <Arrow dir="right" />
            </button>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
