import { CRASH_SCENE_S, CRASH_SCENE_SHORT_S } from '../core/config'
import { multiplierAt } from '../core/curve'
import { stageAt, stageFloat, type StageId } from '../core/stages'
import { telemetry } from '../core/telemetry'
import type { Phase, RoundSnapshot } from '../core/types'

// floating origin: the rocket climbs up to this height, past it the near field moves down instead
export const NEAR_CAP_M = 6000
export const CLOUD_BASE_M = 1200
export const CLOUD_TOP_M = 2600

const THRUST_RAMP_S = 1.5 // engines spool up over the last part of the countdown
const SLOWMO_MIN = 0.3
const SLOWMO_S = 1.5
const SPEED_FADE = 3 // 1/s, how fast the sense of speed dies after the crash

export interface FlightRig {
  phase: Phase
  m: number // visual multiplier: unfloored in flight, the crash point after the crash
  stageF: number // stageFloat(m), 0..6
  altM: number // telemetry(m).altKm * 1000
  rocketY: number // min(altM, NEAR_CAP_M)
  nearOffset: number // max(0, altM - NEAR_CAP_M)
  speed: number // 0..1 = clamp(stageF / 5) while flying, eases to 0 after the crash
  thrust: number // 0 in betting, ramps 0→1 over the last 1.5 s of countdown, 1 in flight, 0 after crash
  ejected: boolean // the player cashed out this round (stays true through the crash)
  ejectStage: StageId | null // stageAt(cashedAt)
  crashAge: number | null // real seconds since the crash
  slowmo: number // 0.3 at the crash, eases back to 1 by crashAge 1.5
  vtime: number // visual clock, += dt * slowmo
}

export function initialRig(): FlightRig {
  return {
    phase: 'betting', m: 1, stageF: 0, altM: 0, rocketY: 0, nearOffset: 0, speed: 0, thrust: 0,
    ejected: false, ejectStage: null, crashAge: null, slowmo: 1, vtime: 0,
  }
}

// shared per-frame state of the flight; RigUpdater refreshes it before anything else reads it
export const rig: FlightRig = initialRig()

const clamp01 = (x: number) => Math.min(1, Math.max(0, x))
const smooth = (x: number) => x * x * (3 - 2 * x)

// the snapshot multiplier is floored to cents, which steps the rocket ~20 m at a time near the pad;
// the rocket clock gives the same curve unfloored, so the hud and the picture still agree
function visualMultiplier(snap: RoundSnapshot): number {
  const live = snap.phase === 'flight' || snap.phase === 'ejected'
  return live ? Math.max(snap.multiplier, multiplierAt(snap.t)) : snap.multiplier
}

function crashAgeOf(snap: RoundSnapshot): number | null {
  if (snap.phase === 'crashed') return snap.phaseAge
  if (snap.phase === 'result') return (snap.cashedAt !== null ? CRASH_SCENE_SHORT_S : CRASH_SCENE_S) + snap.phaseAge
  return null
}

function thrustOf(snap: RoundSnapshot): number {
  switch (snap.phase) {
    case 'countdown':
      return clamp01((THRUST_RAMP_S - snap.countdown) / THRUST_RAMP_S)
    case 'flight':
    case 'ejected':
      return 1
    default:
      return 0
  }
}

// pure: everything but the visual clock and the speed fade comes from the snapshot
export function computeRig(prev: FlightRig, snap: RoundSnapshot, dt: number): FlightRig {
  const m = visualMultiplier(snap)
  const stageF = Math.min(6, Math.max(0, stageFloat(Math.max(1, m))))
  const altM = telemetry(m).altKm * 1000
  const crashAge = crashAgeOf(snap)
  const slowmo = crashAge === null ? 1 : 1 - (1 - SLOWMO_MIN) * (1 - smooth(clamp01(crashAge / SLOWMO_S)))
  const vdt = dt * slowmo
  const flying = snap.phase === 'flight' || snap.phase === 'ejected'
  const speed = flying ? clamp01(stageF / 5) : crashAge !== null ? prev.speed * Math.exp(-SPEED_FADE * vdt) : 0
  return {
    phase: snap.phase,
    m,
    stageF,
    altM,
    rocketY: Math.min(altM, NEAR_CAP_M),
    nearOffset: Math.max(0, altM - NEAR_CAP_M),
    speed,
    thrust: thrustOf(snap),
    ejected: snap.cashedAt !== null,
    ejectStage: snap.cashedAt !== null ? stageAt(snap.cashedAt) : null,
    crashAge,
    slowmo,
    vtime: prev.vtime + vdt,
  }
}
