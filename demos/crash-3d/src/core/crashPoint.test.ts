import { expect, test } from 'vitest'
import { createRng } from './rng'
import { sampleCrashPoint, survival } from './crashPoint'

test.each([[0.97, 1], [0.5, 2], [0.25, 5], [0.1, 15], [0.025, 50]])('u=%f lands on anchor %f', (u, x) => {
  expect(sampleCrashPoint(u)).toBe(x)
})
test('top 3% explode at 1.00', () => {
  expect(sampleCrashPoint(0.975)).toBe(1)
  expect(sampleCrashPoint(0.99999)).toBe(1)
})
test('caps at 1000', () => expect(sampleCrashPoint(0)).toBe(1000))
test('is non-increasing in u and floored to cents', () => {
  let prev = Infinity
  for (let u = 0; u < 1; u += 0.001) {
    const x = sampleCrashPoint(u)
    expect(x).toBeLessThanOrEqual(prev)
    expect(Math.abs(x * 100 - Math.round(x * 100))).toBeLessThan(1e-6)
    prev = x
  }
})
test('matches the survival table on 200k seeded samples', () => {
  const rng = createRng(42)
  const xs = Array.from({ length: 200_000 }, () => sampleCrashPoint(rng()))
  const share = (f: (x: number) => boolean) => xs.filter(f).length / xs.length
  expect(share((x) => x === 1)).toBeCloseTo(0.03, 2)
  expect(Math.abs(share((x) => x >= 2) - 0.5)).toBeLessThan(0.01)
  expect(Math.abs(share((x) => x >= 5) - 0.25)).toBeLessThan(0.01)
  expect(Math.abs(share((x) => x >= 15) - 0.1)).toBeLessThan(0.005)
  expect(Math.abs(share((x) => x >= 50) - 0.025)).toBeLessThan(0.002)
})
test('survival agrees with the anchors', () => {
  expect(survival(2)).toBeCloseTo(0.5, 6)
  expect(survival(15)).toBeCloseTo(0.1, 6)
  expect(survival(1000)).toBe(0)
})
