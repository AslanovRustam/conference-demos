// Camera framing for the fly-in: how close the camera must get for the cabinet screen to cover
// the whole viewport, whatever the display aspect (16:9 stand TV, 4:3 projector, portrait kiosk).

import * as THREE from 'three'
import { CAMERA_HOME } from './layout'

const DEG = Math.PI / 180
const HOME_POS = new THREE.Vector3(...CAMERA_HOME.position)
const HOME_TARGET = new THREE.Vector3(...CAMERA_HOME.target)

export function coverDistance(screenW: number, screenH: number, vfovDeg: number, aspect: number): number {
  const t = Math.tan((vfovDeg * DEG) / 2)
  const distH = screenH / 2 / t
  const distW = screenW / 2 / (t * aspect)
  // the nearer of the two makes the screen overflow the other axis instead of leaving bars
  return Math.min(distH, distW)
}

/**
 * Attract orbit at progress t ∈ [0, 1]: swing right, back, left, back, rising and closing in
 * mid-way. The look-at point rises with the camera so the sphere above the ring stays in frame.
 */
export function orbitPose(t: number, outPos: THREE.Vector3, outTarget: THREE.Vector3): void {
  const theta = Math.sin(t * Math.PI * 2) * 0.55
  const lift = Math.sin(t * Math.PI)
  const r = Math.hypot(HOME_POS.x, HOME_POS.z) * (1 - lift * 0.12)
  outPos.set(Math.sin(theta) * r, HOME_POS.y + lift * 0.9, Math.cos(theta) * r)
  outTarget.set(HOME_TARGET.x, HOME_TARGET.y + lift, HOME_TARGET.z)
}
