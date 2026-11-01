import { PerspectiveCamera, Vector3 } from 'three'
import { expect, test } from 'vitest'
import { multiplierAt } from '../../core/curve'
import { cameraFor, chartPoints, chartTicks, distAt, LANDSCAPE, layoutFor, PORTRAIT, PUNCH, punchAt, tipAt } from './crashView'

test('on the pad the rocket sits at the chart origin, then climbs to the anchor and stays there', () => {
  const L = LANDSCAPE
  expect(tipAt(0, L)).toEqual({ x: L.origin[0], y: L.origin[1] })
  const mid = tipAt(1.5, L)
  expect(mid.x).toBeGreaterThan(L.origin[0])
  expect(mid.y).toBeGreaterThan(L.origin[1])
  for (const t of [8, 20, 45]) expect(tipAt(t, L)).toEqual({ x: L.anchor[0], y: L.anchor[1] })
  // never backwards
  let prev = tipAt(0, L)
  for (let t = 0.1; t < 10; t += 0.1) {
    const p = tipAt(t, L)
    expect(p.x).toBeGreaterThanOrEqual(prev.x)
    expect(p.y).toBeGreaterThanOrEqual(prev.y)
    prev = p
  }
})

test('a tall phone screen gets its own layout', () => {
  expect(layoutFor(16 / 9)).toBe(LANDSCAPE)
  expect(layoutFor(9 / 19.5)).toBe(PORTRAIT)
})

test('the chart starts at the origin, ends at the rocket and climbs like the multiplier', () => {
  const L = LANDSCAPE
  const t = 12
  const pts = chartPoints(t, 33, L)
  expect(pts).toHaveLength(33)
  expect(pts[0]).toEqual({ x: L.origin[0], y: L.origin[1] })
  const tip = tipAt(t, L)
  expect(pts[32].x).toBeCloseTo(tip.x, 9)
  expect(pts[32].y).toBeCloseTo(tip.y, 9)
  // halfway in time, the curve is still low: (m(6) - 1) / (m(12) - 1) of the way up
  const k = (multiplierAt(6) - 1) / (multiplierAt(12) - 1)
  expect(pts[16].y).toBeCloseTo(L.origin[1] + (tip.y - L.origin[1]) * k, 9)
  for (let i = 1; i < pts.length; i++) expect(pts[i].y).toBeGreaterThanOrEqual(pts[i - 1].y)
})

test('before liftoff the chart is a single point at the origin', () => {
  for (const p of chartPoints(0, 5, LANDSCAPE)) expect(p).toEqual({ x: LANDSCAPE.origin[0], y: LANDSCAPE.origin[1] })
})

test('y axis ticks: round multipliers under the current one, placed on the chart scale, never crowded', () => {
  const L = LANDSCAPE
  const t = 20 // ×20.7
  const tip = tipAt(t, L)
  const ticks = chartTicks(t, L)
  expect(ticks.length).toBeGreaterThan(0)
  expect(ticks.length).toBeLessThanOrEqual(4)
  const m = multiplierAt(t)
  for (const tick of ticks) {
    expect(tick.value).toBeLessThan(m)
    expect(tick.y).toBeCloseTo(L.origin[1] + (tip.y - L.origin[1]) * ((tick.value - 1) / (m - 1)), 9)
  }
  const ys = ticks.map((k) => k.y).sort((a, b) => a - b)
  for (let i = 1; i < ys.length; i++) expect(ys[i] - ys[i - 1]).toBeGreaterThanOrEqual(0.1 - 1e-9)
  expect(chartTicks(0, L)).toEqual([])
})

test('the camera puts the rocket exactly on the tip of the chart, at any height and screen shape', () => {
  for (const [aspect, L] of [[16 / 9, LANDSCAPE], [9 / 19.5, PORTRAIT]] as const) {
    for (const t of [0, 1, 3, 15]) {
      const rocket = new Vector3(0, 40 + t * 300, 0)
      const fov = L.fov + 4
      const pos = cameraFor(rocket, tipAt(t, L), L.dist, fov, aspect, new Vector3())
      const cam = new PerspectiveCamera(fov, aspect, 0.5, 30000)
      cam.position.copy(pos)
      cam.lookAt(pos.clone().add(new Vector3(0, 0, -1)))
      cam.updateMatrixWorld()
      const ndc = rocket.clone().project(cam)
      const tip = tipAt(t, L)
      expect(ndc.x).toBeCloseTo(tip.x, 6)
      expect(ndc.y).toBeCloseTo(tip.y, 6)
      expect(rocket.distanceTo(pos)).toBeGreaterThanOrEqual(L.dist - 1e-6)
    }
  }
})

test('axis labels stay clear of the big multiplier: none above the layout\'s label ceiling', () => {
  for (const L of [LANDSCAPE, PORTRAIT]) {
    for (const t of [3, 8, 20, 40]) for (const tick of chartTicks(t, L)) expect(tick.y).toBeLessThanOrEqual(L.tickCeiling)
  }
})

test('on the pad the camera stands closer (the rocket and its tower fill the corner), then pulls back after liftoff', () => {
  for (const L of [LANDSCAPE, PORTRAIT]) {
    expect(distAt(0, L)).toBeCloseTo(L.dist * 0.5, 9)
    expect(distAt(3, L)).toBe(L.dist)
    expect(distAt(30, L)).toBe(L.dist)
    for (let t = 0; t < 3; t += 0.1) expect(distAt(t + 0.1, L)).toBeGreaterThanOrEqual(distAt(t, L))
  }
})

test('a cash out punches the camera in on the separating capsule for a moment, then eases back', () => {
  expect(punchAt(null)).toBe(1)
  expect(punchAt(0)).toBe(1)
  expect(punchAt(0.5)).toBeCloseTo(PUNCH, 9)
  expect(punchAt(1.4)).toBeCloseTo(PUNCH, 9)
  expect(punchAt(3)).toBe(1)
  for (let t = 0; t < 0.35; t += 0.05) expect(punchAt(t + 0.05)).toBeLessThanOrEqual(punchAt(t))
  for (let t = 1.6; t < 3; t += 0.05) expect(punchAt(t + 0.05)).toBeGreaterThanOrEqual(punchAt(t))
})
