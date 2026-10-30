import { expect, test } from 'vitest'
import { coverDistance } from './cameraMath'

test('coverDistance fills the viewport for any aspect', () => {
  const h = 0.5625 / 2 / Math.tan(((32 / 2) * Math.PI) / 180)
  expect(coverDistance(1, 0.5625, 32, 16 / 9)).toBeCloseTo(h) // exact fit
  expect(coverDistance(1, 0.5625, 32, 4 / 3)).toBeCloseTo(h) // height-bound, width overflows
  expect(coverDistance(1, 0.5625, 32, 9 / 16)).toBeCloseTo(h)
  expect(coverDistance(1, 0.5625, 32, 21 / 9)).toBeCloseTo((h * (16 / 9)) / (21 / 9)) // width-bound
})
