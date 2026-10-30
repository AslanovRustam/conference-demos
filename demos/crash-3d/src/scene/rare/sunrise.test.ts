import { expect, test } from 'vitest'
import { SUNRISE_HOLD, sunriseElevation } from './sunrise'

const DEG = Math.PI / 180
const horizon = -6 * DEG

test('before the event the sun waits under the horizon (or lower, where the flight has it)', () => {
  expect(sunriseElevation(20 * DEG, horizon, { started: false, active: false, p: 0 })).toBeCloseTo(horizon - SUNRISE_HOLD, 9)
  expect(sunriseElevation(-10 * DEG, horizon, { started: false, active: false, p: 0 })).toBeCloseTo(-10 * DEG, 9)
})

test('during the event it breaks out of the limb a third of the way in and reaches the flight sun at the end', () => {
  for (const normal of [4, 14, 24].map((d) => d * DEG)) {
    const at = (p: number) => sunriseElevation(normal, horizon, { started: true, active: true, p })!
    expect(at(0)).toBeCloseTo(horizon - SUNRISE_HOLD, 9)
    expect(at(0.25)).toBeLessThan(horizon)
    expect(at(0.6)).toBeGreaterThan(horizon)
    expect(at(1)).toBeCloseTo(normal, 9)
    for (let p = 0.05; p <= 1; p += 0.05) expect(at(p)).toBeGreaterThanOrEqual(at(p - 0.05))
  }
})

test('after the event the flight keeps its own sun', () => {
  expect(sunriseElevation(20 * DEG, horizon, { started: true, active: false, p: 1 })).toBeNull()
})
