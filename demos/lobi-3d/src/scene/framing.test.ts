import { expect, test } from 'vitest'
import * as THREE from 'three'
import { orbitPose } from './cameraMath'
import { CAMERA_HOME, CORE, FOV_HOME, SCREEN_BEZEL, SCREEN_FRAME } from './layout'

/** degrees between the camera's view axis and the top of the glass sphere */
function sphereTopOffAxis(pos: THREE.Vector3, target: THREE.Vector3): number {
  const view = target.clone().sub(pos).normalize()
  const top = new THREE.Vector3(0, CORE.y + CORE.radius, 0).sub(pos).normalize()
  return THREE.MathUtils.radToDeg(view.angleTo(top))
}

test('the sphere stays inside the frame at home and through the attract orbit', () => {
  const half = FOV_HOME / 2
  const home = sphereTopOffAxis(new THREE.Vector3(...CAMERA_HOME.position), new THREE.Vector3(...CAMERA_HOME.target))
  expect(home).toBeLessThan(half - 1)
  for (let t = 0; t <= 1; t += 0.05) {
    const pos = new THREE.Vector3()
    const target = new THREE.Vector3()
    orbitPose(t, pos, target)
    expect(sphereTopOffAxis(pos, target)).toBeLessThan(half - 1)
  }
})

test('rounded screen bezel and frame are not folded (radius at most half the depth)', () => {
  expect(SCREEN_BEZEL.radius * 2).toBeLessThanOrEqual(SCREEN_BEZEL.depth)
  expect(SCREEN_FRAME.radius * 2).toBeLessThanOrEqual(SCREEN_FRAME.depth)
})
