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
