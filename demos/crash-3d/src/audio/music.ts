import type { FlightRig } from '../scene/rig'
import type { Bus } from './core'

// a slow cinematic pad under everything, synthesized: a few detuned saws per chord through a breathing lowpass.
// it moves through four chords and opens up (brighter, a fifth higher) as the rocket gets higher
const CHORDS = [
  [45, 52, 57, 64], // A minor
  [41, 48, 53, 60], // F
  [43, 50, 55, 62], // G sus
  [40, 47, 52, 59], // E minor
]
const CHORD_S = 9
const VOICES = 4

const mtof = (m: number) => 440 * Math.pow(2, (m - 69) / 12)

export function createMusic(bus: Bus) {
  const { ctx } = bus
  const filter = ctx.createBiquadFilter()
  filter.type = 'lowpass'
  filter.frequency.value = 600
  filter.Q.value = 0.9
  const out = ctx.createGain()
  out.gain.value = 0
  filter.connect(out)
  out.connect(bus.music)
  const send = ctx.createGain()
  send.gain.value = 0.7
  out.connect(send)
  send.connect(bus.reverb)

  // two detuned saws per voice; the chord changes glide
  const oscs: OscillatorNode[][] = []
  for (let v = 0; v < VOICES; v++) {
    const pair = [ctx.createOscillator(), ctx.createOscillator()]
    pair[0].type = pair[1].type = 'sawtooth'
    pair[1].detune.value = 9
    const g = ctx.createGain()
    g.gain.value = 0.18
    for (const o of pair) o.connect(g)
    g.connect(filter)
    oscs.push(pair)
  }

  // a slow breath on the filter
  const lfo = ctx.createOscillator()
  lfo.frequency.value = 0.07
  const depth = ctx.createGain()
  depth.gain.value = 220
  lfo.connect(depth)
  depth.connect(filter.frequency)

  let timer = 0
  let chord = 0
  let lift = 0 // semitones up with altitude
  let running = false

  const play = (i: number, glide: number) => {
    const now = ctx.currentTime
    CHORDS[i].forEach((n, v) => {
      for (const o of oscs[v]) o.frequency.setTargetAtTime(mtof(n + lift), now, glide)
    })
  }

  return {
    start() {
      if (running) return
      running = true
      play(0, 0.01)
      for (const pair of oscs) for (const o of pair) o.start()
      lfo.start()
      out.gain.setTargetAtTime(1, ctx.currentTime, 2.5)
      timer = window.setInterval(() => {
        chord = (chord + 1) % CHORDS.length
        play(chord, 1.2)
      }, CHORD_S * 1000)
    },
    update(rig: FlightRig) {
      // higher up: brighter and lifted a fifth by deep space
      const openness = Math.min(1, rig.stageF / 4)
      filter.frequency.setTargetAtTime(500 + 1400 * openness, ctx.currentTime, 0.6)
      const nextLift = rig.stageF >= 4 ? 7 : rig.stageF >= 2 ? 5 : 0
      if (nextLift !== lift) {
        lift = nextLift
        play(chord, 2)
      }
    },
    // the pad only starts with the first touch; a page closed before that has nothing to stop
    stop() {
      clearInterval(timer)
      if (!running) return
      running = false
      for (const pair of oscs) for (const o of pair) o.stop()
      lfo.stop()
    },
  }
}
