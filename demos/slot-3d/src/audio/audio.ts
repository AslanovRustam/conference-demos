// Public sound API for Neon Vault. Everything is synthesized with Web Audio: no files.
// Import-safe outside the browser: the AudioContext is created lazily in unlock().
import { clamp, createKit, type Kit } from './core'
import { createMusic, type Music } from './music'
import { anticipation, SFX } from './sfx'

export type Sfx =
  | 'click'
  | 'spinStart'
  | 'reelStop'
  | 'scatterLand'
  | 'win'
  | 'explode'
  | 'drop'
  | 'multiplier'
  | 'bonusTrigger'
  | 'vaultOpen'
  | 'bigWinTier'
  | 'coin'
  | 'countTick'
  | 'countEnd'
  | 'freeSpinsAward'
  | 'bonusEnd'

export type MusicTheme = 'base' | 'bonus' | 'off'

export interface AudioApi {
  /** call from a user gesture (click/tap/keydown). Creates or resumes the AudioContext. Safe to call many times. */
  unlock(): Promise<void>
  /** fire-and-forget; no-op (never throws) before unlock or when Web Audio is unavailable */
  play(name: Sfx, arg?: number): void
  /** rising tension riser; returns a function that stops it (fade ~0.2 s). Calling stop twice is safe. */
  startAnticipation(): () => void
  /** crossfade (~1.5 s) to a music theme; 'off' fades music out. Safe before unlock. */
  setMusic(theme: MusicTheme): void
  /** 0..1, how exciting the moment is; smoothed internally */
  setIntensity(x: number): void
  /** mutes everything with a short fade; persisted in localStorage */
  setMuted(m: boolean): void
  readonly muted: boolean
}

const MUTE_KEY = 'neonvault.muted'
/** minimum gap between repeats (ms) for SFX the game may fire in bursts */
const GAP_MS: Partial<Record<Sfx, number>> = {
  click: 30,
  reelStop: 25,
  scatterLand: 25,
  win: 50,
  explode: 50,
  drop: 50,
  multiplier: 60,
  coin: 40,
  countTick: 33,
}
/** cosmetic SFX dropped when too many voices are already sounding */
const SHEDDABLE = new Set<Sfx>(['click', 'win', 'explode', 'drop', 'coin', 'countTick'])
const MAX_VOICES = 72

let ctx: AudioContext | null = null
let kit: Kit | null = null
let music: Music | null = null
let theme: MusicTheme = 'off'
let intensity = 0
let mutedState: boolean | null = null
let resuming = false
let wasRunning = false
const lastAt: Partial<Record<Sfx, number>> = {}

const nowMs = () => (typeof performance !== 'undefined' ? performance.now() : Date.now())

function isMuted(): boolean {
  if (mutedState === null) {
    mutedState = false
    try {
      mutedState = typeof localStorage !== 'undefined' && localStorage.getItem(MUTE_KEY) === '1'
    } catch {
      // storage blocked (private mode, sandboxed iframe)
    }
  }
  return mutedState
}

function audioCtor(): typeof AudioContext | undefined {
  if (typeof window === 'undefined') return undefined
  const w = window as unknown as { AudioContext?: typeof AudioContext; webkitAudioContext?: typeof AudioContext }
  return w.AudioContext ?? w.webkitAudioContext
}

/** usable right now: running, or resuming inside the gesture that called unlock() */
const live = (c: AudioContext) => c.state === 'running' || resuming

function onVisibility() {
  if (!ctx) return
  if (document.hidden) {
    wasRunning = ctx.state === 'running'
    if (wasRunning) ctx.suspend().catch(() => {})
  } else if (wasRunning) {
    wasRunning = false
    ctx.resume().catch(() => {})
  }
}

async function unlock(): Promise<void> {
  try {
    if (!ctx) {
      const AC = audioCtor()
      if (!AC) return
      try {
        ctx = new AC({ latencyHint: 'interactive' })
      } catch {
        ctx = new AC()
      }
      kit = createKit(ctx, ctx.destination, isMuted())
      music = createMusic(kit, isMuted)
      music.setIntensity(intensity, true)
      document.addEventListener('visibilitychange', onVisibility)
    }
    music?.set(theme)
    if (ctx.state !== 'running') {
      // iOS only opens the output once a sound starts inside the gesture
      const blip = ctx.createBufferSource()
      blip.buffer = ctx.createBuffer(1, 1, ctx.sampleRate)
      blip.connect(ctx.destination)
      blip.onended = () => blip.disconnect()
      blip.start(0)
      resuming = true
      await ctx.resume()
    }
  } catch {
    // autoplay policy or a closed context: stay silent, the next gesture retries
  } finally {
    resuming = false
  }
}

function play(name: Sfx, arg?: number): void {
  const k = kit
  if (!k || !ctx || isMuted() || !live(ctx)) return
  try {
    const gap = GAP_MS[name]
    if (gap !== undefined) {
      const now = nowMs()
      if (now - (lastAt[name] ?? -Infinity) < gap) return
      lastAt[name] = now
    }
    if (k.voices > MAX_VOICES && SHEDDABLE.has(name)) return
    SFX[name](k, ctx.currentTime + 0.005, arg)
  } catch {
    // sound must never break the game
  }
}

function startAnticipation(): () => void {
  const k = kit
  if (!k || !ctx || isMuted() || !live(ctx)) return () => {}
  try {
    const stop = anticipation(k)
    return () => {
      try {
        stop()
      } catch {
        // already gone
      }
    }
  } catch {
    return () => {}
  }
}

function setMuted(m: boolean): void {
  mutedState = m
  try {
    localStorage.setItem(MUTE_KEY, m ? '1' : '0')
  } catch {
    // storage blocked: the setting just won't persist
  }
  if (!kit || !ctx) return
  try {
    const g = kit.mute.gain
    const now = ctx.currentTime
    g.cancelScheduledValues(now)
    g.setValueAtTime(g.value, now)
    g.linearRampToValueAtTime(m ? 0 : 1, now + 0.12)
  } catch {
    // ignore
  }
}

export const audio: AudioApi = {
  unlock,
  play,
  startAnticipation,
  setMusic(next) {
    theme = next
    try {
      music?.set(next)
    } catch {
      // ignore
    }
  },
  setIntensity(x) {
    intensity = Number.isFinite(x) ? clamp(x, 0, 1) : 0
    music?.setIntensity(intensity)
  },
  setMuted,
  get muted() {
    return isMuted()
  },
}

// dev: a hot-reloaded module must not leave the old context playing underneath
if (import.meta.hot) {
  import.meta.hot.dispose(() => {
    music?.dispose()
    ctx?.close().catch(() => {})
  })
}
