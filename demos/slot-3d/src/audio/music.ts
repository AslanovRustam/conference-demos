// Generative-but-structured music: a lookahead scheduler walks 16th-note steps over an
// 8-bar progression; intensity opens filters and brings in hats, percussion and the arp.
import { fm, mtof, noise, osc, type Kit } from './core'

export type Theme = 'base' | 'bonus' | 'off'

const LOOKAHEAD = 0.12
const XFADE = 1.5

interface Bar {
  root: number
  pad: readonly number[]
}

interface Layer {
  f: BiquadFilterNode
  lo: number
  hi: number
  last: number
}

interface Player {
  def: ThemeDef
  /** seconds per 16th */
  sd: number
  next: number
  step: number
  endAt: number
  out: GainNode
  drums: AudioNode
  bass: AudioNode
  padL: AudioNode
  padR: AudioNode
  lead: AudioNode
  duck: GainNode
  layers: Layer[]
  nodes: AudioNode[]
  arp: readonly number[]
}

interface ThemeDef {
  bpm: number
  /** lowpass ranges (Hz) swept by intensity */
  bass: readonly [number, number]
  pad: readonly [number, number]
  lead: readonly [number, number]
  /** pad level at each kick (sidechain pump depth) */
  duck: number
  echo: number
  step(k: Kit, p: Player, t: number, x: number): void
}

// ---------- voices ----------

function kick(k: Kit, p: Player, t: number, gain: number, big: boolean) {
  osc(k, t, { f: big ? 165 : 150, fTo: big ? 42 : 48, fT: 0.09, a: 0.001, d: big ? 0.42 : 0.32, gain, dest: p.drums })
  osc(k, t, { type: 'triangle', f: 280, fTo: 110, fT: 0.03, a: 0.001, d: 0.05, gain: gain * 0.4, dest: p.drums })
  noise(k, t, { type: 'highpass', f: 3000, a: 0.001, d: 0.01, gain: gain * 0.12, dest: p.drums })
  const g = p.duck.gain
  g.setTargetAtTime(p.def.duck, t, 0.006)
  g.setTargetAtTime(1, t + 0.04, 0.09)
}

function hat(k: Kit, p: Player, t: number, gain: number, open: boolean, pan: number) {
  noise(k, t, { type: 'highpass', f: open ? 7000 : 8500, a: 0.001, d: open ? 0.13 : 0.035, gain, pan, dest: p.drums })
}

/** three fast bursts then a short tail */
function clapShape(g: AudioParam, t: number, v: number) {
  g.setValueAtTime(0, t)
  for (let i = 0; i < 3; i++) {
    const b = t + i * 0.011
    g.setValueAtTime(v, b)
    g.exponentialRampToValueAtTime(v * 0.2, b + 0.009)
  }
  g.setValueAtTime(v * 0.8, t + 0.033)
  g.exponentialRampToValueAtTime(0.0001, t + 0.22)
}

function clap(k: Kit, p: Player, t: number, gain: number) {
  noise(k, t, { type: 'bandpass', f: 1500, q: 1.1, d: 0.22, gain, shape: clapShape, send: 0.25, dest: p.drums })
}

function snare(k: Kit, p: Player, t: number, gain: number) {
  noise(k, t, { type: 'bandpass', f: 2200, q: 0.7, a: 0.001, d: 0.14, gain, send: 0.15, dest: p.drums })
  osc(k, t, { type: 'triangle', f: 200, fTo: 150, fT: 0.05, a: 0.001, d: 0.08, gain: gain * 0.6, dest: p.drums })
}

function crash(k: Kit, p: Player, t: number, gain: number) {
  noise(k, t, { type: 'highpass', f: 5000, a: 0.002, d: 1.8, gain, send: 0.3, dest: p.drums })
}

function tom(k: Kit, p: Player, t: number, f: number, gain: number) {
  osc(k, t, { f, fTo: f * 0.6, fT: 0.2, a: 0.001, d: 0.3, gain, dest: p.drums })
  osc(k, t, { type: 'triangle', f: f * 2, fTo: f * 1.1, fT: 0.05, a: 0.001, d: 0.08, gain: gain * 0.3, dest: p.drums })
}

