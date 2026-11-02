import { expect, test } from 'vitest'
import * as THREE from 'three'
import { homePose, orbitPose, portraitBlend } from './cameraMath'
import { ringSlot } from '../carousel/math'
import { CABINET, CORE, PORTRAIT_SQUASH, RADIUS, SCREEN_BEZEL, SCREEN_FRAME } from './layout'

const LANDSCAPE = 16 / 9
const PHONE = 390 / 844

/** degrees between the camera's view axis and the top of the glass sphere */
function sphereTopOffAxis(pos: THREE.Vector3, target: THREE.Vector3): number {
  const view = target.clone().sub(pos).normalize()
  const top = new THREE.Vector3(0, CORE.y + CORE.radius, 0).sub(pos).normalize()
  return THREE.MathUtils.radToDeg(view.angleTo(top))
}

/** a world point in normalized device coordinates of the camera at pos looking at target */
function ndc(point: THREE.Vector3, pos: THREE.Vector3, target: THREE.Vector3, fov: number, aspect: number): THREE.Vector3 {
  const cam = new THREE.PerspectiveCamera(fov, aspect, 0.1, 80)
  cam.position.copy(pos)
  cam.lookAt(target)
  cam.updateMatrixWorld()
  return point.clone().project(cam)
}

test.each([
  ['landscape', LANDSCAPE],
  ['phone', PHONE],
])('the sphere stays inside the frame at home and through the attract orbit (%s)', (_, aspect) => {
  const pos = new THREE.Vector3()
  const target = new THREE.Vector3()
  const half = homePose(aspect, pos, target) / 2
  expect(sphereTopOffAxis(pos, target)).toBeLessThan(half - 1)
  for (let t = 0; t <= 1; t += 0.05) {
    orbitPose(t, aspect, pos, target)
    expect(sphereTopOffAxis(pos, target)).toBeLessThan(half - 1)
  }
})

test('landscape screens keep the approved staging; phones get the upright one', () => {
  expect(portraitBlend(LANDSCAPE)).toBe(0)
  expect(portraitBlend(1)).toBe(0)
  expect(portraitBlend(PHONE)).toBe(1)
})

test('upright, both neighbours of the front cabinet peek in at the screen edges', () => {
  const pos = new THREE.Vector3()
  const target = new THREE.Vector3()
  const fov = homePose(PHONE, pos, target)
  const at = (x: number, z: number) => ndc(new THREE.Vector3(x, CABINET.h / 2, z), pos, target, fov, PHONE).x
  const frontEdge = Math.abs(at(CABINET.w / 2, RADIUS))
  for (const i of [1, 3]) {
    const [x, , z] = ringSlot(i, 4, 0, RADIUS, PORTRAIT_SQUASH).position
    const inner = Math.abs(at(x - Math.sign(x) * (CABINET.w / 2), z))
    const outer = Math.abs(at(x + Math.sign(x) * (CABINET.w / 2), z))
    // a visible strip beside the front cabinet, running off the screen edge
    expect(inner).toBeGreaterThan(frontEdge)
    expect(inner).toBeLessThan(0.85)
    expect(outer).toBeGreaterThan(0.95)
  }
})

test('rounded screen bezel and frame are not folded (radius at most half the depth)', () => {
  expect(SCREEN_BEZEL.radius * 2).toBeLessThanOrEqual(SCREEN_BEZEL.depth)
  expect(SCREEN_FRAME.radius * 2).toBeLessThanOrEqual(SCREEN_FRAME.depth)
})
