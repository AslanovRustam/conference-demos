import type { Sfx } from './audio'
import { clamp, fm, mtof, noise, osc, rand, thump, type Kit } from './core'

type SfxFn = (k: Kit, t: number, arg: number | undefined) => void

const num = (x: number | undefined, fallback: number) => (x !== undefined && Number.isFinite(x) ? x : fallback)

const bell = (k: Kit, t: number, m: number, d: number, gain: number, pan = 0, send = 0.4, index = 1.4) =>
  fm(k, t, { f: mtof(m), ratio: 3.5, index, modD: d * 0.5, a: 0.002, d, gain, pan, send, dest: k.sfx })

const crash = (k: Kit, t: number, d: number, gain: number) =>
  noise(k, t, { type: 'highpass', f: 5200, a: 0.002, d, gain, send: 0.35, dest: k.sfx })

/** bell arpeggio spread left to right */
function bellRun(k: Kit, t: number, notes: readonly number[], gap: number, d: number, gain: number, send: number, index = 1.2) {
  const n = notes.length
  notes.forEach((m, i) => bell(k, t + i * gap, m, d, gain, n > 1 ? -0.6 + (1.2 * i) / (n - 1) : 0, send, index))
}

const sparkle = (k: Kit, t: number, d: number, gain: number, pan = 0) =>
  noise(k, t, { type: 'highpass', f: 7500, a: 0.03, d, gain, pan, send: 0.7, dest: k.sfx })

interface ChordOpts {
  a?: number
  h?: number
  d: number
  gain: number
  lp: number
  lpTo?: number
  lpT?: number
  send?: number
}

/** wide detuned-saw chord, voices alternating left/right */
function chord(k: Kit, t: number, notes: readonly number[], o: ChordOpts) {
  notes.forEach((m, i) =>
    osc(k, t, {
      type: 'sawtooth',
      f: mtof(m),
      det: [-11, 11],
      a: o.a ?? 0.004,
      h: o.h,
      d: o.d,
      gain: o.gain,
      lp: o.lp,
      lpTo: o.lpTo,
      lpT: o.lpT,
      q: 0.8,
      pan: (i % 2 ? 1 : -1) * Math.min(0.6, 0.15 + i * 0.1),
      send: o.send ?? 0.3,
      dest: k.sfx,
    }),
  )
}

/** C-major pentatonic from G4 so every cascade step stays in key with the A-minor music */
const WIN_SCALE = [67, 69, 72, 74, 76, 79, 81, 84, 86, 88, 91, 93, 96]
const SCATTER_NOTES = [69, 73, 76, 81, 85]
const MULTI_NOTES = [64, 67, 69, 72, 76]
const D_MAJOR = [62, 66, 69, 74]
/** bVI - bVII - I: the bigger the tier, the longer the climb into C major */
const TIER_CHORDS = [
  [44, 56, 60, 63, 68],
  [46, 58, 62, 65, 70],
  [48, 60, 64, 67, 72],
]

