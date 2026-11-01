import { expect, test } from 'vitest'
import { crashTimeline } from './timeline'

test('the flash starts white, turns brand red and is gone by 0.8 s', () => {
  const t0 = crashTimeline(0, false)
  expect(t0.flash).toBeGreaterThan(0.85)
  expect(t0.flashRed).toBe(0)
  expect(crashTimeline(0.3, false).flashRed).toBeGreaterThan(0.9)
  expect(crashTimeline(0.3, false).flash).toBeGreaterThan(0.2)
  expect(crashTimeline(0.8, false).flash).toBe(0)
})

test('chroma, shake and the zoom blur hit at once and fade', () => {
  const t0 = crashTimeline(0.02, false)
  expect(t0.chroma).toBeGreaterThan(0.9)
  expect(t0.shake).toBeGreaterThan(0.9)
  expect(t0.zoom).toBeGreaterThan(0.1)
  const late = crashTimeline(1.4, false)
  expect(late.chroma).toBeLessThan(0.05)
  expect(late.shake).toBeLessThan(0.05)
  expect(late.zoom).toBeLessThan(0.01)
})

test('the fireball grows, cools and fades; the shockwave runs out and dies', () => {
  let prev = crashTimeline(0, false)
  for (let a = 0.05; a < 2; a += 0.05) {
    const cur = crashTimeline(a, false)
    expect(cur.fireRadius).toBeGreaterThanOrEqual(prev.fireRadius)
    expect(cur.fireHeat).toBeLessThanOrEqual(prev.fireHeat)
    expect(cur.ringRadius).toBeGreaterThanOrEqual(prev.ringRadius)
    prev = cur
  }
  expect(crashTimeline(0, false).fireHeat).toBeCloseTo(1, 2)
  expect(crashTimeline(1.4, false).ringStrength).toBe(0)
  expect(crashTimeline(3, false).fireAlpha).toBeLessThan(0.05)
})

test('after a cash out everything plays 0.6× as long', () => {
  expect(crashTimeline(0.8 * 0.6, true).flash).toBe(0)
  expect(crashTimeline(0.5 * 0.6, true).fireRadius).toBeCloseTo(crashTimeline(0.5, false).fireRadius, 5)
})

test('once the flash has turned red it stays under half strength, so the fireball shows through', () => {
  for (let a = 0.25; a < 0.8; a += 0.05) expect(crashTimeline(a, false).flash).toBeLessThanOrEqual(0.45)
})
