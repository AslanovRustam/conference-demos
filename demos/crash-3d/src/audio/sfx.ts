import type { StageId } from '../core/stages'
import type { SfxApi } from './bindings'
import type { Bus } from './core'

const rand = (lo: number, hi: number) => lo + Math.random() * (hi - lo)

// one-shots, all synthesized: every call builds a few short-lived nodes that drop out once they finish
export function createSfx(bus: Bus): SfxApi {
  const { ctx } = bus

  // a burst of filtered noise with an envelope
  const noise = (o: { at?: number; dur: number; type: BiquadFilterType; f0: number; f1?: number; q?: number; gain: number; attack?: number; send?: number }) => {
    const t = ctx.currentTime + (o.at ?? 0)
    const src = ctx.createBufferSource()
    src.buffer = bus.noise
    src.playbackRate.value = rand(0.9, 1.1)
    const f = ctx.createBiquadFilter()
    f.type = o.type
    f.Q.value = o.q ?? 0.8
    f.frequency.setValueAtTime(o.f0, t)
    if (o.f1) f.frequency.exponentialRampToValueAtTime(o.f1, t + o.dur)
    const g = ctx.createGain()
    g.gain.setValueAtTime(0, t)
    g.gain.linearRampToValueAtTime(o.gain, t + (o.attack ?? 0.005))
    g.gain.exponentialRampToValueAtTime(0.0001, t + o.dur)
    src.connect(f)
    f.connect(g)
    g.connect(bus.sfx)
    if (o.send) {
      const s = ctx.createGain()
      s.gain.value = o.send
      g.connect(s)
      s.connect(bus.reverb)
    }
    src.start(t, rand(0, 1.5))
    src.stop(t + o.dur + 0.05)
  }

  // a pitched tone with an envelope and an optional glide
  const tone = (o: { at?: number; dur: number; type?: OscillatorType; f0: number; f1?: number; gain: number; attack?: number; send?: number }) => {
    const t = ctx.currentTime + (o.at ?? 0)
    const osc = ctx.createOscillator()
    osc.type = o.type ?? 'sine'
    osc.frequency.setValueAtTime(o.f0, t)
    if (o.f1) osc.frequency.exponentialRampToValueAtTime(o.f1, t + o.dur)
    const g = ctx.createGain()
    g.gain.setValueAtTime(0, t)
    g.gain.linearRampToValueAtTime(o.gain, t + (o.attack ?? 0.004))
    g.gain.exponentialRampToValueAtTime(0.0001, t + o.dur)
    osc.connect(g)
    g.connect(bus.sfx)
    if (o.send) {
      const s = ctx.createGain()
      s.gain.value = o.send
      g.connect(s)
      s.connect(bus.reverb)
    }
    osc.start(t)
    osc.stop(t + o.dur + 0.05)
  }

  return {
    // mission-control beeps; the last one higher, like the go
    countdown(n) {
      const hz = n === 1 ? 1320 : 880
      tone({ dur: 0.32, f0: hz, gain: 0.16, send: 0.25 })
      tone({ dur: 0.32, f0: hz * 2, gain: 0.03 })
    },
    // ignition: a deep thump and a wall of noise opening up
    liftoff() {
      tone({ dur: 1.4, f0: 70, f1: 32, gain: 0.55, attack: 0.02 })
      noise({ dur: 2.6, type: 'lowpass', f0: 180, f1: 2400, gain: 0.32, attack: 0.15, send: 0.3 })
    },
    // a soft rushing sweep as the rocket breaks into a new stage of the sky
    stage(s: StageId) {
      noise({ dur: 1.3, type: 'bandpass', f0: 400, f1: 3200, q: 1.2, gain: 0.08 + 0.02 * s, attack: 0.35, send: 0.5 })
      if (s === 5) {
        // the warp: a swelling chord dropping into a low hum
        tone({ dur: 2.4, type: 'sawtooth', f0: 220, f1: 55, gain: 0.06, attack: 0.6, send: 0.6 })
        tone({ dur: 2.4, type: 'sawtooth', f0: 330, f1: 82, gain: 0.04, attack: 0.6, send: 0.6 })
      }
    },
    // the pyro bolts firing, then the capsule whooshing off
    cashout() {
      noise({ dur: 0.18, type: 'highpass', f0: 1800, gain: 0.5 })
      tone({ dur: 0.25, f0: 140, f1: 60, gain: 0.35 })
      noise({ at: 0.06, dur: 0.9, type: 'bandpass', f0: 2600, f1: 500, q: 1.5, gain: 0.16, attack: 0.05, send: 0.3 })
    },
    // the canopy snapping open
    parachute() {
      noise({ at: 0.6, dur: 0.25, type: 'lowpass', f0: 900, gain: 0.22 })
      noise({ at: 1.2, dur: 0.5, type: 'lowpass', f0: 600, f1: 250, gain: 0.32, attack: 0.02 })
      noise({ at: 1.3, dur: 1.6, type: 'bandpass', f0: 300, q: 3, gain: 0.05, attack: 0.2 })
    },
    // the boom: a sub drop and a rumbling burst, the world muffled for a moment, then a ringing ear
    // far: the player cashed out and watches the capsule, the rocket goes off somewhere above: a soft, dull thud
    crash(stage, far) {
      if (far) {
        tone({ dur: 1.6, f0: 60, f1: 30, gain: 0.25, attack: 0.02 })
        noise({ dur: 1.2, type: 'lowpass', f0: 500, f1: 90, gain: 0.18, attack: 0.02, send: 0.5 })
        return
      }
      const air = stage <= 1
      tone({ dur: 2.8, f0: 85, f1: 24, gain: 0.85, attack: 0.008 })
      noise({ dur: air ? 3.2 : 1.8, type: 'lowpass', f0: 2600, f1: 120, gain: 0.7, attack: 0.004, send: air ? 0.6 : 0.2 })
      noise({ dur: 0.35, type: 'highpass', f0: 3000, gain: 0.35 })
      tone({ at: 0.15, dur: 2.2, f0: 2850, gain: 0.025, attack: 0.3 })
      bus.muffle(1.5)
      bus.duck(0.15, 1.6)
    },
    // a bright arpeggio, longer and higher for a bigger win
    win(payout) {
      const steps = payout >= 1000 ? 5 : payout >= 300 ? 4 : 3
      const notes = [0, 4, 7, 12, 16]
      for (let i = 0; i < steps; i++) {
        const hz = 784 * Math.pow(2, notes[i] / 12)
        tone({ at: 0.18 + i * 0.075, dur: 0.9, type: 'triangle', f0: hz, gain: 0.07, send: 0.45 })
      }
    },
    ui() {
      tone({ dur: 0.05, f0: 1900, gain: 0.04 })
    },
  }
}
