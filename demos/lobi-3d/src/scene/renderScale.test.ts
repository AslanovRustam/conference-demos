import { expect, test } from 'vitest'
import { maxDpr } from './renderScale'

test('a 3× phone renders at full sharpness', () => {
  expect(maxDpr(390, 844, 3)).toBe(3)
})

test('a 1080p stand TV stays at 1×', () => {
  expect(maxDpr(1920, 1080, 1)).toBe(1)
})

test('a big retina screen is held to the pixel budget, never below 1×', () => {
  expect(maxDpr(1600, 900, 2)).toBeCloseTo(Math.sqrt(3.3e6 / (1600 * 900)))
  expect(maxDpr(3840, 2160, 2)).toBe(1)
})
