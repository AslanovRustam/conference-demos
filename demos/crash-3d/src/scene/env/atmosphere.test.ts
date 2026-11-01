import { expect, test } from 'vitest'
import { chapman, horizonDip, sunTransmittance } from './atmosphere'

const DEG = Math.PI / 180

test('the horizon dips as the camera climbs', () => {
  expect(horizonDip(0)).toBe(0)
  expect(horizonDip(100_000) / DEG).toBeCloseTo(10.1, 1)
  let last = 0
  for (const alt of [10, 1000, 3500, 40_000, 400_000]) {
    const d = horizonDip(alt)
    expect(d).toBeGreaterThan(last)
    last = d
  }
})

test('chapman: straight up it is the plain exponential column, sideways it is much longer', () => {
  const X = 6371 / 8
  expect(chapman(X, 0, 1)).toBeCloseTo(1, 1)
  expect(chapman(X, 1, 1)).toBeCloseTo(Math.exp(-1), 1)
  expect(chapman(X, 0, 0)).toBeGreaterThan(25)
  // a ray into the planet is huge, but finite
  const into = chapman(X, 0, -0.5)
  expect(into).toBeGreaterThan(1e6)
  expect(Number.isFinite(into)).toBe(true)
})

test('sunlight reddens through the air and is all there in space', () => {
  const high = sunTransmittance(400_000, 30 * DEG)
  expect(high.r).toBeCloseTo(1, 3)
  expect(high.b).toBeCloseTo(1, 3)
  const noon = sunTransmittance(0, 60 * DEG)
  expect(noon.r).toBeGreaterThan(noon.g)
  expect(noon.g).toBeGreaterThan(noon.b)
  const low = sunTransmittance(0, 2 * DEG)
  expect(low.r / low.b).toBeGreaterThan(noon.r / noon.b * 5)
  const below = sunTransmittance(0, -5 * DEG)
  expect(below.r).toBeLessThan(1e-6)
})