export const SFX: Record<Sfx, SfxFn> = {
  click(k, t) {
    osc(k, t, { type: 'triangle', f: 1900, fTo: 1150, fT: 0.025, a: 0.001, d: 0.035, gain: 0.18, dest: k.sfx })
    noise(k, t, { type: 'highpass', f: 6000, a: 0.001, d: 0.012, gain: 0.08, dest: k.sfx })
  },

  spinStart(k, t) {
    const S = k.sfx
    noise(k, t, { type: 'bandpass', f: 350, fTo: 4500, fT: 0.32, q: 1.4, a: 0.1, d: 0.28, gain: 0.8, pan: -0.6, panTo: 0.6, panT: 0.4, send: 0.2, dest: S })
    osc(k, t, { type: 'sawtooth', f: 90, fTo: 720, fT: 0.22, det: [-14, 14], a: 0.008, d: 0.26, gain: 0.1, lp: 500, lpTo: 5000, lpT: 0.2, q: 6, send: 0.15, dest: S })
    osc(k, t + 0.02, { type: 'square', f: 2400, fTo: 3600, fT: 0.08, a: 0.002, d: 0.08, gain: 0.035, pan: 0.3, send: 0.3, dest: S })
    thump(k, t, 130, 0.2, 0.35, S)
  },

  reelStop(k, t, arg) {
    const S = k.sfx
    const c = clamp(Math.round(num(arg, 0)), 0, 5)
    const p = (1 + (2.5 - c) * 0.03) * rand(0.985, 1.015)
    const pan = (c - 2.5) * 0.16
    osc(k, t, { f: 165 * p, fTo: 50 * p, fT: 0.1, a: 0.001, d: 0.3, gain: 0.32, pan, dest: S })
    osc(k, t, { type: 'triangle', f: 330 * p, fTo: 140 * p, fT: 0.05, a: 0.001, d: 0.09, gain: 0.5, pan, dest: S })
    osc(k, t, { f: 720 * p, fTo: 460 * p, fT: 0.02, a: 0.001, d: 0.035, gain: 0.2, pan, dest: S })
    noise(k, t, { type: 'lowpass', f: 3800, fTo: 500, fT: 0.05, a: 0.001, d: 0.06, gain: 0.6, pan, send: 0.06, dest: S })
    fm(k, t + 0.004, { f: 1180 * p, ratio: 1.47, index: 1.4, modD: 0.03, a: 0.001, d: 0.06, gain: 0.09, pan, dest: S })
  },

  scatterLand(k, t, arg) {
    const S = k.sfx
    const i = clamp(Math.round(num(arg, 1)), 1, 5) - 1
    const m = SCATTER_NOTES[i]
    const lift = 1 + i * 0.12
    thump(k, t, 150, 0.45 + i * 0.1, 0.6, S)
    noise(k, t, { type: 'bandpass', f: 2600, q: 2.5, a: 0.001, d: 0.05, gain: 0.3, dest: S })
    fm(k, t, { f: mtof(m), ratio: 3.5, index: 2.2, modD: 0.5, a: 0.002, d: 1.3 + i * 0.3, gain: 0.14 * lift, send: 0.35 + i * 0.08, dest: S })
    fm(k, t, { f: mtof(m + 12), ratio: 2, index: 1, a: 0.002, d: 0.8 + i * 0.2, gain: 0.05 * lift, pan: -0.35, send: 0.4, dest: S })
    if (i >= 1) bell(k, t + 0.07, m + 7, 0.9 + i * 0.2, 0.05 * lift, 0.4, 0.5)
    if (i >= 2) {
      sparkle(k, t, 0.5 + i * 0.25, 0.035 * i, 0.2)
      osc(k, t, { type: 'sawtooth', f: mtof(m - 24), det: [-10, 10], a: 0.005, d: 0.9 + i * 0.2, gain: 0.05 + 0.01 * i, lp: 3000, lpTo: 250, send: 0.3, dest: S })
      k.duckMusic(0.6, 0.6)
    }
    if (i >= 3) crash(k, t, 1.2 + i * 0.3, 0.05 + 0.02 * i)
  },

  win(k, t, arg) {
    const S = k.sfx
    const s = clamp(Math.round(num(arg, 0)), 0, 7)
    const notes = [0, 2, 4, 5].map((x) => WIN_SCALE[x + s])
    notes.forEach((m, j) => {
      const tt = t + j * 0.05
      const pan = -0.45 + j * 0.3
      fm(k, tt, { f: mtof(m), ratio: 4, index: 1.4 - s * 0.1, modD: 0.2, a: 0.002, d: 0.45 + s * 0.04, gain: 0.17, pan, send: 0.35, dest: S })
      osc(k, tt, { type: 'triangle', f: mtof(m), a: 0.002, d: 0.22, gain: 0.09, pan, dest: S })
    })
    sparkle(k, t + 0.05, 0.35 + s * 0.05, 0.05 + s * 0.008, 0.3)
    if (s >= 2) {
      osc(k, t, { type: 'sawtooth', f: mtof(notes[0] - 12), det: [-9, 9], a: 0.005, d: 0.45, gain: 0.045 + s * 0.006, lp: 2500, lpTo: 600, send: 0.25, dest: S })
    }
  },

  explode(k, t) {
    const S = k.sfx
    noise(k, t, { type: 'highpass', f: 1800, a: 0.001, d: 0.2, gain: 0.5, send: 0.2, dest: S })
    noise(k, t, { type: 'bandpass', f: 5200, fTo: 2400, q: 5, a: 0.001, d: 0.28, gain: 0.5, pan: rand(-0.4, 0.4), send: 0.3, dest: S })
    noise(k, t, { type: 'lowpass', f: 1000, fTo: 180, a: 0.001, d: 0.14, gain: 0.45, dest: S })
    thump(k, t, 200, 0.16, 0.3, S)
    for (let i = 0; i < 5; i++) {
      fm(k, t + 0.008 + Math.random() * 0.15, {
        f: rand(1900, 4200),
        ratio: 2.76,
        index: 1.1,
        modD: 0.05,
        a: 0.001,
        d: rand(0.07, 0.2),
        gain: 0.07,
        pan: rand(-0.8, 0.8),
        send: 0.4,
        dest: S,
      })
    }
  },

  drop(k, t) {
    for (let i = 0; i < 2; i++) {
      const tt = t + i * rand(0.035, 0.06)
      const pan = rand(-0.5, 0.5)
      thump(k, tt, rand(125, 160), 0.12, 0.4, k.sfx, pan)
      noise(k, tt, { type: 'lowpass', f: 1400, a: 0.001, d: 0.035, gain: 0.16, pan, dest: k.sfx })
    }
  },

  multiplier(k, t, arg) {
    const S = k.sfx
    const l = clamp(Math.log2(Math.max(1, num(arg, 2))) / 6, 0, 1)
    const root = MULTI_NOTES[Math.round(l * 4)]
    osc(k, t, { type: 'sawtooth', f: mtof(root - 12), fTo: mtof(root + 12), fT: 0.11, det: [-12, 12], a: 0.004, d: 0.2, gain: 0.08, lp: 1200 + 2500 * l, lpTo: 5000 + 6000 * l, lpT: 0.1, q: 3, send: 0.2, dest: S })
    const th = t + 0.09
    thump(k, th, 190, 0.22, 0.4 + 0.25 * l, S)
    fm(k, th, { f: mtof(root + 12), ratio: 2, index: 1.2 + l, modD: 0.3, a: 0.002, d: 0.7 + 0.6 * l, gain: 0.14, pan: -0.25, send: 0.35 + 0.2 * l, dest: S })
    fm(k, th, { f: mtof(root + 19), ratio: 2, index: 1, modD: 0.3, a: 0.002, d: 0.6 + 0.6 * l, gain: 0.09, pan: 0.25, send: 0.4, dest: S })
    if (l > 0.4) sparkle(k, th, 0.5 + l, 0.03 + 0.04 * l)
    if (l > 0.65) {
      bell(k, th + 0.06, root + 24, 1.1, 0.05, 0.45, 0.6, 0.8)
      chord(k, th, [root - 12, root - 5, root, root + 7], { d: 0.9, gain: 0.03, lp: 4000, lpTo: 600 })
    }
  },

  bonusTrigger(k, t) {
    const S = k.sfx
    k.duckMusic(0.3, 1.4)
    osc(k, t, { f: 110, fTo: 32, fT: 0.35, a: 0.002, d: 1.4, gain: 0.8, dest: S })
    osc(k, t, { type: 'triangle', f: 260, fTo: 70, fT: 0.15, a: 0.001, d: 0.35, gain: 0.3, dest: S })
    noise(k, t, { type: 'lowpass', f: 9000, fTo: 150, fT: 1, q: 0.8, a: 0.002, d: 1.3, gain: 0.45, send: 0.5, dest: S })
    chord(k, t, [45, 52, 57, 61, 64, 69], { a: 0.005, h: 0.1, d: 1.8, gain: 0.04, lp: 6000, lpTo: 400, lpT: 1.8, send: 0.45 })
    bellRun(k, t + 0.08, [81, 85, 88, 93, 97], 0.07, 1.8, 0.055, 0.7)
    sparkle(k, t + 0.1, 1.6, 0.07)
    crash(k, t, 2, 0.08)
  },

  vaultOpen(k, t) {
    const S = k.sfx
    k.duckMusic(0.45, 3)
    // combination dial: decelerating clicks, then the tumbler lands
    let tc = t
    for (let i = 0; i < 9; i++) {
      const pan = -0.3 + i * 0.07
      noise(k, tc, { type: 'bandpass', f: rand(3000, 3700), q: 8, a: 0.001, d: 0.025, gain: 0.4, pan, dest: S })
      fm(k, tc, { f: rand(1750, 1950), ratio: 1.41, index: 2, a: 0.001, d: 0.04, gain: 0.04, pan, send: 0.15, dest: S })
      tc += 0.065 + i * 0.006
    }
    const tl = t + 0.85
    bell(k, tl, 88, 0.5, 0.06, 0.2, 0.4, 2)
    thump(k, tl, 260, 0.1, 0.3, S)
    // four bolts retracting, alternating sides
    for (let i = 0; i < 4; i++) {
      const tb = t + 1 + i * 0.2
      const pan = i % 2 ? 0.55 : -0.55
      noise(k, tb, { type: 'bandpass', f: 1800, fTo: 700, fT: 0.12, q: 3, a: 0.01, d: 0.12, gain: 0.28, pan, dest: S })
      thump(k, tb + 0.12, 150, 0.22, 0.45, S, pan * 0.6)
      fm(k, tb + 0.12, { f: 420, ratio: 2.41, index: 3, modD: 0.06, a: 0.001, d: 0.18, gain: 0.1, pan, send: 0.25, dest: S })
    }
    // low rumble of the door mass
    noise(k, t + 0.3, { type: 'lowpass', f: 140, fTo: 420, fT: 2, q: 1, a: 1.2, h: 0.5, d: 0.6, gain: 0.8, dest: S })
    osc(k, t + 0.3, { type: 'sawtooth', f: 41, fTo: 55, fT: 2.2, det: [-8, 8], a: 1.2, h: 0.5, d: 0.6, gain: 0.1, lp: 160, lpTo: 420, dest: S })
    // door releases: heavy thunk + pressure hiss
    const td = t + 1.95
    thump(k, td, 95, 0.8, 0.8, S)
    noise(k, td, { type: 'highpass', f: 3000, fTo: 1200, a: 0.005, d: 0.7, gain: 0.16, send: 0.3, dest: S })
    // whoosh into golden light (D major, the bonus key)
    noise(k, td + 0.05, { type: 'bandpass', f: 300, fTo: 7000, fT: 1, q: 1.4, a: 0.6, h: 0.2, d: 0.6, gain: 0.5, pan: -0.5, panTo: 0.5, panT: 1.1, send: 0.5, dest: S })
    chord(k, td + 0.1, [50, 57, 62, 66, 69, 74], { a: 0.9, h: 0.1, d: 1.2, gain: 0.028, lp: 600, lpTo: 5000, lpT: 1, send: 0.5 })
    bellRun(k, t + 2.85, [86, 90, 93, 98], 0.06, 1.3, 0.045, 0.7, 1.1)
    sparkle(k, t + 2.8, 1.2, 0.05)
  },

  bigWinTier(k, t, arg) {
    const S = k.sfx
    const n = clamp(Math.round(num(arg, 1)), 1, 3)
    const chords = TIER_CHORDS.slice(3 - n)
    const gap = 0.17
    k.duckMusic(0.35, 1 + n * 0.5)
    chords.forEach((ch, i) => {
      const tt = t + i * gap
      const last = i === chords.length - 1
      chord(k, tt, ch.slice(1), {
        a: 0.004,
        h: last ? 0.2 + n * 0.15 : 0.05,
        d: last ? 0.9 + n * 0.35 : 0.14,
        gain: 0.036,
        lp: 5200,
        lpTo: last ? 900 : 1600,
        lpT: last ? 1 + n * 0.3 : 0.2,
        send: 0.3,
      })
      osc(k, tt, { type: 'triangle', f: mtof(ch[0]), a: 0.004, h: last ? 0.3 : 0.05, d: last ? 0.8 : 0.12, gain: 0.25, dest: S })
      thump(k, tt, last ? 150 : 180, last ? 0.5 : 0.18, last ? 0.75 : 0.45, S)
    })
    const tl = t + (chords.length - 1) * gap
    bellRun(k, tl + 0.04, [72, 76, 79, 84, 88, 91].slice(0, 3 + n), 0.055, 0.9 + n * 0.25, 0.05, 0.5, 1.4)
    crash(k, tl, 1.2 + n * 0.4, 0.07 + n * 0.025)
    sparkle(k, tl + 0.05, 0.8 + n * 0.4, 0.03 + n * 0.015)
    if (n === 3) {
      osc(k, tl, { f: 80, fTo: 30, fT: 0.6, a: 0.002, d: 1.5, gain: 0.6, dest: S })
      chord(k, tl, [36, 43, 48], { a: 0.01, h: 0.4, d: 1.4, gain: 0.04, lp: 1200, lpTo: 300, send: 0.2 })
    }
  },

  coin(k, t) {
    const S = k.sfx
    const f = rand(2500, 3300)
    const pan = rand(-0.6, 0.6)
    osc(k, t, { f, det: [0, 560], a: 0.001, d: rand(0.12, 0.2), gain: 0.065, pan, send: 0.15, dest: S })
    osc(k, t + rand(0.05, 0.08), { f: f * 1.06, det: [0, 610], a: 0.001, d: 0.08, gain: 0.03, pan, dest: S })
    noise(k, t, { type: 'highpass', f: 8000, a: 0.001, d: 0.01, gain: 0.05, pan, dest: S })
  },

  countTick(k, t, arg) {
    const f = 720 * Math.pow(2, clamp(num(arg, 0), 0, 1) * 1.5)
    osc(k, t, { type: 'triangle', f, fTo: f * 0.94, fT: 0.03, a: 0.001, d: 0.035, gain: 0.14, dest: k.sfx })
  },

  countEnd(k, t) {
    const S = k.sfx
    thump(k, t, 170, 0.35, 0.75, S)
    noise(k, t, { type: 'bandpass', f: 1700, q: 0.9, a: 0.001, d: 0.16, gain: 0.5, send: 0.25, dest: S })
    chord(k, t, [60, 64, 67, 72], { a: 0.003, h: 0.05, d: 0.45, gain: 0.045, lp: 6000, lpTo: 1000, send: 0.3 })
    osc(k, t, { type: 'triangle', f: mtof(48), a: 0.003, d: 0.4, gain: 0.2, dest: S })
    bell(k, t, 84, 0.9, 0.09, -0.3, 0.45, 1.2)
    bell(k, t + 0.04, 91, 0.8, 0.065, 0.3, 0.5, 1)
    crash(k, t, 0.9, 0.05)
  },

  freeSpinsAward(k, t) {
    const S = k.sfx
    k.duckMusic(0.35, 1.8)
    const brass = (tt: number, m: number, h: number, gain: number, pan: number) =>
      osc(k, tt, { type: 'sawtooth', f: mtof(m), det: [-9, 0, 9], a: 0.015, h, d: 0.25, gain, lp: 600, lpTo: 3200, lpT: 0.12, q: 1.5, pan, send: 0.3, dest: S })
    const tri = 0.12
    for (let i = 0; i < 3; i++) {
      const tt = t + i * tri
      brass(tt, 69, 0.05, 0.045, -0.2)
      brass(tt, 62, 0.05, 0.03, 0.2)
      thump(k, tt, 140 + i * 15, 0.15, 0.35, S)
    }
    const td = t + 3 * tri
    D_MAJOR.forEach((m, i) => brass(td, m, 0.75, 0.035, i % 2 ? 0.45 : -0.45))
    brass(td, 50, 0.75, 0.04, 0)
    osc(k, td, { type: 'triangle', f: mtof(38), a: 0.005, h: 0.6, d: 0.5, gain: 0.25, dest: S })
    thump(k, td, 150, 0.5, 0.8, S)
    crash(k, td, 1.6, 0.09)
    bellRun(k, td + 0.05, [74, 78, 81, 86, 90, 93], 0.06, 0.9, 0.055, 0.5, 1.4)
    sparkle(k, td + 0.2, 1.2, 0.05)
  },

  bonusEnd(k, t) {
    const S = k.sfx
    k.duckMusic(0.5, 2.5)
    const pad = (tt: number, notes: readonly number[], a: number, h: number, d: number) =>
      notes.forEach((m, i) =>
        osc(k, tt, { type: 'sawtooth', f: mtof(m), det: [-8, 8], a, h, d, gain: 0.026, lp: 1600, q: 0.5, pan: i % 2 ? 0.4 : -0.4, send: 0.5, dest: S }),
      )
    pad(t, [55, 59, 62, 66, 69], 0.35, 0.7, 0.7)
    osc(k, t, { type: 'triangle', f: mtof(43), a: 0.3, h: 0.7, d: 0.6, gain: 0.18, dest: S })
    const t2 = t + 1.15
    pad(t2, [50, 57, 62, 66, 69, 76], 0.45, 1.3, 2.2)
    osc(k, t2, { type: 'triangle', f: mtof(38), a: 0.4, h: 1.2, d: 1.8, gain: 0.2, dest: S })
    bellRun(k, t2 + 0.1, [81, 86, 90, 93], 0.12, 2, 0.04, 0.6, 1)
  },
}

