import { brandLogo } from '@brand/tokens'
import { animate, AnimatePresence, motion, useMotionValue, useTransform } from 'motion/react'
import { useEffect, useRef, useState } from 'react'
import { audio } from '../audio/audio'
import { requestSpin, startAutoplay, stopAutoplay } from '../game/director'
import { params } from '../state/params'
import { useGame } from '../state/store'
import { fmt } from './format'
import { AutoIcon, BoltIcon, ExitIcon, FullscreenIcon, SoundIcon, SpinIcon } from './icons'

function Counter({ value }: { value: number }) {
  const mv = useMotionValue(value)
  const text = useTransform(mv, (v) => fmt(v))
  useEffect(() => {
    const controls = animate(mv, value, { duration: value > mv.get() ? 0.7 : 0.25, ease: 'easeOut' })
    return () => controls.stop()
  }, [mv, value])
  return <motion.span>{text}</motion.span>
}

function Meter({ label, value, accent }: { label: string; value: number; accent?: boolean }) {
  return (
    <div className={`meter${accent ? ' meter--accent' : ''}`}>
      <span className="meter-label">{label}</span>
      <span className="meter-value">
        <Counter value={value} />
      </span>
    </div>
  )
}

function click() {
  audio.play('click')
}

function BetControl() {
  const bet = useGame((s) => s.bet)
  const locked = useGame((s) => s.busy || s.freeSpins !== null || s.autoplay > 0)
  const changeBet = useGame((s) => s.changeBet)
  return (
    <div className="meter bet">
      <span className="meter-label">Bet</span>
      <div className="bet-row">
        <button className="round-btn" disabled={locked} onClick={() => (click(), changeBet(-1))} aria-label="Lower bet">
          −
        </button>
        <span className="meter-value">{fmt(bet)}</span>
        <button className="round-btn" disabled={locked} onClick={() => (click(), changeBet(1))} aria-label="Raise bet">
          +
        </button>
      </div>
    </div>
  )
}

const AUTO_OPTIONS = [10, 25, 50, 100, Infinity]

