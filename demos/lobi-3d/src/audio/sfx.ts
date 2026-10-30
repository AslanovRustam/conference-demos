// Lobby sound effects, synthesised with Web Audio so nothing has to be downloaded. Each effect
// builds a few short-lived nodes. The context is created on the first user gesture (Chrome's
// autoplay policy); before that every call is a silent no-op.

type Name = 'tick' | 'select' | 'whooshIn' | 'whooshOut' | 'denied'

let ctx: AudioContext | null = null
let out: GainNode | null = null // mute × level
let noise: AudioBuffer | null = null
let muted = false
let level = 1
const plays: Partial<Record<Name, number>> = {}

function applyGain() {
  if (!ctx || !out) return
  out.gain.setTargetAtTime(muted ? 0 : level, ctx.currentTime, 0.08)
}

function setup(): AudioContext {
  ctx = new AudioContext()
  const limiter = ctx.createDynamicsCompressor()
  limiter.threshold.value = -10
  limiter.ratio.value = 8
  out = ctx.createGain()
  out.gain.value = muted ? 0 : level
  out.connect(limiter)
  limiter.connect(ctx.destination)
  noise = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate)
  const data = noise.getChannelData(0)
  for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1
  return ctx
}

function env(c: AudioContext, peak: number, attack: number, decay: number, at = c.currentTime): GainNode {
  const g = c.createGain()
  g.gain.setValueAtTime(0, at)
  g.gain.linearRampToValueAtTime(peak, at + attack)
  g.gain.exponentialRampToValueAtTime(0.0001, at + attack + decay)
  g.connect(out!)
  return g
}

function tone(c: AudioContext, type: OscillatorType, from: number, to: number, dest: AudioNode, at: number, dur: number) {
  const o = c.createOscillator()
  o.type = type
  o.frequency.setValueAtTime(from, at)
  o.frequency.exponentialRampToValueAtTime(to, at + dur)
  o.connect(dest)
  o.start(at)
  o.stop(at + dur + 0.05)
}

function sweep(c: AudioContext, from: number, to: number, dur: number, peak: number) {
  const at = c.currentTime
  const src = c.createBufferSource()
  src.buffer = noise
  src.loop = true
  const band = c.createBiquadFilter()
  band.type = 'bandpass'
  band.Q.value = 1.4
  band.frequency.setValueAtTime(from, at)
  band.frequency.exponentialRampToValueAtTime(to, at + dur)
  const g = env(c, peak, dur * 0.6, dur * 0.6, at)
  src.connect(band)
  band.connect(g)
  src.start(at)
  src.stop(at + dur * 1.3)
}

const effects: Record<Name, (c: AudioContext) => void> = {
  tick(c) {
    const at = c.currentTime
    tone(c, 'square', 2200, 1400, env(c, 0.06, 0.002, 0.04, at), at, 0.05)
  },
  select(c) {
    const at = c.currentTime
    tone(c, 'sine', 880, 880, env(c, 0.18, 0.01, 0.18, at), at, 0.2)
    tone(c, 'sine', 1320, 1320, env(c, 0.14, 0.01, 0.24, at + 0.07), at + 0.07, 0.26)
  },
  whooshIn(c) {
    sweep(c, 260, 3400, 1.4, 0.5)
    const at = c.currentTime
    tone(c, 'sine', 90, 420, env(c, 0.12, 0.6, 0.9, at), at, 1.4)
  },
  whooshOut(c) {
    sweep(c, 3000, 240, 1.0, 0.4)
  },
  denied(c) {
    const at = c.currentTime
    for (const t of [0, 0.12]) {
      const low = c.createBiquadFilter()
      low.type = 'lowpass'
      low.frequency.value = 700
      low.connect(env(c, 0.16, 0.005, 0.08, at + t))
      tone(c, 'sawtooth', 120, 110, low, at + t, 0.09)
    }
  },
}

function play(name: Name) {
  // a context created in this very gesture may still be resuming; its queue plays once it runs
  if (!ctx || ctx.state === 'closed') return
  plays[name] = (plays[name] ?? 0) + 1
  effects[name](ctx)
}

export const sfx = {
  /** call from a user gesture: creates (or resumes) the audio context */
  unlock() {
    const c = ctx ?? setup()
    if (c.state === 'suspended') void c.resume()
  },
  setMuted(m: boolean) {
    muted = m
    applyGain()
  },
  /** lobby volume, faded out while a game owns the sound */
  setLevel(v: number) {
    level = v
    applyGain()
  },
  tick: () => play('tick'),
  select: () => play('select'),
  whooshIn: () => play('whooshIn'),
  whooshOut: () => play('whooshOut'),
  denied: () => play('denied'),
  /** for automated checks */
  snapshot: () => ({ context: ctx?.state ?? 'none', muted, level, plays: { ...plays } }),
}

// lets automated browser checks read what played; stripped from production builds
if (import.meta.env?.DEV && typeof window !== 'undefined') Object.assign(window, { __sfx: sfx })
