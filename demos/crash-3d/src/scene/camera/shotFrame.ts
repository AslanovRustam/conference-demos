import { Vector3 } from 'three'

// where the live camera looked (horizontally) when its shot began. the far field uses it to stage the earth and the
// moon for each shot the way a broadcast would frame them: they stay put within the shot, and every cut sets them
// in front of the new camera
export const shotFrame = {
  forward: new Vector3(0, 0, -1),
}

const look = new Vector3()

export function frameShot(cameraDirection: Vector3): void {
  look.set(cameraDirection.x, 0, cameraDirection.z)
  if (look.lengthSq() < 1e-6) return // looking straight up or down: keep the last one
  shotFrame.forward.copy(look.normalize())
}
