import { PerspectiveCamera, Vector3 } from 'three'
import { initialRig, type FlightRig } from '../rig'
import type { CameraPose } from './shots'

// test helpers for the camera modules: a rig with defaults, an empty pose, and where the rocket's middle lands on screen
export function rigAt(partial: Partial<FlightRig>): FlightRig {
  return { ...initialRig(), ...partial }
}

export function emptyPose(): CameraPose {
  return { pos: new Vector3(), look: new Vector3(), fov: 40 }
}

export function projectRocketCenter(pose: CameraPose, aspect: number, rocketY: number): Vector3 {
  const cam = new PerspectiveCamera(pose.fov, aspect, 0.5, 30000)
  cam.position.copy(pose.pos)
  cam.lookAt(pose.look)
  cam.updateMatrixWorld()
  return new Vector3(0, rocketY + 24, 0).project(cam)
}
