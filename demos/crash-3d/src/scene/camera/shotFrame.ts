import { Vector3 } from 'three'

// the crash view's horizontal look (camera/crashView.ts: the camera looks along -z). the far field stages the earth
// and the moon in front of it, and the rare events place themselves along it
export const shotFrame = {
  forward: new Vector3(0, 0, -1),
}
