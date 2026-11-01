import { expect, test } from 'vitest'
import { drogueOpen, ejectKind, mainOpen, retroThrust, startEject, stepEject } from './motion'

const DT = 1 / 60

function run(kind: 'chute' | 'retro', seconds: number) {
  const s = startEject(kind, { x: 0, alt: 1000, z: 0 }, 0)
  const track: { t: number; alt: number; x: number; vy: number }[] = []
  for (let t = 0; t < seconds; t += DT) {
    stepEject(s, DT)
    track.push({ t: s.t, alt: s.alt, x: s.x, vy: s.vy })
  }
  return { s, track }
}

test('a cash out in the air (stages 0–1) lands on parachutes, higher up the capsule brakes on thrusters', () => {
  expect(ejectKind(0)).toBe('chute')
  expect(ejectKind(1)).toBe('chute')
  expect(ejectKind(2)).toBe('retro')
  expect(ejectKind(5)).toBe('retro')
})

test('the drogue opens at 0.6 s, the main chute at 1.2 s and stays open', () => {
  expect(drogueOpen(0.59)).toBe(0)
  expect(drogueOpen(0.9)).toBeGreaterThan(0.5)
  expect(mainOpen(1.19)).toBe(0)
  expect(mainOpen(1.9)).toBeGreaterThan(0.8)
  expect(mainOpen(1.9)).toBeLessThanOrEqual(1.15) // inflation overshoot
  expect(mainOpen(5)).toBeCloseTo(1, 3)
})

test('the separation kicks the capsule up first, then it sinks under the main chute at a gentle rate', () => {
  const { track } = run('chute', 8)
  const at = (t: number) => track.find((p) => p.t >= t)!
  expect(at(0.4).alt).toBeGreaterThan(1000)
  expect(at(8 - DT).vy).toBeLessThan(-6)
  expect(at(8 - DT).vy).toBeGreaterThan(-8)
})

test('retro thrusters fire right after the separation and burn out within two seconds', () => {
  expect(retroThrust(0)).toBe(0)
  expect(retroThrust(0.3)).toBeGreaterThan(0.8)
  expect(retroThrust(2)).toBe(0)
})

test('on thrusters the capsule peels off to the side and drops below its starting point', () => {
  const { s } = run('retro', 2)
  expect(s.x).toBeGreaterThan(15)
  expect(s.alt).toBeLessThan(1000)
})
