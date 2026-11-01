import type { FlightRig } from '../scene/rig'

// the engine sound's settings for a moment of the flight: roar level and brightness, the sub rumble, the riser
export interface RocketMix {
  roar: number // 0..1
  cutoff: number // Hz, the roar's lowpass
  sub: number // 0..1 the 30–50 Hz rumble
  riser: number // 0..1
  riserHz: number
}

const AIR_TOP = 2.5 // stageF past which there is no air to carry the highs
const RISER_BASE_HZ = 110
const RISER_MAX_HZ = 1400

const clamp01 = (x: number) => Math.min(1, Math.max(0, x))

// after a cash out the camera stays with the capsule and the rocket flies on out of frame, unheard
export function rocketMix(rig: FlightRig): RocketMix {
  const flying = rig.phase === 'flight'
  const thrust = rig.phase === 'countdown' || flying ? clamp01(rig.thrust) : 0
  const vacuum = clamp01((rig.stageF - 1.5) / (AIR_TOP - 1.5))
  // the riser: about an octave per 3.7× of multiplier, so the tension keeps climbing all the way to ×1000
  const riserHz = Math.min(RISER_MAX_HZ, RISER_BASE_HZ * Math.pow(2, Math.log(Math.max(1, rig.m)) * 0.52))
  return {
    roar: thrust * (1 - 0.55 * vacuum),
    cutoff: (300 + 1900 * thrust) * (1 - 0.82 * vacuum),
    sub: thrust * (1 - 0.3 * vacuum),
    riser: flying ? 0.35 + 0.65 * clamp01(rig.stageF / 5) : 0,
    riserHz,
  }
}
