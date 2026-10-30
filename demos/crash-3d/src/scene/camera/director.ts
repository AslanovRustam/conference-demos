import { Vector3 } from 'three'
import type { Rng } from '../../core/rng'
import type { FlightRig } from '../rig'
import { SHOTS, type CameraPose, type ShotId } from './shots'

const CUT_MIN = 3 // seconds between cuts in flight
const CUT_MAX = 6
const PAD_CLOSE_AT = 1.5 // into the countdown
const CAPSULE_S = 1.5 // stay with the capsule after the eject, then back to the rocket
const TELE_MAX_STAGE = 1 // a ground camera loses the rocket past the clouds

const FLIGHT_SHOTS: ShotId[] = ['groundTele', 'onboard', 'sideChase', 'wide']

type Mode = 'pad' | 'flight' | 'eject' | 'crash'

function modeOf(rig: FlightRig): Mode {
  if (rig.phase === 'betting' || rig.phase === 'countdown') return 'pad'
  if (rig.phase === 'crashed' || rig.phase === 'result') return 'crash'
  return rig.ejected ? 'eject' : 'flight'
}

export interface Director {
  update(rig: FlightRig, dt: number, aspect: number): { shot: ShotId; pose: CameraPose; cut: boolean }
}

// the broadcast director: which camera is live and when to cut, from the state of the flight
export function createDirector(rng: Rng): Director {
  const pose: CameraPose = { pos: new Vector3(), look: new Vector3(), fov: 40 }
  let mode: Mode | null = null
  let phase: FlightRig['phase'] | null = null
  let shot: ShotId = 'padWide'
  let age = 0
  let hold = CUT_MIN
  let cut = false

  const cutTo = (next: ShotId, holdFor = CUT_MIN + rng() * (CUT_MAX - CUT_MIN)) => {
    cut = cut || next !== shot
    shot = next
    age = 0
    hold = holdFor
  }

  const nextFlightShot = (stageF: number) => {
    const pool = FLIGHT_SHOTS.filter((s) => s !== shot && (s !== 'groundTele' || stageF <= TELE_MAX_STAGE))
    return pool[Math.floor(rng() * pool.length)]
  }

  return {
    update(rig, dt, aspect) {
      cut = false
      const next = modeOf(rig)
      if (next !== mode) {
        if (next === 'pad') cutTo('padWide')
        else if (next === 'crash') cutTo('crashWide')
        else if (next === 'eject') cutTo('capsuleFollow', CAPSULE_S)
        // liftoff starts on the long lens for exactly one cut length, mid-flight entries pick from the rotation
        else if (mode === 'pad' && rig.stageF <= TELE_MAX_STAGE) cutTo('groundTele', CUT_MIN)
        else cutTo(nextFlightShot(rig.stageF))
        if (mode === null) cut = true
        mode = next
      } else {
        age += dt
        if (mode === 'pad') {
          if (rig.phase === 'countdown' && phase !== 'countdown') cutTo('padWide')
          else if (rig.phase === 'countdown' && shot === 'padWide' && age >= PAD_CLOSE_AT) cutTo('padClose')
        } else if (mode === 'eject' && shot === 'capsuleFollow') {
          if (age >= CAPSULE_S) cutTo(rng() < 0.5 ? 'sideChase' : 'wide')
        } else if (mode !== 'crash' && age >= hold) {
          cutTo(nextFlightShot(rig.stageF))
        }
      }
      phase = rig.phase
      SHOTS[shot].pose(rig, age, aspect, pose)
      return { shot, pose, cut }
    },
  }
}