function rim(k: Kit, p: Player, t: number, gain: number, pan: number) {
  osc(k, t, { type: 'triangle', f: 820, fTo: 560, fT: 0.02, a: 0.001, d: 0.04, gain, pan, dest: p.drums })
}

function shaker(k: Kit, p: Player, t: number, gain: number, pan: number) {
  noise(k, t, { type: 'bandpass', f: 9000, q: 1.5, a: 0.004, d: 0.05, gain, pan, dest: p.drums })
}

/** reverse-cymbal swell into the next downbeat */
function swell(k: Kit, p: Player, t: number, dur: number, gain: number) {
  noise(k, t, { type: 'highpass', f: 3000, fTo: 9000, a: dur, d: 0.04, gain, send: 0.3, dest: p.drums })
}

function bass(k: Kit, p: Player, t: number, m: number, gain: number, x: number) {
  osc(k, t, { type: 'sawtooth', f: mtof(m), a: 0.004, h: p.sd * 0.35, d: p.sd * 0.7, gain, lp: 260 + 1500 * x, lpTo: 180, lpT: p.sd, q: 4, dest: p.bass })
}

function pad(k: Kit, p: Player, t: number, notes: readonly number[], dur: number, gain: number, shimmer: boolean) {
  notes.forEach((m, i) => {
    osc(k, t, { type: 'sawtooth', f: mtof(m), det: [-9, 9], a: 0.3, h: dur - 0.3, d: 0.6, gain, dest: i % 2 ? p.padR : p.padL })
    if (shimmer) osc(k, t, { type: 'triangle', f: mtof(m + 12), a: 0.5, h: dur - 0.5, d: 0.8, gain: gain * 0.5, dest: i % 2 ? p.padL : p.padR })
  })
}

function pluck(k: Kit, p: Player, t: number, m: number, gain: number, pan: number) {
  osc(k, t, { type: 'sawtooth', f: mtof(m), det: [-6, 6], a: 0.003, d: 0.24, gain, lp: 4000, lpTo: 600, lpT: 0.2, q: 2, pan, dest: p.lead })
}

function chime(k: Kit, p: Player, t: number, m: number, gain: number, pan: number) {
  fm(k, t, { f: mtof(m), ratio: 3.5, index: 1.5, modD: 0.25, a: 0.002, d: 0.7, gain, pan, dest: p.lead })
}

function stab(k: Kit, p: Player, t: number, notes: readonly number[], gain: number) {
  notes.forEach((m, i) =>
    osc(k, t, { type: 'sawtooth', f: mtof(m), det: [-10, 10], a: 0.004, d: 0.16, gain, lp: 3500, lpTo: 800, lpT: 0.14, pan: i % 2 ? 0.3 : -0.3, dest: p.lead }),
  )
}

/** chord tones over two octaves, starting `lift` semitones above the pad */
function tonesOf(notes: readonly number[], lift: number, max: number): number[] {
  const sorted = [...notes].sort((a, b) => a - b)
  return [...sorted, ...sorted.map((m) => m + 12)].map((m) => m + lift).filter((m) => m <= max)
}

// ---------- base: dark neon synthwave, A minor, 108 BPM ----------

