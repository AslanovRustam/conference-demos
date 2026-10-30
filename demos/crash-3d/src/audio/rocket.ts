import type { FlightRig } from '../scene/rig'
import type { Bus } from './core'
import { rocketMix } from './rocketMix'

const SMOOTH_S = 0.08 // parameter glide

// brown noise: integrated white noise, the rumble of a big engine
function brownNoise(ctx: BaseAudioContext, secs: number): AudioBuffer {
  const len = Math.floor(ctx.sampleRate * secs)
  const buf = ctx.createBuffer(2, len, ctx.sampleRate)
  for (let c = 0; c < 2; c++) {
    const d = buf.getChannelData(c)
    let last = 0
    for (let i = 0; i < len; i++) {
      last = (last + 0.02 * (Math.random() * 2 - 1)) / 1.02
      d[i] = last * 3.5
    }
  }
  return buf
}

// soft clipping: grit on the roar without harsh edges
function saturation(amount: number): Float32Array<ArrayBuffer> {
  const n = 1024
  const curve = new Float32Array(new ArrayBuffer(n * 4))
  for (let i = 0; i < n; i++) {
    const x = (i / (n - 1)) * 2 - 1
    curve[i] = Math.tanh(x * amount) / Math.tanh(amount)
  }
  return curve
}

// the engine, always running while the game runs: a roar (brown noise → lowpass → saturation), a sub rumble
// (two low sines) and a riser tone climbing with the multiplier. levels follow the rig every frame
export function createRocketVoice(bus: Bus) {
  const { ctx } = bus
  const src = ctx.createBufferSource()
  src.buffer = brownNoise(ctx, 4)
  src.loop = true
  const lp = ctx.createBiquadFilter()
  lp.type = 'lowpass'
  lp.Q.value = 0.7
  const shaper = ctx.createWaveShaper()
  shaper.curve = saturation(2.2)
  shaper.oversample = '2x'
  const roar = ctx.createGain()
  roar.gain.value = 0
  src.connect(lp)
  lp.connect(shaper)
  shaper.connect(roar)
  roar.connect(bus.sfx)

  const subA = ctx.createOscillator()
  subA.frequency.value = 38
  const subB = ctx.createOscillator()
  subB.frequency.value = 51
  const sub = ctx.createGain()
  sub.gain.value = 0
  subA.connect(sub)
  subB.connect(sub)
  sub.connect(bus.sfx)

  const riserOsc = ctx.createOscillator()
  riserOsc.type = 'sawtooth'
  const riserDetune = ctx.createOscillator()
  riserDetune.type = 'sawtooth'
  const riserBp = ctx.createBiquadFilter()
  riserBp.type = 'bandpass'
  riserBp.Q.value = 2.5
  const riser = ctx.createGain()
  riser.gain.value = 0
  riserOsc.connect(riserBp)
  riserDetune.connect(riserBp)
  riserBp.connect(riser)
  riser.connect(bus.sfx)
  riser.connect(bus.reverb)

  for (const s of [src, subA, subB, riserOsc, riserDetune]) s.start()

  return {
    update(rig: FlightRig) {
      const mix = rocketMix(rig)
      const now = ctx.currentTime
      roar.gain.setTargetAtTime(0.55 * mix.roar, now, SMOOTH_S)
      lp.frequency.setTargetAtTime(Math.max(60, mix.cutoff), now, SMOOTH_S)
      sub.gain.setTargetAtTime(0.32 * mix.sub, now, SMOOTH_S)
      riser.gain.setTargetAtTime(0.045 * mix.riser, now, 0.2)
      riserOsc.frequency.setTargetAtTime(mix.riserHz, now, 0.15)
      riserDetune.frequency.setTargetAtTime(mix.riserHz * 1.007, now, 0.15)
      riserBp.frequency.setTargetAtTime(mix.riserHz * 2, now, 0.15)
    },
    stop() {
      for (const s of [src, subA, subB, riserOsc, riserDetune]) s.stop()
    },
  }
}
