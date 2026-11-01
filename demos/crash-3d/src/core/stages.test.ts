import { expect, test } from 'vitest'
import { stageAt, stageFloat } from './stages'

test.each([[1, 0], [1.19, 0], [1.2, 1], [1.8, 2], [3, 3], [8, 4], [30, 5], [1000, 5]])('stageAt(%f) = %i', (m, s) => {
  expect(stageAt(m)).toBe(s)
})
test.each([[1, 0], [1.2, 1], [1.8, 2], [3, 3], [8, 4], [30, 5], [1000, 6]])('stageFloat(%f) = %f', (m, f) => {
  expect(stageFloat(m)).toBeCloseTo(f, 6)
})
test('stageFloat is continuous and increasing', () => {
  let prev = stageFloat(1)
  for (let m = 1.001; m < 1000; m *= 1.001) {
    const f = stageFloat(m)
    expect(f).toBeGreaterThan(prev)
    expect(f - prev).toBeLessThan(0.01)
    prev = f
  }
})
