import { expect, test } from 'vitest'
import { orbitPosition } from './orbit'

test('orbit spreads items evenly on a tilted circle', () => {
  const p0 = orbitPosition(0, 4, 0, 2, 0)
  expect(p0[0]).toBeCloseTo(2)
  expect(p0[1]).toBeCloseTo(0)
  expect(p0[2]).toBeCloseTo(0)
  const p1 = orbitPosition(1, 4, 0, 2, 0)
  expect(p1[0]).toBeCloseTo(0)
  expect(p1[2]).toBeCloseTo(2)
  const tilted = orbitPosition(1, 4, 0, 2, Math.PI / 6)
  expect(Math.hypot(...tilted)).toBeCloseTo(2)
  expect(Math.abs(tilted[1])).toBeGreaterThan(0.5)
})

test('orbit turns with time', () => {
  const a = orbitPosition(0, 4, 0, 2, 0)
  const b = orbitPosition(0, 4, 1, 2, 0)
  expect(b[0]).not.toBeCloseTo(a[0])
})
