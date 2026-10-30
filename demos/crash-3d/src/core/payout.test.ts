import { expect, test } from 'vitest'
import { payoutFor } from './payout'

test('payout is computed in integer cents, free of float error', () => {
  expect(payoutFor(100, 1.15)).toBe(115)
  expect(payoutFor(100, 137.42)).toBe(13742)
  expect(payoutFor(10, 2)).toBe(20)
  expect(payoutFor(50, 1.15)).toBe(57)
  expect(payoutFor(5000, 1.13)).toBe(5650)
})
