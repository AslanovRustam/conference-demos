import { useFrame } from '@react-three/fiber'
import { rig } from '../rig'

const DIST = 140
const EYE_Y = 6 // a little above the base: a low angle looking up the hull
const LOOK_Y = 26 // just above the middle of the 48 m rocket

// simple follow camera until the director arrives (task 12): a slow side orbit locked to the rocket
export function CameraRig() {
  useFrame(({ camera }) => {
    const yaw = 0.55 + Math.sin(rig.vtime * 0.05) * 0.08
    camera.position.set(Math.sin(yaw) * DIST, rig.rocketY + EYE_Y, Math.cos(yaw) * DIST)
    camera.lookAt(0, rig.rocketY + LOOK_Y, 0)
  }, -5)
  return null
}
