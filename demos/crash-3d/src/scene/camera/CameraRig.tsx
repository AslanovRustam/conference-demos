import { useFrame } from '@react-three/fiber'
import { Vector3, type Camera } from 'three'
import { params, type DebugCam } from '../../platform/params'
import { lightState } from '../env/lightState'
import { GROUND_Y } from '../pad/layout'
import { rig } from '../rig'

const DIST = 140
const EYE_Y = 6 // a little above the base: a low angle looking up the hull
const LOOK_Y = 26 // just above the middle of the 48 m rocket

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

// simple follow camera until the director arrives (task 12): a slow side orbit locked to the rocket
export function CameraRig() {
  useFrame(({ camera }) => {
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
    const yaw = 0.55 + Math.sin(rig.vtime * 0.05) * 0.08
    camera.position.set(Math.sin(yaw) * DIST, rig.rocketY + EYE_Y, Math.cos(yaw) * DIST)
    camera.lookAt(0, rig.rocketY + LOOK_Y, 0)
  }, -5)
  return null
}
