import { expect, test } from 'vitest'
import { createRng } from '../core/rng'
import {
  CREDIT_LAND_S,
  creditAt,
  flashAt,
  ringAt,
  spawnWinFx,
  stepWinFx,
  WINFX_COLORS,
  WINFX_S,
  type WinFx,
} from './winFxSim'

const ORIGIN = { x: 500, y: 400 }
const TARGET = { x: 900, y: 40 }
const run = (fx: WinFx, seconds: number) => {
  for (let i = 0; i < Math.round(seconds * 60); i++) stepWinFx(fx, 1 / 60)
}
const dist = (p: { x: number; y: number }) => Math.hypot(p.x - ORIGIN.x, p.y - ORIGIN.y)

test('sparks shoot out of the win in every direction, in the brand red and white only', () => {
  const fx = spawnWinFx(createRng(1), ORIGIN, TARGET, 600)
  expect(fx.sparks.length).toBeGreaterThanOrEqual(60)
  for (const s of [...fx.sparks, ...fx.glints]) expect(WINFX_COLORS).toContain(s.color)
  const right = fx.sparks.filter((s) => s.vx > 0).length
  const up = fx.sparks.filter((s) => s.vy < 0).length
  for (const n of [right, up]) expect(n / fx.sparks.length).toBeGreaterThan(0.3)
  run(fx, 0.1)
  expect(fx.sparks.every((s) => dist(s) > 0)).toBe(true)
})

test('sparks are fast at first and slow down hard (drag), like a burst rather than a fountain', () => {
  const fx = spawnWinFx(createRng(2), ORIGIN, TARGET, 600)
  const v0 = fx.sparks.map((s) => Math.hypot(s.vx, s.vy))
  run(fx, 0.5)
  fx.sparks.forEach((s, i) => expect(Math.hypot(s.vx, s.vy)).toBeLessThan(v0[i] * 0.45))
})

test('credits leave the amount and land on the balance one after another, all by CREDIT_LAND_S', () => {
  const fx = spawnWinFx(createRng(3), ORIGIN, TARGET, 600)
  expect(fx.credits.length).toBeGreaterThanOrEqual(8)
  const lands = fx.credits.map((c) => c.start + c.dur)
  expect([...lands].sort((a, b) => a - b)).toEqual(lands)
  expect(Math.max(...lands)).toBeLessThanOrEqual(CREDIT_LAND_S[1] + 1e-9)
  expect(Math.min(...lands)).toBeGreaterThanOrEqual(CREDIT_LAND_S[0] - 1e-9)
  for (const c of fx.credits) {
    expect(creditAt(c, c.start - 0.01).alpha).toBe(0)
    const from = creditAt(c, c.start)
    expect(from.x).toBeCloseTo(ORIGIN.x)
    expect(from.y).toBeCloseTo(ORIGIN.y)
    const to = creditAt(c, c.start + c.dur)
    expect(to.x).toBeCloseTo(TARGET.x)
    expect(to.y).toBeCloseTo(TARGET.y)
    expect(creditAt(c, c.start + c.dur + 0.05).alpha).toBe(0)
  }
})

test('no balance on screen (the idle loop): no credits fly', () => {
  expect(spawnWinFx(createRng(4), ORIGIN, null, 600).credits).toEqual([])
})

test('two shock rings grow out of the win and fade', () => {
  for (const i of [0, 1]) {
    let last = -1
    for (let a = 0.02; a < 0.9; a += 0.05) {
      const r = ringAt(a, i, 600)
      expect(r.radius).toBeGreaterThanOrEqual(last)
      last = r.radius
    }
    expect(last).toBeGreaterThan(200)
  }
  expect(ringAt(0.05, 0, 600).alpha).toBeGreaterThan(ringAt(0.6, 0, 600).alpha)
})

test('the flash is instant and short', () => {
  expect(flashAt(0)).toBeGreaterThan(0.8)
  expect(flashAt(0.5)).toBe(0)
})

test('everything is gone by WINFX_S', () => {
  expect(WINFX_S).toBeLessThanOrEqual(2.2)
  const fx = spawnWinFx(createRng(5), ORIGIN, TARGET, 600)
  run(fx, WINFX_S + 0.02)
  expect(fx.sparks.every((s) => s.alpha === 0)).toBe(true)
  expect(fx.glints.every((g) => g.alpha === 0)).toBe(true)
  expect(fx.credits.every((c) => creditAt(c, fx.age).alpha === 0)).toBe(true)
  expect([0, 1].map((i) => ringAt(fx.age, i, 600).alpha)).toEqual([0, 0])
  expect(flashAt(fx.age)).toBe(0)
})
