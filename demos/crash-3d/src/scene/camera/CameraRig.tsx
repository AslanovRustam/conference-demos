import { useFrame } from '@react-three/fiber'
import { Vector3, type Camera, type PerspectiveCamera } from 'three'
import { useGame } from '../../game/store'
import { params, type DebugCam } from '../../platform/params'
import { lightState } from '../env/lightState'
import { fx } from '../fx'
import { GROUND_Y } from '../pad/layout'
import { rig } from '../rig'
import { cameraFor, distAt, layoutFor, tipAt } from './crashView'

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

// the crash view (camera/crashView.ts): one fixed side camera keeping the rocket's middle on the chart's tip. the
// lens widens a little with speed and in the warp (the rocket stays on the tip), and the camera shakes with speed
// and thrust, hardest while the engines roar on the pad
const FOV_SPEED = 6
const FOV_WARP = 16
const SHAKE_RAD = 0.004
const PAD_RUMBLE_M = 250 // the ignition rumble fades out over the first metres of the climb
const ROCKET_MID = 24 // the rocket's middle above its base, along the hull
const center = new Vector3()

const clamp01 = (x: number) => Math.min(1, Math.max(0, x))

function shakeAmount(): number {
  const rumble = rig.thrust * clamp01(1 - rig.altM / PAD_RUMBLE_M) * 0.9
  return fx.shake + 0.4 * rig.speed * rig.thrust + rumble
}

// layered sines at unrelated rates: a cheap, non-repeating jitter
function jitter(t: number, a: number, b: number) {
  return Math.sin(t * a) * 0.6 + Math.sin(t * b + 1.3) * 0.4
}

// the crash view, or a fixed debug pose with ?debug=1&cam=…
export function CameraRig() {
  useFrame(({ camera, size }) => {
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
    const cam = camera as PerspectiveCamera
    const aspect = size.width / Math.max(1, size.height)
    const L = layoutFor(aspect)
    const fov = L.fov + FOV_SPEED * rig.speed + FOV_WARP * clamp01(rig.stageF - 5)
    if (Math.abs(cam.fov - fov) > 1e-3) {
      cam.fov = fov
      cam.updateProjectionMatrix()
    }
    center.set(Math.sin(rig.tilt) * ROCKET_MID, rig.rocketY + Math.cos(rig.tilt) * ROCKET_MID, 0)
    const t = useGame.getState().snap.t
    cameraFor(center, tipAt(t, L), distAt(t, L), fov, aspect, cam.position)
    cam.rotation.set(0, 0, 0)
    const amp = shakeAmount() * SHAKE_RAD
    if (amp > 0) {
      cam.rotateX(amp * jitter(rig.vtime, 31.7, 47.3))
      cam.rotateY(amp * jitter(rig.vtime, 29.1, 53.9))
    }
  }, -5)
  return null
}