/** tension riser: detuned saws + noise climbing, tremolo speeding up. Returns an idempotent stop. */
export function anticipation(k: Kit): () => void {
  const { ctx } = k
  const t = ctx.currentTime + 0.01
  const safety = t + 12
  const nodes: AudioNode[] = []
  const srcs: AudioScheduledSourceNode[] = []
  const add = <N extends AudioNode>(n: N) => {
    nodes.push(n)
    return n
  }

  const out = add(ctx.createGain())
  out.gain.setValueAtTime(0, t)
  out.gain.linearRampToValueAtTime(0.5, t + 0.3)
  out.gain.setTargetAtTime(1, t + 0.3, 1.2)
  out.connect(k.sfx)
  const send = add(ctx.createGain())
  send.gain.value = 0.3
  out.connect(send)
  send.connect(k.reverb)

  const trem = add(ctx.createGain())
  trem.gain.value = 0.65
  trem.connect(out)
  const lfo = ctx.createOscillator()
  lfo.frequency.setValueAtTime(5, t)
  lfo.frequency.exponentialRampToValueAtTime(18, t + 5)
  const depth = add(ctx.createGain())
  depth.gain.value = 0.35
  lfo.connect(depth)
  depth.connect(trem.gain)
  srcs.push(lfo)

  const lp = add(ctx.createBiquadFilter())
  lp.type = 'lowpass'
  lp.Q.value = 4
  lp.frequency.setValueAtTime(500, t)
  lp.frequency.setTargetAtTime(5000, t, 1.8)
  lp.connect(trem)
  const tone = add(ctx.createGain())
  tone.gain.value = 0.05
  tone.connect(lp)
  for (const [base, det] of [[110, -14], [110, 14], [165, 6], [220, -6]] as const) {
    const o = ctx.createOscillator()
    o.type = 'sawtooth'
    o.detune.value = det
    o.frequency.setValueAtTime(base, t)
    o.frequency.exponentialRampToValueAtTime(base * 4, t + 5)
    o.connect(tone)
    srcs.push(o)
  }

  const hiss = ctx.createBufferSource()
  hiss.buffer = k.noise
  hiss.loop = true
  const bp = add(ctx.createBiquadFilter())
  bp.type = 'bandpass'
  bp.Q.value = 1.2
  bp.frequency.setValueAtTime(600, t)
  bp.frequency.exponentialRampToValueAtTime(8000, t + 5)
  const hissGain = add(ctx.createGain())
  hissGain.gain.value = 0.14
  hiss.connect(bp)
  bp.connect(hissGain)
  hissGain.connect(trem)
  srcs.push(hiss)

  for (const s of srcs) {
    s.start(t)
    s.stop(safety)
  }
  k.voices++
  k.setRest(0.55)

  let stopped = false
  const release = () => {
    if (stopped) return
    stopped = true
    k.setRest(1)
  }
  srcs[0].onended = () => {
    k.voices--
    release()
    for (const s of srcs) s.disconnect()
    for (const n of nodes) n.disconnect()
  }

  return () => {
    if (stopped) return
    release()
    try {
      const now = ctx.currentTime
      out.gain.cancelScheduledValues(now)
      out.gain.setValueAtTime(out.gain.value, now)
      out.gain.linearRampToValueAtTime(0, now + 0.2)
      for (const s of srcs) s.stop(now + 0.25)
    } catch {
      // context closed or already stopped: nothing left to fade
    }
  }
}
