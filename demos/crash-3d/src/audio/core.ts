import type { FlightRig } from '../scene/rig'
import type { SfxApi } from './bindings'
import { createMusic } from './music'
import { createRocketVoice } from './rocket'
import { createSfx } from './sfx'

// the shared audio graph: buses for sfx and music, a reverb send, a muffle filter for the explosion's aftermath,
// a limiter and the mute fade at the end
export interface Bus {
  ctx: AudioContext
  sfx: AudioNode
  music: AudioNode
  reverb: AudioNode
  noise: AudioBuffer
  duck(level: number, hold: number): void
  muffle(seconds: number): void
}

export interface AudioSystem {
  ctx: AudioContext
  sfx: SfxApi
  unlock(): void
  setMuted(muted: boolean): void
  update(rig: FlightRig): void
  dispose(): void
}

const MUTE_FADE_S = 0.15
const MUSIC_LEVEL = 0.126 // -18 dB

export function createAudio(muted: boolean): AudioSystem {
  const ctx = new AudioContext({ latencyHint: 'interactive' })
  const gain = (v: number) => {
    const g = ctx.createGain()
    g.gain.value = v
    return g
  }

  const limiter = ctx.createDynamicsCompressor()
  limiter.threshold.value = -6
  limiter.knee.value = 6
  limiter.ratio.value = 12
  limiter.attack.value = 0.003
  limiter.release.value = 0.25
  const mute = gain(muted ? 0 : 1)
  limiter.connect(mute)
  mute.connect(ctx.destination)

  // after the blast everything sounds as if through cotton for a moment
  const muffle = ctx.createBiquadFilter()
  muffle.type = 'lowpass'
  muffle.frequency.value = 20000
  muffle.Q.value = 0.5
  muffle.connect(limiter)

  const master = gain(0.85)
  master.connect(muffle)
  const sfx = gain(1)
  sfx.connect(master)
  const music = gain(MUSIC_LEVEL)
  const duck = gain(1)
  music.connect(duck)
  duck.connect(master)

  const reverbIn = ctx.createBiquadFilter()
  reverbIn.type = 'highpass'
  reverbIn.frequency.value = 200
  const conv = ctx.createConvolver()
  conv.buffer = impulse(ctx, 3.2)
  const wet = gain(0.45)
  reverbIn.connect(conv)
  conv.connect(wet)
  wet.connect(master)

  const bus: Bus = {
    ctx,
    sfx,
    music,
    reverb: reverbIn,
    noise: whiteNoise(ctx, 3),
    duck(level, hold) {
      const now = ctx.currentTime
      duck.gain.cancelScheduledValues(now)
      duck.gain.setTargetAtTime(level, now, 0.05)
      duck.gain.setTargetAtTime(1, now + hold, 0.8)
    },
    muffle(seconds) {
      const now = ctx.currentTime
      const f = muffle.frequency
      f.cancelScheduledValues(now)
      f.setValueAtTime(320, now)
      f.exponentialRampToValueAtTime(20000, now + seconds)
    },
  }

  const rocket = createRocketVoice(bus)
  const tune = createMusic(bus)
  const fx = createSfx(bus)
  let started = false

  return {
    ctx,
    sfx: fx,
    unlock() {
      if (ctx.state !== 'running') void ctx.resume().catch(() => {})
      if (!started) {
        started = true
        tune.start()
      }
    },
    setMuted(m) {
      // a tab that came back while muted stays suspended (bindVisibility): unmuting wakes it
      if (!m && started && ctx.state === 'suspended') void ctx.resume().catch(() => {})
      const now = ctx.currentTime
      mute.gain.cancelScheduledValues(now)
      mute.gain.setTargetAtTime(m ? 0 : 1, now, MUTE_FADE_S / 3)
    },
    update(rig) {
      if (ctx.state !== 'running') return
      rocket.update(rig)
      tune.update(rig)
    },
    dispose() {
      rocket.stop()
      tune.stop()
      void ctx.close().catch(() => {})
    },
  }
}

// stereo decaying noise for the convolution reverb; the highs die first so the tail stays dark like a big hall
function impulse(ctx: BaseAudioContext, secs: number): AudioBuffer {
  const rate = ctx.sampleRate
  const len = Math.floor(rate * secs)
  const buf = ctx.createBuffer(2, len, rate)
  for (let c = 0; c < 2; c++) {
    const data = buf.getChannelData(c)
    let lp = 0
    for (let i = 0; i < len; i++) {
      const x = i / len
      lp += (0.85 - 0.75 * x) * (Math.random() * 2 - 1 - lp)
      data[i] = lp * Math.pow(1 - x, 2.2) * Math.min(1, i / (rate * 0.008))
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
