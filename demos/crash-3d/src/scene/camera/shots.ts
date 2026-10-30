import { Vector3 } from 'three'
import { S } from '../../strings'
import { GROUND_Y } from '../pad/layout'
import { rocketRefs } from '../rocket/refs'
import type { FlightRig } from '../rig'
import type { ShotId } from './shotIds'

export type { ShotId }

export interface CameraPose {
  pos: Vector3
  look: Vector3
  fov: number // vertical, degrees
}

export interface Shot {
  label: string
  pose(rig: FlightRig, shotAge: number, aspect: number, out: CameraPose): void
}

const MID = 24 // the rocket's middle above its base
const TOP = 44 // the capsule
const DEG = Math.PI / 180

// a tall phone frame leaves room for the hud above and below the rocket
const portraitFov = (fov: number, aspect: number) => (aspect < 1 ? fov * 1.15 : fov)

// a point around the rocket's axis: distance, yaw around it, height
function around(out: Vector3, dist: number, yaw: number, y: number) {
  return out.set(Math.sin(yaw) * dist, y, Math.cos(yaw) * dist)
}

const ground = (rig: FlightRig) => GROUND_Y - rig.nearOffset

// wide low shot of the pad: the tower behind the rocket, a slow push in
const padWide: Shot = {
  label: S.cam.padWide,
  pose(rig, age, aspect, out) {
    const dist = 150 - Math.min(age, 20) * 1.2
    around(out.pos, dist, 0.6 + age * 0.004, ground(rig) + 7)
    out.look.set(0, rig.rocketY + 26, 0)
    out.fov = portraitFov(38, aspect)
  },
}

// close, low and looking up the hull past the swinging arms
const padClose: Shot = {
  label: S.cam.padClose,
  pose(rig, age, aspect, out) {
    around(out.pos, 46, 0.95 - age * 0.02, ground(rig) + 3)
    out.look.set(0, rig.rocketY + 30, 0)
    out.fov = portraitFov(44, aspect)
  },
}

// long lens from a tracking station on the ground; the lens zooms to keep ~60 m of sky around the rocket
const TELE_X = 330
const TELE_Z = 420
const groundTele: Shot = {
  label: S.cam.groundTele,
  pose(rig, _age, aspect, out) {
    out.pos.set(TELE_X, ground(rig) + 2, TELE_Z)
    out.look.set(0, rig.rocketY + MID, 0)
    const dist = out.pos.distanceTo(out.look)
    const fov = Math.min(12, Math.max(8, (2 * Math.atan(60 / dist)) / DEG))
    out.fov = portraitFov(fov, aspect)
  },
}

// a camera bolted to the interstage looking down along the hull at the plume and the ground or earth far below
const onboard: Shot = {
  label: S.cam.onboard,
  pose(rig, age, aspect, out) {
    const sway = Math.sin(age * 1.7) * 0.05
    out.pos.set(3.6, rig.rocketY + 32, sway)
    out.look.set(1.2, rig.rocketY - 60, sway * 4)
    out.fov = portraitFov(70, aspect)
  },
}

// alongside the rocket, drifting in and out between 60 and 90 m
const sideChase: Shot = {
  label: S.cam.sideChase,
  pose(rig, age, aspect, out) {
    const dist = 75 + Math.sin(age * 0.5) * 14
    around(out.pos, dist, 1.25 + age * 0.03, rig.rocketY + 18)
    out.look.set(0, rig.rocketY + 20, 0)
    out.fov = portraitFov(44, aspect)
  },
}

// pulled far back and a little below: the whole rocket and a long stretch of the plume
const wide: Shot = {
  label: S.cam.wide,
  pose(rig, age, aspect, out) {
    out.look.set(0, rig.rocketY + 10, 0)
    around(out.pos, 255 - age * 2, -0.7 + age * 0.01, rig.rocketY - 50)
    out.fov = portraitFov(40, aspect)
  },
}

// stays with the crew capsule after the eject, circling it slowly; before the eject it frames the nose.
// under parachutes (a cash out low down) it pulls back and looks up so the canopy is in the frame too
const capsuleAt = new Vector3()
const capsuleFollow: Shot = {
  label: S.cam.capsuleFollow,
  pose(rig, age, aspect, out) {
    const c = rocketRefs.capsule
    if (c) c.getWorldPosition(capsuleAt)
    else capsuleAt.set(0, rig.rocketY + TOP, 0)
    const chute = rig.ejectStage !== null && rig.ejectStage <= 1
    out.look.copy(capsuleAt)
    out.look.y += chute ? 8 : 1.5
    around(out.pos, chute ? 40 : 24, 0.9 + age * 0.25, 0).add(capsuleAt)
    out.pos.y += chute ? 2 : 4
    out.fov = portraitFov(42, aspect)
  },
}

// the range camera: far back from where the rocket was, so the whole fireball and the debris fit
const crashWide: Shot = {
  label: S.cam.crashWide,
  pose(rig, age, aspect, out) {
    out.look.set(0, rig.rocketY + MID, 0)
    around(out.pos, 320 + age * 6, 0.35, rig.rocketY - 40)
    out.fov = portraitFov(46, aspect)
  },
}

export const SHOTS: Record<ShotId, Shot> = {
  padWide,
  padClose,
  groundTele,
  onboard,
  sideChase,
  wide,
  capsuleFollow,
  crashWide,
}
