import { expect, test } from 'vitest'
import { bellProfile, bellRadius, buildRocketGeometry, DIM, groovedWall, NOZZLES, profile, rocketTop } from './geometry'
import { ROCKET_HEIGHT_M } from './refs'

test('profile joins pieces and drops repeated points', () => {
  expect(profile([[1, 0], [1, 1]], [[1, 1], [2, 2]])).toEqual([[1, 0], [1, 1], [2, 2]])
})

test('grooved wall climbs monotonically and cuts grooves inwards only', () => {
  const pts = groovedWall(2.3, 7, 27.2, [12, 17, 22])
  for (let i = 1; i < pts.length; i++) expect(pts[i][1]).toBeGreaterThanOrEqual(pts[i - 1][1])
  expect(Math.max(...pts.map(([r]) => r))).toBe(2.3)
  expect(Math.min(...pts.map(([r]) => r))).toBeLessThan(2.3)
  expect(pts.filter(([r]) => r < 2.3)).toHaveLength(6)
})

test('bells open towards the exit plane at y = 0 and fit under the skirt', () => {
  for (const n of NOZZLES) {
    expect(bellRadius(n, 0)).toBeCloseTo(n.exitR)
    expect(bellRadius(n, DIM.bellLength)).toBeCloseTo(n.throatR)
    expect(Math.hypot(n.x, n.z) + n.exitR).toBeLessThan(DIM.skirtR)
    const { pts, v } = bellProfile(n)
    expect(pts).toHaveLength(v.length)
    expect(Math.min(...pts.map(([, y]) => y))).toBe(0)
  }
})

test('the rocket is 48 m tall with its origin at the nozzle exit plane', () => {
  const geo = buildRocketGeometry()
  geo.bells.computeBoundingBox()
  expect(geo.bells.boundingBox!.min.y).toBeCloseTo(0, 6)
  expect(rocketTop(geo)).toBeCloseTo(ROCKET_HEIGHT_M, 3)
  geo.fins.computeBoundingBox()
  expect(geo.fins.boundingBox!.min.y).toBeGreaterThan(0.5)
})

test('the capsule geometry starts at its own base', () => {
  const { capsule } = buildRocketGeometry()
  capsule.shield.computeBoundingBox()
  expect(capsule.shield.boundingBox!.min.y).toBeCloseTo(0, 6)
})
