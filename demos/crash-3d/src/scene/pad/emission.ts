import { COUNTDOWN_S } from '../../core/config'
import { multiplierAt } from '../../core/curve'
import { telemetry } from '../../core/telemetry'
import type { Phase } from '../../core/types'
import { THRUST_RAMP_S } from '../rig'

// when the pad makes smoke and steam. pure, so a page that opens mid-launch (freeze, a hidden tab coming back)
// can replay the last seconds of exhaust from the round clock instead of starting with an empty sky

// the jet still reaches the pad fully below the first height, not at all above the second, m
export const GROUND_REACH: [number, number] = [12, 160]

const clamp01 = (x: number) => Math.min(1, Math.max(0, x))
const smoothstep = (e0: number, e1: number, x: number) => {
  const t = clamp01((x - e0) / (e1 - e0))
  return t * t * (3 - 2 * t)
}

// seconds since the countdown began: 0..3 while counting down, 3 + rocket clock in flight.
// null before the countdown and once the round is over: there is nothing to replay then
export function launchClock(phase: Phase, phaseAge: number, t: number): number | null {
  if (phase === 'countdown') return Math.min(phaseAge, COUNTDOWN_S)
  if (phase === 'flight' || phase === 'ejected') return COUNTDOWN_S + t
  return null
}

// engine thrust 0..1 on the launch clock, the same ramp the rig uses
export function thrustAt(L: number): number {
  return clamp01((L - (COUNTDOWN_S - THRUST_RAMP_S)) / THRUST_RAMP_S)
}

// height of the nozzles above the deck on the launch clock, m
export function altitudeAt(L: number): number {
  if (L <= COUNTDOWN_S) return 0
  return telemetry(multiplierAt(L - COUNTDOWN_S)).altKm * 1000
}

// how much of the jet still hits the pad, 1 on the deck, 0 once the rocket is high enough
export function groundReach(altM: number): number {
  return 1 - smoothstep(GROUND_REACH[0], GROUND_REACH[1], altM)
}

// exhaust clouds per second: they swell with thrust and stop once the rocket is too high for the jet to reach the pad
export function exhaustRate(L: number, peak: number): number {
  return peak * Math.pow(thrustAt(L), 1.5) * groundReach(altitudeAt(L))
}

// how hard the valves vent: idle while betting, building up through the countdown, nothing once the rocket is gone
export function steamLevel(phase: Phase, phaseAge: number): number {
  if (phase === 'betting') return 1
  if (phase === 'countdown') return 1 + 1.6 * smoothstep(0, 1.2, phaseAge)
  return 0
}
