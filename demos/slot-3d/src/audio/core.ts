// Shared audio graph plus a tiny synth toolkit. Every note builds a few short-lived
// nodes that disconnect themselves once their sources end.

export interface Kit {
  ctx: BaseAudioContext
  /** sfx bus input */
  sfx: AudioNode
  /** music bus input */
  music: AudioNode
  /** reverb send input */
  reverb: AudioNode
  /** post-limiter gain used for mute fades */
  mute: GainNode
  noise: AudioBuffer
  /** live voice count, used to drop rapid SFX under load */
  voices: number
  /** dips the music bus to `level` for `hold` seconds, then recovers */
  duckMusic(level: number, hold: number): void
  /** resting music level (lowered while the anticipation riser runs) */
  setRest(level: number): void
}

export function createKit(ctx: BaseAudioContext, dest: AudioNode, muted: boolean): Kit {
  const gain = (v: number) => {
    const g = ctx.createGain()
    g.gain.value = v
    return g
  }

  const limiter = ctx.createDynamicsCompressor()
  limiter.threshold.value = -8
  limiter.knee.value = 6
  limiter.ratio.value = 10
  limiter.attack.value = 0.003
  limiter.release.value = 0.25
  const mute = gain(muted ? 0 : 1)
  const master = gain(0.8)
  master.connect(limiter)
  limiter.connect(mute)
  mute.connect(dest)

  const sfx = gain(0.9)
  sfx.connect(master)

  const music = gain(0.21)
  const duck = gain(1)
  music.connect(duck)
  duck.connect(master)

  // keep lows out of the reverb so kicks and thuds stay tight
  const reverb = ctx.createBiquadFilter()
  reverb.type = 'highpass'
  reverb.frequency.value = 240
  const conv = ctx.createConvolver()
  conv.buffer = impulse(ctx, 2.2)
  const wet = gain(0.5)
  reverb.connect(conv)
  conv.connect(wet)
  wet.connect(master)

  let rest = 1
  const glide = (to: number, tc: number) => {
    const p = duck.gain
    const now = ctx.currentTime
    p.cancelScheduledValues(now)
    p.setValueAtTime(p.value, now)
    p.setTargetAtTime(to, now, tc)
    return now
  }

  return {
    ctx,
    sfx,
    music,
    reverb,
    mute,
    noise: whiteNoise(ctx, 2),
    voices: 0,
    duckMusic(level, hold) {
      const now = glide(Math.min(level, rest), 0.04)
      duck.gain.setTargetAtTime(rest, now + hold, 0.45)
    },
    setRest(level) {
      rest = level
      glide(level, 0.15)
    },
  }
}

/** stereo decaying noise; highs die faster than lows so the tail stays warm */
function impulse(ctx: BaseAudioContext, secs: number): AudioBuffer {
  const rate = ctx.sampleRate
  const len = Math.floor(rate * secs)
  const pre = Math.floor(rate * 0.012)
  const buf = ctx.createBuffer(2, len, rate)
  for (let c = 0; c < 2; c++) {
    const data = buf.getChannelData(c)
    let lp = 0
    for (let i = pre; i < len; i++) {
      const x = i / len
      lp += (0.9 - 0.75 * x) * (Math.random() * 2 - 1 - lp)
      const fadeIn = Math.min(1, (i - pre) / (rate * 0.006))
      data[i] = lp * Math.pow(1 - x, 2.4) * fadeIn
    }
  }
  return buf
}

function whiteNoise(ctx: BaseAudioContext, secs: number): AudioBuffer {
  const len = Math.floor(ctx.sampleRate * secs)
  const buf = ctx.createBuffer(1, len, ctx.sampleRate)
  const data = buf.getChannelData(0)
  for (let i = 0; i < len; i++) data[i] = Math.random() * 2 - 1
  return buf
}

export const mtof = (m: number): number => 440 * Math.pow(2, (m - 69) / 12)
export const clamp = (x: number, lo: number, hi: number): number => Math.min(hi, Math.max(lo, x))
export const rand = (lo: number, hi: number): number => lo + Math.random() * (hi - lo)

export interface Route {
  dest: AudioNode
  pan?: number
  panTo?: number
  panT?: number
  /** reverb send level */
  send?: number
  /** extra destination at unity gain */
  aux?: AudioNode
}

export interface Shape {
  a?: number
  h?: number
  /** decay (or release after the hold) down to silence */
  d: number
  gain: number
  /** custom gain envelope replacing attack/hold/decay */
  shape?: (g: AudioParam, t: number, peak: number) => void
}

export interface OscOpts extends Route, Shape {
  type?: OscillatorType
  f: number
  fTo?: number
  fT?: number
  /** one oscillator per entry, detuned in cents */
  det?: readonly number[]
  lp?: number
  lpTo?: number
  lpT?: number
  q?: number
}

export interface FmOpts extends Route, Shape {
  f: number
  ratio: number
  /** peak modulation index; decays over `modD` for the bell-like brightness drop */
  index: number
  modD?: number
  fTo?: number
  fT?: number
}

export interface NoiseOpts extends Route, Shape {
  type?: BiquadFilterType
  f: number
  fTo?: number
  fT?: number
  q?: number
}

const attackOf = (o: Shape) => Math.max(0.001, o.a ?? 0.003)
const lengthOf = (o: Shape) => attackOf(o) + (o.h ?? 0) + o.d