function AutoButton() {
  const autoplay = useGame((s) => s.autoplay)
  const bonus = useGame((s) => s.freeSpins !== null)
  const [open, setOpen] = useState(false)
  if (autoplay > 0) {
    return (
      <button className="pill pill--on" onClick={() => (click(), stopAutoplay())}>
        <AutoIcon />
        <span>{Number.isFinite(autoplay) ? autoplay : '∞'}</span>
      </button>
    )
  }
  return (
    <div className="auto">
      <button className="pill" disabled={bonus} onClick={() => (click(), setOpen((o) => !o))}>
        <AutoIcon />
        <span>Auto</span>
      </button>
      <AnimatePresence>
        {open && (
          <motion.div
            className="auto-menu"
            initial={{ opacity: 0, y: 10, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 6, scale: 0.98 }}
            transition={{ duration: 0.16 }}
          >
            {AUTO_OPTIONS.map((n) => (
              <button
                key={n}
                onClick={() => {
                  click()
                  setOpen(false)
                  startAutoplay(n)
                }}
              >
                {Number.isFinite(n) ? n : '∞'}
              </button>
            ))}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

function SpinButton() {
  const busy = useGame((s) => s.busy)
  const freeSpins = useGame((s) => s.freeSpins)
  const autoplay = useGame((s) => s.autoplay)
  const bigWin = useGame((s) => s.bigWin !== null)
  const label = freeSpins ? `${freeSpins.total - freeSpins.left}/${freeSpins.total}` : autoplay > 0 ? 'Stop' : null
  // every press turns the steel bezel one notch, like the dial of a safe
  const [turns, setTurns] = useState(0)
  return (
    <motion.button
      className={`spin${busy ? ' spin--busy' : ''}${freeSpins ? ' spin--bonus' : ''}`}
      whileTap={{ scale: 0.96 }}
      onClick={() => {
        setTurns((t) => t + 1)
        if (autoplay > 0 && !freeSpins) return stopAutoplay()
        if (!busy || bigWin) requestSpin()
      }}
      aria-label="Spin"
    >
      <span className="spin-halo" />
      <motion.span className="spin-bezel" animate={{ rotate: turns * 45 }} transition={{ type: 'spring', stiffness: 260, damping: 13 }}>
        {Array.from({ length: 8 }, (_, i) => (
          <span key={i} className="spin-rivet" style={{ transform: `rotate(${i * 45 + 22.5}deg)` }} />
        ))}
      </motion.span>
      <span className="spin-scale" />
      <span className="spin-dome">
        <span className="spin-gloss" />
        <span className="spin-icon">
          <SpinIcon />
        </span>
        {label && <span className="spin-label">{label}</span>}
      </span>
    </motion.button>
  )
}

function BrandLogo() {
  const timer = useRef<number | null>(null)
  const start = () => {
    timer.current = window.setTimeout(() => useGame.setState((s) => ({ presenterPanel: !s.presenterPanel })), 2000)
  }
  const cancel = () => {
    if (timer.current) window.clearTimeout(timer.current)
  }
  return (
    <div className="brand" onPointerDown={start} onPointerUp={cancel} onPointerLeave={cancel} onContextMenu={(e) => e.preventDefault()}>
      <img src={brandLogo.red} alt="Clickable" draggable={false} />
      <span className="brand-title">Vault</span>
    </div>
  )
}

function BonusChip() {
  const fs = useGame((s) => s.freeSpins)
  return (
    <AnimatePresence>
      {fs && (
        <motion.div className="bonus-chip" initial={{ opacity: 0, y: -16 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -16 }}>
          <div>
            <span className="meter-label">Free spins</span>
            <span className="bonus-chip-value">
              {fs.total - fs.left} <small>/ {fs.total}</small>
            </span>
          </div>
          <div>
            <span className="meter-label">Bonus win</span>
            <span className="bonus-chip-value gold">
              <Counter value={fs.won} />
            </span>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}

/** not offered where the page cannot take the screen: iPhone Safari, or a frame without the permission */
const canFullscreen = () => !!document.documentElement.requestFullscreen && document.fullscreenEnabled

function FullscreenButton() {
  const [active, setActive] = useState(() => !!document.fullscreenElement)
  useEffect(() => {
    // Esc and the browser's own controls leave fullscreen too
    const sync = () => setActive(!!document.fullscreenElement)
    document.addEventListener('fullscreenchange', sync)
    return () => document.removeEventListener('fullscreenchange', sync)
  }, [])
  if (!canFullscreen()) return null
  return (
    <button
      className="icon-btn"
      aria-label={active ? 'Exit fullscreen' : 'Fullscreen'}
      onClick={() => {
        const request = active ? document.exitFullscreen() : document.documentElement.requestFullscreen({ navigationUI: 'hide' })
        // the browser may refuse (no user gesture, frame policy): the game simply stays in the window
        request.catch(() => {})
      }}
    >
      <FullscreenIcon active={active} />
    </button>
  )
}

export function Hud() {
  const started = useGame((s) => s.started)
  const attract = useGame((s) => s.attract)
  const balance = useGame((s) => s.balance)
  const spinWin = useGame((s) => s.spinWin)
  const turbo = useGame((s) => s.turbo)
  const muted = useGame((s) => s.muted)
  const visible = started && !attract

  return (
    <AnimatePresence>
      {visible && (
        <motion.div className="hud-layer" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.4 }}>
          <header className="topbar">
            <BrandLogo />
            <BonusChip />
            <div className="topbar-actions">
              <button
                className="icon-btn"
                aria-label={muted ? 'Unmute' : 'Mute'}
                onClick={() => {
                  audio.setMuted(!muted)
                  useGame.setState({ muted: !muted })
                }}
              >
                <SoundIcon muted={muted} />
              </button>
              <FullscreenButton />
              {params.embed && (
                <button className="icon-btn" aria-label="Exit" onClick={() => window.parent.postMessage({ type: 'clickable:exit' }, '*')}>
                  <ExitIcon />
                </button>
              )}
            </div>
          </header>
          <footer className="hud">
            <Meter label="Balance" value={balance} />
            <BetControl />
            <Meter label="Win" value={spinWin} accent />
            <div className="hud-actions">
              <button className={`pill${turbo ? ' pill--on' : ''}`} onClick={() => (click(), useGame.setState({ turbo: !turbo }))}>
                <BoltIcon />
                <span>Turbo</span>
              </button>
              <AutoButton />
            </div>
            <SpinButton />
          </footer>
          <p className="disclaimer">Demo · virtual credits only · no real money</p>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
