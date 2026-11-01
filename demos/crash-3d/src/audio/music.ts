import type { FlightRig } from '../scene/rig'
import type { Bus } from './core'

// a light, warm ambient under everything, synthesized: soft sine and triangle pads through four major-key chords,
// a quiet sub, and a slow bell arpeggio picking chord tones through an echo. it brightens a little as the rocket
// climbs. (the first version, minor-key detuned saws, felt tense on the stand)
const CHORDS = [
  [50, 54, 57, 61], // D maj7
  [47, 50, 54, 57], // B min7
  [43, 47, 50, 54], // G maj7
  [45, 47, 52, 57], // A sus2
]
const CHORD_S = 8
const BELL_STEP_S = 0.6
const BELL_CHANCE = 0.55
const BELL_DECAY_S = 2.4

const mtof = (m: number) => 440 * Math.pow(2, (m - 69) / 12)

export function createMusic(bus: Bus) {
  const { ctx } = bus
  const filter = ctx.createBiquadFilter()
  filter.type = 'lowpass'
  filter.frequency.value = 1800
  filter.Q.value = 0.4
  const out = ctx.createGain()
  out.gain.value = 0
  filter.connect(out)
  out.connect(bus.music)
  const send = ctx.createGain()
  send.gain.value = 0.6
  out.connect(send)
  send.connect(bus.reverb)

  // the pad: a sine and a slightly sharp triangle per chord tone, swelling slowly
  const padGain = ctx.createGain()
  padGain.gain.value = 0.8
  padGain.connect(filter)
  const pads: OscillatorNode[][] = CHORDS[0].map(() => {
    const sine = ctx.createOscillator()
    sine.type = 'sine'
    const tri = ctx.createOscillator()
    tri.type = 'triangle'
    tri.detune.value = 4
    const g = ctx.createGain()
    g.gain.value = 0.07
    sine.connect(g)
    tri.connect(g)
    g.connect(padGain)
    return [sine, tri]
  })
  const swell = ctx.createOscillator()
  swell.frequency.value = 0.06
  const swellDepth = ctx.createGain()
  swellDepth.gain.value = 0.2
  swell.connect(swellDepth)
  swellDepth.connect(padGain.gain)

  // a soft root an octave down
  const sub = ctx.createOscillator()
  sub.type = 'sine'
  const subGain = ctx.createGain()
  subGain.gain.value = 0.1
  sub.connect(subGain)
  subGain.connect(filter)

  // the bells ring through a dotted echo
  const bells = ctx.createGain()
  bells.gain.value = 0.5
  const echo = ctx.createDelay(1)
  echo.delayTime.value = 0.45
  const feedback = ctx.createGain()
  feedback.gain.value = 0.32
  bells.connect(filter)
  bells.connect(echo)
  echo.connect(feedback)
  feedback.connect(echo)
  echo.connect(filter)

  let chordTimer = 0
  let bellTimer = 0
  let chord = 0
  let running = false

  const play = (i: number, glide: number) => {
    const now = ctx.currentTime
    CHORDS[i].forEach((n, v) => {
      for (const o of pads[v]) o.frequency.setTargetAtTime(mtof(n), now, glide)
    })
    sub.frequency.setTargetAtTime(mtof(CHORDS[i][0] - 12), now, glide)
  }

  // one bell: a chord tone an octave or two up, a quick strike and a long ring
  const ring = () => {
    if (Math.random() > BELL_CHANCE) return
    const tones = CHORDS[chord]
    const note = tones[Math.floor(Math.random() * tones.length)] + (Math.random() < 0.6 ? 12 : 24)
    const now = ctx.currentTime
    const o = ctx.createOscillator()
    o.type = 'sine'
    o.frequency.value = mtof(note)
    const shimmer = ctx.createOscillator()
    shimmer.type = 'triangle'
    shimmer.frequency.value = mtof(note + 12)
    const g = ctx.createGain()
    g.gain.setValueAtTime(0, now)
    g.gain.linearRampToValueAtTime(0.09, now + 0.008)
    g.gain.exponentialRampToValueAtTime(0.0005, now + BELL_DECAY_S)
    const sg = ctx.createGain()
    sg.gain.value = 0.15
    o.connect(g)
    shimmer.connect(sg)
    sg.connect(g)
    g.connect(bells)
    o.start(now)
    shimmer.start(now)
    o.stop(now + BELL_DECAY_S + 0.1)
    shimmer.stop(now + BELL_DECAY_S + 0.1)
  }

  return {
    start() {
      if (running) return
      running = true
      play(0, 0.01)
      for (const pair of pads) for (const o of pair) o.start()
      sub.start()
      swell.start()
      out.gain.setTargetAtTime(1, ctx.currentTime, 3)
      chordTimer = window.setInterval(() => {
        chord = (chord + 1) % CHORDS.length
        play(chord, 0.8)
      }, CHORD_S * 1000)
      bellTimer = window.setInterval(ring, BELL_STEP_S * 1000)
    },
    update(rig: FlightRig) {
      // higher up: a little brighter
      const openness = Math.min(1, rig.stageF / 4)
      filter.frequency.setTargetAtTime(1800 + 1600 * openness, ctx.currentTime, 0.8)
    },
    // the music only starts with the first touch; a page closed before that has nothing to stop
    stop() {
      clearInterval(chordTimer)
      clearInterval(bellTimer)
      if (!running) return
      running = false
      for (const pair of pads) for (const o of pair) o.stop()
      sub.stop()
      swell.stop()
    },
  }
}