function envelope(g: AudioParam, t: number, o: Shape) {
  if (o.shape) {
    o.shape(g, t, o.gain)
    return
  }
  const a = attackOf(o)
  const h = o.h ?? 0
  const peak = Math.max(0.0002, o.gain)
  g.setValueAtTime(0, t)
  g.linearRampToValueAtTime(peak, t + a)
  if (h > 0) g.setValueAtTime(peak, t + a + h)
  g.exponentialRampToValueAtTime(0.0001, t + a + h + o.d)
}

function sweep(p: AudioParam, t: number, from: number, to: number | undefined, dur: number) {
  p.setValueAtTime(from, t)
  if (to !== undefined && to !== from) p.exponentialRampToValueAtTime(Math.max(0.01, to), t + Math.max(0.005, dur))
}

function route(k: Kit, src: AudioNode, t: number, r: Route, nodes: AudioNode[]) {
  let out = src
  if (r.pan || r.panTo !== undefined) {
    const p = k.ctx.createStereoPanner()
    p.pan.setValueAtTime(clamp(r.pan ?? 0, -1, 1), t)
    if (r.panTo !== undefined) p.pan.linearRampToValueAtTime(clamp(r.panTo, -1, 1), t + (r.panT ?? 0.4))
    src.connect(p)
    nodes.push(p)
    out = p
  }
  out.connect(r.dest)
  if (r.aux) out.connect(r.aux)
  if (r.send) {
    const s = k.ctx.createGain()
    s.gain.value = r.send
    out.connect(s)
    s.connect(k.reverb)
    nodes.push(s)
  }
}

function finish(k: Kit, srcs: AudioScheduledSourceNode[], nodes: AudioNode[], end: number) {
  k.voices++
  for (const s of srcs) s.stop(end)
  srcs[0].onended = () => {
    k.voices--
    for (const s of srcs) s.disconnect()
    for (const n of nodes) n.disconnect()
  }
}

/** oscillator stack (optionally detuned / lowpassed / gliding) through an envelope */
export function osc(k: Kit, t: number, o: OscOpts): void {
  const { ctx } = k
  const len = lengthOf(o)
  const g = ctx.createGain()
  envelope(g.gain, t, o)
  const nodes: AudioNode[] = [g]
  let input: AudioNode = g
  if (o.lp) {
    const f = ctx.createBiquadFilter()
    f.type = 'lowpass'
    f.Q.value = o.q ?? 0.7
    sweep(f.frequency, t, o.lp, o.lpTo, o.lpT ?? len)
    f.connect(g)
    nodes.push(f)
    input = f
  }
  const srcs = (o.det ?? [0]).map((cents) => {
    const s = ctx.createOscillator()
    s.type = o.type ?? 'sine'
    s.detune.value = cents
    sweep(s.frequency, t, o.f, o.fTo, o.fT ?? len)
    s.connect(input)
    s.start(t)
    return s
  })
  route(k, g, t, o, nodes)
  finish(k, srcs, nodes, t + len + 0.02)
}

/** two-operator FM voice: bells, chimes, metallic clanks */
export function fm(k: Kit, t: number, o: FmOpts): void {
  const { ctx } = k
  const len = lengthOf(o)
  const car = ctx.createOscillator()
  const mod = ctx.createOscillator()
  const depth = ctx.createGain()
  const g = ctx.createGain()
  const mf = o.f * o.ratio
  const glideT = o.fT ?? len
  sweep(car.frequency, t, o.f, o.fTo, glideT)
  sweep(mod.frequency, t, mf, o.fTo === undefined ? undefined : o.fTo * o.ratio, glideT)
  const dev = Math.max(1, o.index * mf)
  depth.gain.setValueAtTime(dev, t)
  depth.gain.exponentialRampToValueAtTime(Math.max(0.5, dev * 0.03), t + Math.max(0.01, o.modD ?? len))
  mod.connect(depth)
  depth.connect(car.frequency)
  car.connect(g)
  envelope(g.gain, t, o)
  car.start(t)
  mod.start(t)
  const nodes: AudioNode[] = [depth, g]
  route(k, g, t, o, nodes)
  finish(k, [car, mod], nodes, t + len + 0.02)
}

/** filtered noise burst: hats, whooshes, crunches, rumble */
export function noise(k: Kit, t: number, o: NoiseOpts): void {
  const { ctx } = k
  const len = lengthOf(o)
  const src = ctx.createBufferSource()
  src.buffer = k.noise
  src.loop = true
  const f = ctx.createBiquadFilter()
  f.type = o.type ?? 'bandpass'
  f.Q.value = o.q ?? (f.type === 'bandpass' ? 1 : 0.7)
  sweep(f.frequency, t, o.f, o.fTo, o.fT ?? len)
  const g = ctx.createGain()
  envelope(g.gain, t, o)
  src.connect(f)
  f.connect(g)
  src.start(t, Math.random() * (k.noise.duration - 0.05))
  const nodes: AudioNode[] = [f, g]
  route(k, g, t, o, nodes)
  finish(k, [src], nodes, t + len + 0.02)
}

/** pitch-dropping sine plus a short mid "knock" so the hit reads on laptop speakers */
export function thump(k: Kit, t: number, f: number, d: number, gain: number, dest: AudioNode, pan = 0): void {
  osc(k, t, { f, fTo: f * 0.3, fT: Math.min(0.12, d * 0.45), a: 0.001, d, gain: gain * 0.8, pan, dest })
  osc(k, t, { type: 'triangle', f: f * 2, fTo: f * 0.8, fT: 0.05, a: 0.001, d: Math.min(0.1, d * 0.5), gain: gain * 0.55, pan, dest })
}
