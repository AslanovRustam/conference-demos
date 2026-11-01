import { expect, test } from 'vitest'
import { multiplierAt, timeAt } from './curve'

test('hits the agreed checkpoints within 10%', () => {
  expect(timeAt(2)).toBeGreaterThan(4.5); expect(timeAt(2)).toBeLessThan(5.5)
  expect(timeAt(10)).toBeGreaterThan(12.6); expect(timeAt(10)).toBeLessThan(15.4)
  expect(timeAt(100)).toBeGreaterThan(25.2); expect(timeAt(100)).toBeLessThan(30.8)
})
test('starts at 1 and caps at 1000', () => {
  expect(multiplierAt(0)).toBe(1)
  expect(multiplierAt(1e6)).toBe(1000)
})
test('timeAt inverts multiplierAt', () => {
  for (const m of [1.01, 2, 7.5, 333]) expect(multiplierAt(timeAt(m))).toBeCloseTo(m, 6)
})
