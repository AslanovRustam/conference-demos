import { expect, test } from 'vitest'
import { telemetry } from './telemetry'

test('hits anchors at stage borders and grows monotonically', () => {
  expect(telemetry(1)).toEqual({ altKm: 0, velKmS: 0 })
  expect(telemetry(3).altKm).toBeCloseTo(40, 6)
  let prev = telemetry(1)
  for (let m = 1.01; m < 1000; m *= 1.01) {
    const cur = telemetry(m)
    expect(cur.altKm).toBeGreaterThanOrEqual(prev.altKm)
    expect(cur.velKmS).toBeGreaterThanOrEqual(prev.velKmS)
    prev = cur
  }
})

test('liftoff eases in: half way through stage 0 the rocket has climbed under an eighth of it', () => {
  const halfStage0 = Math.sqrt(1.2) // stageFloat = 0.5
  expect(telemetry(halfStage0).altKm).toBeLessThan(0.4 / 8)
  expect(telemetry(halfStage0).altKm).toBeGreaterThan(0)
})

test('the climb rate does not jump where stage 0 hands over to stage 1', () => {
  const rate = (m: number) => (telemetry(m * 1.001).altKm - telemetry(m).altKm) / Math.log(1.001)
  const before = rate(1.2 / 1.002)
  const after = rate(1.2 * 1.002)
  expect(before / after).toBeGreaterThan(0.6)
  expect(before / after).toBeLessThan(1.6)
})
