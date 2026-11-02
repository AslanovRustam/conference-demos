// Camera framing for the fly-in: how close the camera must get for the cabinet screen to cover
// the whole viewport, whatever the display aspect (16:9 stand TV, 4:3 projector, portrait kiosk),
// and the home view, which moves from the landscape staging to the upright one on narrow screens.

import * as THREE from 'three'
import { CAMERA_HOME, CAMERA_PORTRAIT, FOV_HOME } from './layout'

const DEG = Math.PI / 180
const HOME_POS = new THREE.Vector3(...CAMERA_HOME.position)
const HOME_TARGET = new THREE.Vector3(...CAMERA_HOME.target)
const PORTRAIT_POS = new THREE.Vector3(...CAMERA_PORTRAIT.position)
const PORTRAIT_TARGET = new THREE.Vector3(...CAMERA_PORTRAIT.target)

export function coverDistance(screenW: number, screenH: number, vfovDeg: number, aspect: number): number {
  const t = Math.tan((vfovDeg * DEG) / 2)
  const distH = screenH / 2 / t
  const distW = screenW / 2 / (t * aspect)
  // the nearer of the two makes the screen overflow the other axis instead of leaving bars
  return Math.min(distH, distW)
}

/** 0 on landscape and square screens, 1 on a phone held upright (9:19.5), smooth in between. */
export function portraitBlend(aspect: number): number {
  return 1 - THREE.MathUtils.smoothstep(aspect, 0.5, 1)
}

/** Home camera for a viewport aspect: writes position and look-at point, returns the vertical FOV. */
export function homePose(aspect: number, outPos: THREE.Vector3, outTarget: THREE.Vector3): number {
  const p = portraitBlend(aspect)
  outPos.lerpVectors(HOME_POS, PORTRAIT_POS, p)
  outTarget.lerpVectors(HOME_TARGET, PORTRAIT_TARGET, p)
  return THREE.MathUtils.lerp(FOV_HOME, CAMERA_PORTRAIT.fov, p)
}

const home = { pos: new THREE.Vector3(), target: new THREE.Vector3() }

/**
 * Attract orbit at progress t ∈ [0, 1]: swing right, back, left, back, rising and closing in
 * mid-way. The look-at point rises with the camera so the sphere above the ring stays in frame.
 */
export function orbitPose(t: number, aspect: number, outPos: THREE.Vector3, outTarget: THREE.Vector3): void {
  homePose(aspect, home.pos, home.target)
  const theta = Math.sin(t * Math.PI * 2) * 0.55
  const lift = Math.sin(t * Math.PI)
  const r = Math.hypot(home.pos.x, home.pos.z) * (1 - lift * 0.12)
  outPos.set(Math.sin(theta) * r, home.pos.y + lift * 0.9, Math.cos(theta) * r)
  outTarget.set(home.target.x, home.target.y + lift, home.target.z)
}
