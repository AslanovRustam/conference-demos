import { brandLogo } from '@brand/tokens'
import { AnimatePresence, motion } from 'motion/react'
import { useEffect, useRef, useState } from 'react'
import { audio } from '../audio/audio'
import { enterAttract, openVault, requestSpin, resetBalance } from '../game/director'
import { QUALITY, type Quality } from '../state/params'
import { useGame } from '../state/store'
import { fmt } from './format'
import { MetalText, Sparkles, type MetalTone } from './MetalText'

export function StepWinToast() {
  const step = useGame((s) => s.stepWin)
  const busy = useGame((s) => s.busy)
  const bigWin = useGame((s) => s.bigWin !== null)
  // each cascade win shows briefly, then gets out of the way of the next moment
  const [shownId, setShownId] = useState<number | null>(null)
  useEffect(() => {
    if (!step) return
    setShownId(step.id)
    const t = window.setTimeout(() => setShownId(null), 1600)
    return () => window.clearTimeout(t)
  }, [step])
  return (
    <div className="toast-anchor">
      <AnimatePresence>
        {step && step.id === shownId && busy && !bigWin && (
          <motion.div
            key={step.id}
            className="step-win"
            initial={{ opacity: 0, y: 24, scale: 0.7 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -30, scale: 1.1 }}
            transition={{ type: 'spring', stiffness: 420, damping: 22 }}
          >
            <MetalText text={`+${fmt(step.amount)}`} tone="gold" flat className="step-win-amount" />
            {step.multiplier > 1 && <MetalText text={`×${step.multiplier}`} tone="ruby" flat className="step-win-mult" />}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

/** the new multiplier punches into view, then flies up into the lamp track */
export function MultiplierBurst() {
  const fx = useGame((s) => s.multiplierFx)
  const bonus = useGame((s) => s.freeSpins !== null)
  const [shown, setShown] = useState<{ id: number; value: number } | null>(null)
  useEffect(() => {
    if (!fx) return
    setShown(fx)
    const t = window.setTimeout(() => setShown(null), 750)
    return () => window.clearTimeout(t)
  }, [fx])
  return (
    <div className="mult-anchor">
      <AnimatePresence>
        {shown && (
          <motion.div
            key={shown.id}
            className="mult-burst"
            initial={{ scale: 3.4, opacity: 0, rotateX: 55 }}
            animate={{ scale: 1, opacity: 1, rotateX: 0 }}
            exit={{ scale: 0.22, opacity: 0, y: '-24vh', transition: { duration: 0.32, ease: 'easeIn' } }}
            transition={{ type: 'spring', stiffness: 420, damping: 17 }}
          >
            <MetalText text={`×${shown.value}`} tone={bonus ? 'gold' : 'ruby'} />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

const TIER_TEXT = { none: '', big: 'Big Win', mega: 'Mega Win', epic: 'Epic Win', jackpot: 'Jackpot' } as const
const TIER_TONE: Record<keyof typeof TIER_TEXT, MetalTone> = { none: 'gold', big: 'gold', mega: 'ruby', epic: 'platinum', jackpot: 'jackpot' }

export function BigWinOverlay() {
  const big = useGame((s) => s.bigWin)
  return (
    <AnimatePresence>
      {big && (
        <motion.div
          className={`bigwin bigwin--${big.tier}`}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0, transition: { duration: 0.5 } }}
          onPointerDown={() => requestSpin()}
        >
          <div className="bigwin-rays" />
          {/* the pulse lives on a wrapper so it does not fight Motion's transform on the title */}
          <div className={big.tier === 'jackpot' ? 'bigwin-pulse' : undefined}>
            <AnimatePresence mode="popLayout">
              <motion.h2
                key={big.tier}
                className="bigwin-title"
                initial={{ scale: 2.6, opacity: 0, rotate: -6 }}
                animate={{ scale: 1, opacity: 1, rotate: 0 }}
                exit={{ scale: 0.6, opacity: 0 }}
                transition={{ type: 'spring', stiffness: 260, damping: 14 }}
              >
                <MetalText text={TIER_TEXT[big.tier]} tone={TIER_TONE[big.tier]} />
                <Sparkles count={big.tier === 'jackpot' ? 22 : big.tier === 'epic' ? 16 : 12} seed={big.tier.length} />
              </motion.h2>
            </AnimatePresence>
          </div>
          <div className="win-plaque bigwin-amount">
            <MetalText text={fmt(big.shown)} tone={big.tier === 'jackpot' ? 'gold' : 'platinum'} flat />
          </div>
          {big.tier === 'jackpot' && (
            <motion.div className="bigwin-sub" initial={{ opacity: 0, y: 20, letterSpacing: '0.8em' }} animate={{ opacity: 1, y: 0, letterSpacing: '0.35em' }} transition={{ duration: 0.8 }}>
              The vault is yours
            </motion.div>
          )}
          <div className="bigwin-hint">{big.shown >= big.target ? 'Tap to collect' : 'Tap to skip'}</div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}

export function BannerOverlay() {
  const banner = useGame((s) => s.banner)
  return (
    <AnimatePresence>
      {banner && banner.kind !== 'refill' && (
        <motion.div
          key={banner.kind + banner.value}
          className="banner"
          initial={{ opacity: 0, scale: 0.6 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 1.15 }}
          transition={{ type: 'spring', stiffness: 300, damping: 18 }}
        >
          {banner.kind === 'freeSpins' ? (
            <>
              <span className="banner-kicker">{banner.retrigger ? 'Retrigger' : 'Vault unlocked'}</span>
              <MetalText text={banner.retrigger ? `+${banner.value}` : String(banner.value)} tone="gold" className="banner-big" />
              <MetalText text="Free spins" tone="platinum" flat className="banner-title" />
              {!banner.retrigger && <span className="banner-sub">The multiplier keeps climbing and never resets</span>}
            </>
          ) : (
            <>
              <span className="banner-kicker">Bonus complete</span>
              <div className="win-plaque banner-amount">
                <MetalText text={fmt(banner.value)} tone="gold" flat />
              </div>
              <MetalText text="Total bonus win" tone="platinum" flat className="banner-title" />
            </>
          )}
        </motion.div>
      )}
      {banner?.kind === 'refill' && (
        <motion.div key="refill" className="refill" initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -20 }}>
          Credits refilled · {fmt(banner.value)}
        </motion.div>
      )}
    </AnimatePresence>
  )
}

const QUALITIES: Quality[] = ['high', 'medium', 'low']

export function PresenterPanel() {
  const open = useGame((s) => s.presenterPanel)
  const quality = useGame((s) => s.quality)
  const showFps = useGame((s) => s.showFps)
  const action = (fn: () => void) => () => {
    audio.play('click')
    fn()
  }
  return (
    <AnimatePresence>
      {open && (
        <motion.aside className="presenter" initial={{ opacity: 0, x: 40 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 40 }}>
          <h3>Presenter</h3>
          <button onClick={action(() => requestSpin('bonus'))}>
            Force bonus <kbd>Shift B</kbd>
          </button>
          <button onClick={action(() => requestSpin('bigwin'))}>
            Force big win <kbd>Shift W</kbd>
          </button>
          <button onClick={action(resetBalance)}>
            Reset balance <kbd>Shift R</kbd>
          </button>
          <button onClick={action(enterAttract)}>
            Attract mode <kbd>Shift A</kbd>
          </button>
          <button onClick={action(() => useGame.setState({ showFps: !showFps }))}>
            FPS {showFps ? 'on' : 'off'} <kbd>Shift F</kbd>
          </button>
          <div className="presenter-row">
            {QUALITIES.map((q) => (
              <button key={q} className={q === quality ? 'on' : ''} onClick={action(() => useGame.setState({ quality: q }))}>
                {q}
              </button>
            ))}
          </div>
          <p>
            Quality <kbd>Shift Q</kbd> · this panel <kbd>Shift H</kbd> or hold the logo 2 s
          </p>
        </motion.aside>
      )}
    </AnimatePresence>
  )
}

export function Fps() {
  const show = useGame((s) => s.showFps)
  const quality = useGame((s) => s.quality)
  const ref = useRef<HTMLDivElement>(null)
  useEffect(() => {
    if (!show) return
    let frames = 0
    let last = performance.now()
    let id = 0
    const loop = (now: number) => {
      frames++
      if (now - last >= 500) {
        if (ref.current) ref.current.textContent = `${Math.round((frames * 1000) / (now - last))} FPS · ${quality} · dpr ≤ ${QUALITY[quality].dpr}`
        frames = 0
        last = now
      }
      id = requestAnimationFrame(loop)
    }
    id = requestAnimationFrame(loop)
    return () => cancelAnimationFrame(id)
  }, [show, quality])
  return show ? <div className="fps" ref={ref} /> : null
}

/** loading screen, then the closed vault with its call to action (start screen and attract mode) */
export function VaultGate() {
  const ready = useGame((s) => s.ready)
  const vault = useGame((s) => s.vault)
  const started = useGame((s) => s.started)
  const attract = useGame((s) => s.attract)
  const showCta = ready && vault === 'closed' && (!started || attract)
  return (
    <>
      <AnimatePresence>
        {!ready && (
          <motion.div className="loader" exit={{ opacity: 0, transition: { duration: 0.6 } }}>
            <img src={brandLogo.red} alt="Clickable" />
            <div className="loader-bar">
              <span />
            </div>
          </motion.div>
        )}
      </AnimatePresence>
      <AnimatePresence>
        {showCta && (
          <motion.div
            className="gate"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0, transition: { duration: 0.35 } }}
            onPointerDown={() => void openVault()}
          >
            <motion.div className="gate-panel" initial={{ y: 30 }} animate={{ y: 0 }} transition={{ type: 'spring', stiffness: 200, damping: 20, delay: 0.2 }}>
              <span className="gate-title">Clickable Vault</span>
              <motion.button
                className="gate-btn ck-chamfer"
                animate={{ scale: [1, 1.05, 1] }}
                transition={{ duration: 1.6, repeat: Infinity, ease: 'easeInOut' }}
              >
                Open the vault
              </motion.button>
              <span className="gate-sub">3D slot demo · virtual credits only</span>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  )
}
