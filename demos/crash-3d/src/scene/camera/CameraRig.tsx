import { useFrame } from '@react-three/fiber'
import { params, type DebugCam } from '../../platform/params'
import { rig } from '../rig'

const DIST = 140
const EYE_Y = 6 // a little above the base: a low angle looking up the hull
const LOOK_Y = 26 // just above the middle of the 48 m rocket

// debug close-ups (?debug=1&cam=...): fixed poses near the hull, heights relative to the rocket base.
// close: the livery band and stage 1; base: engines, fins and soot; top: capsule and escape tower;
// plume: the engines from a little below, with the first 20 m of the exhaust
const DEBUG_POSES: Record<DebugCam, { dist: number; yaw: number; eyeY: number; lookY: number }> = {
  close: { dist: 30, yaw: 0.42, eyeY: 13, lookY: 17 },
  base: { dist: 14, yaw: 0.62, eyeY: 0.6, lookY: 2.6 },
  top: { dist: 11, yaw: 0.3, eyeY: 45.2, lookY: 44.4 },
  plume: { dist: 36, yaw: 0.62, eyeY: -2, lookY: -8 },
}

// simple follow camera until the director arrives (task 12): a slow side orbit locked to the rocket
export function CameraRig() {
  useFrame(({ camera }) => {
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
