import { useFrame } from '@react-three/fiber'
import { useMemo } from 'react'
import { Vector3, type Camera, type PerspectiveCamera } from 'three'
import { createRng, randomSeed } from '../../core/rng'
import { useGame } from '../../game/store'
import { params, type DebugCam } from '../../platform/params'
import { lightState } from '../env/lightState'
import { fx } from '../fx'
import { GROUND_Y } from '../pad/layout'
import { rig } from '../rig'
import { createDirector } from './director'
import { SHOTS, type CameraPose } from './shots'

// debug close-ups (?debug=1&cam=...): fixed poses near the hull, heights relative to the rocket base.
// close: the livery band and stage 1; base: engines, fins and soot; top: capsule and escape tower;
// plume: the engines from a little below, with the first 20 m of the exhaust
const DEBUG_POSES: Record<Exclude<DebugCam, 'pad' | 'sun'>, { dist: number; yaw: number; eyeY: number; lookY: number }> = {
  close: { dist: 30, yaw: 0.42, eyeY: 13, lookY: 17 },
  base: { dist: 14, yaw: 0.62, eyeY: 0.6, lookY: 2.6 },
  top: { dist: 11, yaw: 0.3, eyeY: 45.2, lookY: 44.4 },
  plume: { dist: 36, yaw: 0.62, eyeY: -2, lookY: -8 },
}

// debug wide shot from low on the ground (?debug=1&cam=pad): the pad and the rocket above it both in frame,
// pulling back as the rocket climbs
const PAD_YAW = 0.55
const PAD_SPAN = (36 * Math.PI) / 180 // of the 40 degree vertical fov
function padShot(camera: Camera) {
  const ground = GROUND_Y - rig.nearOffset
  const eye = ground + 5
  const up = rig.rocketY + 54 - eye
  const down = eye - (ground - 2)
  let dist = 120
  while (Math.atan(up / dist) + Math.atan(down / dist) > PAD_SPAN) dist *= 1.03
  const pitch = (Math.atan(up / dist) - Math.atan(down / dist)) / 2
  camera.position.set(Math.sin(PAD_YAW) * dist, eye, Math.cos(PAD_YAW) * dist)
  camera.lookAt(0, eye + Math.tan(pitch) * dist, 0)
}

// debug look into the sun (?debug=1&cam=sun): from 80 m back along the sun's direction, past the rocket's nose, a
// little to the side so the sun peeks out next to it (wherever the sun is, even below the horizon)
const SUN_BACK = 80
const SUN_SIDE = 2.4
const NOSE_Y = 40
const nose = new Vector3()
const side = new Vector3()
function sunShot(camera: Camera) {
  const s = lightState.sunDir
  nose.set(0, rig.rocketY + NOSE_Y, 0)
  side.set(-s.z, 0, s.x).normalize()
  camera.position.copy(nose).addScaledVector(s, -SUN_BACK).addScaledVector(side, SUN_SIDE)
  camera.lookAt(nose)
}

// on top of every shot: the lens widens with speed (scaled to the lens, so a telephoto keeps its framing),
// and the camera shakes with speed and thrust, hardest while the engines roar on the pad
const FOV_SPEED = 12
const FOV_WARP = 25
const SHAKE_RAD = 0.006
const PAD_RUMBLE_M = 250 // the ignition rumble fades out over the first metres of the climb
const DOF_FADE_S = 0.6

const clamp01 = (x: number) => Math.min(1, Math.max(0, x))

function shakeAmount(): number {
  const rumble = rig.thrust * clamp01(1 - rig.altM / PAD_RUMBLE_M) * 0.9
  return fx.shake + 0.4 * rig.speed * rig.thrust + rumble
}

// layered sines at unrelated rates: a cheap, non-repeating jitter
function jitter(t: number, a: number, b: number) {
  return Math.sin(t * a) * 0.6 + Math.sin(t * b + 1.3) * 0.4
}

function applyShot(camera: PerspectiveCamera, pose: CameraPose) {
  camera.position.copy(pose.pos)
  camera.lookAt(pose.look)
  const amp = shakeAmount() * SHAKE_RAD
  if (amp > 0) {
    camera.rotateX(amp * jitter(rig.vtime, 31.7, 47.3))
    camera.rotateY(amp * jitter(rig.vtime, 29.1, 53.9))
  }
  const boost = FOV_SPEED * rig.speed + FOV_WARP * clamp01(rig.stageF - 5)
  const fov = pose.fov + boost * (pose.fov / 40)
  if (Math.abs(camera.fov - fov) > 1e-3) {
    camera.fov = fov
    camera.updateProjectionMatrix()
  }
  fx.focus.copy(pose.look)
}

// the broadcast director, or a fixed debug pose with ?debug=1&cam=…; ?debug=1&shot=… holds one broadcast camera
export function CameraRig() {
  const director = useMemo(() => createDirector(createRng((params.seed ?? randomSeed()) + 1)), [])
  const held = useMemo(() => ({ pose: { pos: new Vector3(), look: new Vector3(), fov: 40 } as CameraPose, age: 0 }), [])

  useFrame(({ camera, size }, dt) => {
    if (params.cam === 'pad') {
      padShot(camera)
      return
    }
    if (params.cam === 'sun') {
      sunShot(camera)
      return
    }
    const debug = params.cam ? DEBUG_POSES[params.cam] : null
    if (debug) {
      const { dist, yaw, eyeY, lookY } = debug
      camera.position.set(Math.sin(yaw) * dist, rig.rocketY + eyeY, Math.cos(yaw) * dist)
      camera.lookAt(0, rig.rocketY + lookY, 0)
      return
    }
    const aspect = size.width / Math.max(1, size.height)
    fx.dofPulse = Math.max(0, fx.dofPulse - dt / DOF_FADE_S)
    if (params.shot) {
      const shot = SHOTS[params.shot]
      if (held.age === 0) useGame.getState().setCamLabel(shot.label)
      held.age += dt
      shot.pose(rig, held.age, aspect, held.pose)
      applyShot(camera as PerspectiveCamera, held.pose)
      return
    }
    const live = director.update(rig, dt, aspect)
    if (live.cut) {
      useGame.getState().setCamLabel(SHOTS[live.shot].label)
      fx.dofPulse = 1
    }
    applyShot(camera as PerspectiveCamera, live.pose)
  }, -5)
  return null
}
