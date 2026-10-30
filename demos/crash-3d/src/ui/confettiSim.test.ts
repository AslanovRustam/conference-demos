import { expect, test } from 'vitest'
import { createRng } from '../core/rng'
import { CONFETTI_COLORS, CONFETTI_COUNT, CONFETTI_S, spawnConfetti, stepConfetti } from './confettiSim'

test('a burst of about 150 pieces in the brand red and white only', () => {
  const parts = spawnConfetti(createRng(1), 1000, 600)
  expect(parts).toHaveLength(CONFETTI_COUNT)
  expect(CONFETTI_COUNT).toBeGreaterThanOrEqual(140)
  expect(CONFETTI_COUNT).toBeLessThanOrEqual(160)
  for (const p of parts) expect(CONFETTI_COLORS).toContain(p.color)
  expect(new Set(parts.map((p) => p.color)).size).toBe(2)
})

test('pieces burst upwards, then gravity wins and they fall', () => {
  const parts = spawnConfetti(createRng(2), 1000, 600)
  const y0 = parts.map((p) => p.y)
  for (let t = 0; t < 0.15; t += 1 / 60) stepConfetti(parts, 1 / 60, 600)
  const rose = parts.filter((p, i) => p.y < y0[i]).length // screen y grows downwards
  expect(rose).toBeGreaterThan(parts.length * 0.6)
  for (let t = 0; t < 1.2; t += 1 / 60) stepConfetti(parts, 1 / 60, 600)
  expect(parts.every((p) => p.vy > 0)).toBe(true)
})

test('the burst fades out within its 1.2 s', () => {
  expect(CONFETTI_S).toBeCloseTo(1.2)
  const parts = spawnConfetti(createRng(3), 1000, 600)
  for (let t = 0; t < CONFETTI_S + 0.02; t += 1 / 60) stepConfetti(parts, 1 / 60, 600)
  expect(parts.every((p) => p.alpha === 0)).toBe(true)
})