const BASE_BARS: readonly Bar[] = [
  { root: 45, pad: [57, 60, 64, 67] }, // Am7
  { root: 41, pad: [53, 57, 60, 64] }, // Fmaj7
  { root: 48, pad: [55, 60, 64, 67] }, // C
  { root: 43, pad: [55, 59, 62, 67] }, // G
  { root: 45, pad: [57, 60, 64, 71] }, // Am(add9)
  { root: 41, pad: [57, 60, 65, 67] }, // F(add9)
  { root: 38, pad: [57, 60, 62, 65] }, // Dm7
  { root: 40, pad: [56, 59, 62, 64] }, // E7
]
/** intensity each arp 16th needs: a sparse dotted figure at rest, full 16ths when hot */
const BASE_GATE = [0, 0.8, 0.5, 0.8, 0.3, 0.8, 0, 0.8, 0.45, 0.8, 0.15, 0.8, 0.3, 0.8, 0.6, 0.7]
const BASE_ARPS = [
  [0, 1, 2, 3, 4, 3, 2, 1, 0, 1, 2, 3, 5, 4, 3, 2],
  [0, 2, 4, 2, 1, 3, 5, 3, 2, 4, 6, 4, 3, 5, 7, 5],
  [4, 3, 2, 1, 0, 2, 4, 6, 7, 6, 5, 4, 3, 2, 1, 0],
  [0, 4, 2, 5, 1, 4, 3, 6, 2, 5, 3, 7, 4, 6, 5, 3],
]
/** rolling bass offsets per 16th of a beat (the downbeat is left to the kick) */
const ROLL = [0, 0, 12, 0]
const TURN = [0, 7, 12, 10]

function baseStep(k: Kit, p: Player, t: number, x: number) {
  const s = p.step % 16
  const bar = Math.floor(p.step / 16) % 8
  const cycle = Math.floor(p.step / 128)
  const b = BASE_BARS[bar]
  const beat = s >> 2
  const sub = s & 3
  if (s === 0) {
    if (bar === 0) p.arp = BASE_ARPS[cycle % BASE_ARPS.length]
    pad(k, p, t, b.pad, p.sd * 16, 0.04, false)
    if (bar === 0 && cycle > 0 && x > 0.3) crash(k, p, t, 0.05 + 0.07 * x)
  }
  const fill = bar === 7 && beat === 3 && (cycle % 2 === 1 || x > 0.55)
  if (sub === 0) kick(k, p, t, 0.8, false)
  if (s === 4 || s === 12) clap(k, p, t, 0.38 + 0.12 * x)
  if (fill) snare(k, p, t, 0.06 + sub * 0.05)
  if (sub === 2) hat(k, p, t, 0.06 + 0.05 * x, true, 0.15)
  else if (x > 0.4) hat(k, p, t, (x - 0.3) * (sub === 0 ? 0.08 : 0.13), false, sub === 1 ? -0.3 : 0.3)
  if (x > 0.65 && (s === 3 || s === 10 || s === 13)) rim(k, p, t, 0.08 * x, s === 10 ? 0.5 : -0.5)
  if (sub !== 0) {
    const turn = (bar === 3 || bar === 7) && beat === 3
    bass(k, p, t, b.root + (turn ? TURN : ROLL)[sub], sub === 2 ? 0.17 : 0.14, x)
  }
  if (x >= BASE_GATE[s]) {
    const tones = tonesOf(b.pad, 12, 96)
    pluck(k, p, t, tones[p.arp[s] % tones.length], 0.06 + 0.03 * x, s % 2 ? 0.35 : -0.35)
  }
}

// ---------- bonus: golden & triumphant, D Lydian/major, 124 BPM ----------

const BONUS_BARS: readonly Bar[] = [
  { root: 38, pad: [62, 66, 69, 73] }, // Dmaj7
  { root: 38, pad: [62, 64, 68, 71] }, // E/D, the Lydian lift
  { root: 47, pad: [59, 62, 66, 69] }, // Bm7
  { root: 43, pad: [59, 62, 66, 73] }, // Gmaj7#11
  { root: 42, pad: [62, 66, 69, 74] }, // D/F#
  { root: 40, pad: [59, 64, 68, 71] }, // E
  { root: 43, pad: [59, 62, 67, 71] }, // G
  { root: 45, pad: [61, 64, 69, 73] }, // A
]
const BONUS_ARPS = [
  [0, 2, 4, 6, 7, 6, 4, 2, 1, 3, 5, 7, 6, 4, 3, 1],
  [0, 1, 2, 4, 3, 4, 5, 6, 7, 6, 5, 4, 2, 3, 1, 2],
  [7, 5, 6, 4, 5, 3, 4, 2, 0, 2, 4, 5, 7, 6, 4, 2],
]
const TOMS = [210, 175, 145, 120]

