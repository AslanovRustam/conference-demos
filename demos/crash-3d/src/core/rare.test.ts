import { expect, test } from 'vitest'
import { sampleCrashPoint } from './crashPoint'
import { forcedRare, pickRare, RARE_CHANCE, RARE_WINDOWS } from './rare'
import { createRng } from './rng'
import { stageFloat } from './stages'
import type { RareKind } from './types'

test('never schedules an event the rocket will not reach', () => {
  const rng = createRng(3)
  for (let i = 0; i < 10_000; i++) {
    const crash = sampleCrashPoint(rng())
    const plan = pickRare(rng, crash)
    if (plan) expect(plan.atStage).toBeLessThan(stageFloat(crash))
  }
})

test('fires in about a quarter of rounds that reach stage 3.5', () => {
  const rng = createRng(4)
  let hits = 0
  for (let i = 0; i < 20_000; i++) if (pickRare(rng, 100)) hits++
  expect(RARE_CHANCE).toBe(0.25)
  expect(Math.abs(hits / 20_000 - 0.25)).toBeLessThan(0.02)
})

test('atStage lies inside the kind window', () => {
  const rng = createRng(5)
  const seen = new Set<RareKind>()
  for (let i = 0; i < 5_000; i++) {
    const plan = pickRare(rng, 1 + rng() * 200)
    if (!plan) continue
    seen.add(plan.kind)
    const [lo, hi] = RARE_WINDOWS[plan.kind]
    expect(plan.atStage).toBeGreaterThanOrEqual(lo)
    expect(plan.atStage).toBeLessThanOrEqual(hi)
  }
  expect(seen.size).toBe(4)
})

test('rounds below stage 2.2 never get an event', () => {
  const rng = createRng(6)
  for (let i = 0; i < 2_000; i++) expect(pickRare(rng, 1.7)).toBeNull()
})

test('only the kinds the rocket can reach are picked', () => {
  // crash 2.5: stageFloat ≈ 2.8, so only the sunrise window (from 2.2) opens before 2.7
  const rng = createRng(7)
  for (let i = 0; i < 2_000; i++) {
    const plan = pickRare(rng, 2.5)
    if (plan) expect(plan.kind).toBe('sunrise')
  }
})

test('a forced event (debug) starts at the opening of its window', () => {
  expect(forcedRare('station')).toEqual({ kind: 'station', atStage: RARE_WINDOWS.station[0] })
})