function bonusStep(k: Kit, p: Player, t: number, x: number) {
  const s = p.step % 16
  const bar = Math.floor(p.step / 16) % 8
  const cycle = Math.floor(p.step / 128)
  const b = BONUS_BARS[bar]
  const beat = s >> 2
  const sub = s & 3
  if (s === 0) {
    if (bar === 0) p.arp = BONUS_ARPS[cycle % BONUS_ARPS.length]
    pad(k, p, t, b.pad, p.sd * 16, 0.032, true)
    if ((bar === 0 && cycle > 0) || bar === 4) crash(k, p, t, 0.05 + 0.07 * x)
  }
  const fill = bar === 7 && beat === 3 && (cycle % 2 === 1 || x > 0.5)
  if (sub === 0) kick(k, p, t, 0.95, true)
  if (s === 4 || s === 12) {
    clap(k, p, t, 0.3 + 0.1 * x)
    snare(k, p, t, 0.12)
  }
  if (fill) tom(k, p, t, TOMS[sub], 0.3)
  if (sub === 2) hat(k, p, t, 0.065 + 0.05 * x, true, 0.2)
  else if (x > 0.3) hat(k, p, t, (x - 0.2) * (sub === 0 ? 0.07 : 0.12), false, sub === 1 ? -0.3 : 0.3)
  if (x > 0.6 && sub % 2 === 1) shaker(k, p, t, 0.03 + 0.04 * x, sub === 1 ? 0.45 : -0.45)
  if (bar === 7 && s === 8 && x > 0.35) swell(k, p, t, p.sd * 8, 0.08 + 0.06 * x)
  // octave-pumping eighths, 16th pickups when hot
  if (sub % 2 === 0) bass(k, p, t, b.root + (sub === 2 ? 12 : 0), 0.16, x)
  else if (x > 0.6) bass(k, p, t, b.root + 12, 0.08, x)
  if (sub % 2 === 0 || x > 0.45) {
    const tones = tonesOf(b.pad, 12, 93)
    chime(k, p, t, tones[p.arp[s] % tones.length], (0.055 + 0.035 * x) * (sub % 2 ? 0.6 : 1), s % 2 ? 0.4 : -0.4)
  }
  if (x > 0.55 && (s === 6 || s === 14 || (x > 0.8 && s === 10))) stab(k, p, t, b.pad, 0.016 + 0.012 * x)
}

const THEMES: Record<Exclude<Theme, 'off'>, ThemeDef> = {
  base: { bpm: 108, bass: [450, 2400], pad: [1000, 5000], lead: [2000, 10000], duck: 0.3, echo: 0.35, step: baseStep },
  bonus: { bpm: 124, bass: [600, 3200], pad: [1600, 7000], lead: [3500, 12000], duck: 0.5, echo: 0.3, step: bonusStep },
}

function createPlayer(k: Kit, def: ThemeDef, fade: number): Player {
  const { ctx } = k
  const now = ctx.currentTime
  const sd = 60 / def.bpm / 4
  const nodes: AudioNode[] = []
  const add = <N extends AudioNode>(n: N) => {
    nodes.push(n)
    return n
  }
  const gain = (v: number) => {
    const g = add(ctx.createGain())
    g.gain.value = v
    return g
  }
  const lowpass = (f: number, q = 0.7) => {
    const n = add(ctx.createBiquadFilter())
    n.type = 'lowpass'
    n.frequency.value = f
    n.Q.value = q
    return n
  }
  const panner = (v: number) => {
    const n = add(ctx.createStereoPanner())
    n.pan.value = v
    return n
  }

  const out = gain(0)
  out.gain.setValueAtTime(0, now)
  out.gain.linearRampToValueAtTime(1, now + fade)
  out.connect(k.music)

  const drums = gain(1)
  drums.connect(out)

  const bassF = lowpass(def.bass[0], 1)
  bassF.connect(out)

  const padF = lowpass(def.pad[0])
  const duck = gain(1)
  const padSend = gain(0.3)
  const padL = panner(-0.5)
  const padR = panner(0.5)
  padL.connect(padF)
  padR.connect(padF)
  padF.connect(duck)
  duck.connect(out)
  duck.connect(padSend)
  padSend.connect(k.reverb)

  const leadF = lowpass(def.lead[0])
  const leadSend = gain(0.35)
  leadF.connect(out)
  leadF.connect(leadSend)
  leadSend.connect(k.reverb)

  // dotted-eighth echo whose repeats darken
  const echo = add(ctx.createDelay(1))
  echo.delayTime.value = sd * 3
  const echoLp = lowpass(2600)
  const fb = gain(def.echo)
  const echoOut = gain(0.3)
  leadF.connect(echo)
  echo.connect(echoLp)
  echoLp.connect(fb)
  fb.connect(echo)
  echoLp.connect(echoOut)
  echoOut.connect(out)

  const layer = (f: BiquadFilterNode, [lo, hi]: readonly [number, number]): Layer => ({ f, lo, hi, last: lo })
  return {
    def,
    sd,
    next: now + 0.05,
    step: 0,
    endAt: Infinity,
    out,
    drums,
    bass: bassF,
    padL,
    padR,
    lead: leadF,
    duck,
    layers: [layer(bassF, def.bass), layer(padF, def.pad), layer(leadF, def.lead)],
    nodes,
    arp: BASE_ARPS[0],
  }
}

export interface Music {
  /** crossfades to a theme; same theme is a no-op */
  set(theme: Theme): void
  setIntensity(x: number, instant?: boolean): void
  /** schedules every step that starts within `ahead` seconds (driven by a 25 ms interval) */
  pump(ahead?: number): void
  dispose(): void
}

export function createMusic(k: Kit, silent: () => boolean, auto = true): Music {
  let players: Player[] = []
  let current: Theme = 'off'
  let target = 0
  let level = 0
  let lastT = k.ctx.currentTime

  const fadeOut = (p: Player, now: number) => {
    const g = p.out.gain
    g.cancelScheduledValues(now)
    g.setValueAtTime(g.value, now)
    g.linearRampToValueAtTime(0, now + XFADE)
    p.endAt = now + XFADE
  }

  const pump = (ahead = LOOKAHEAD) => {
    const now = k.ctx.currentTime
    const dt = Math.max(0, now - lastT)
    lastT = now
    // rise quickly, settle back slowly
    level += (target - level) * (1 - Math.exp(-dt / (target > level ? 0.35 : 2.5)))
    const mute = silent()
    for (const p of players) {
      for (const l of p.layers) {
        const cut = l.lo * Math.pow(l.hi / l.lo, level)
        if (Math.abs(cut - l.last) > l.last * 0.02) {
          l.f.frequency.setTargetAtTime(cut, now, 0.08)
          l.last = cut
        }
      }
      // fell behind (blocked main thread): skip ahead instead of bursting
      if (p.next < now - 0.3) {
        const skip = Math.ceil((now - p.next) / p.sd)
        p.step += skip
        p.next += skip * p.sd
      }
      while (p.next < now + ahead && p.next < p.endAt) {
        if (!mute) {
          try {
            p.def.step(k, p, p.next, level)
          } catch {
            // a failed note must never stop the loop
          }
        }
        p.step++
        p.next += p.sd
      }
    }
    players = players.filter((p) => {
      if (now < p.endAt + 0.5) return true
      for (const n of p.nodes) n.disconnect()
      return false
    })
  }

  const timer = auto ? setInterval(pump, 25) : undefined

  return {
    set(theme) {
      if (theme === current) return
      current = theme
      const now = k.ctx.currentTime
      const live = players.filter((p) => p.endAt === Infinity)
      for (const p of live) fadeOut(p, now)
      if (theme !== 'off') players.push(createPlayer(k, THEMES[theme], live.length ? XFADE : 0.6))
    },
    setIntensity(x, instant = false) {
      target = x
      if (instant) level = x
    },
    pump,
    dispose() {
      if (timer !== undefined) clearInterval(timer)
      for (const p of players) for (const n of p.nodes) n.disconnect()
      players = []
    },
  }
}
