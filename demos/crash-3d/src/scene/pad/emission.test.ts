import { expect, test } from 'vitest'
import { timeAt } from '../../core/curve'
import { altitudeAt, exhaustRate, GROUND_REACH, launchClock, steamLevel, thrustAt } from './emission'

test('the launch clock runs from the countdown start through the flight', () => {
  expect(launchClock('betting', 5, 0)).toBeNull()
  expect(launchClock('countdown', 1.2, 0)).toBeCloseTo(1.2)
  expect(launchClock('flight', 0, 0.5)).toBeCloseTo(3.5)
  expect(launchClock('ejected', 0.1, 2)).toBeCloseTo(5)
  expect(launchClock('crashed', 0.2, 2)).toBeNull()
  expect(launchClock('result', 1, 2)).toBeNull()
})

test('thrust spools up over the last 1.5 s of the countdown, matching the rig', () => {
  expect(thrustAt(0)).toBe(0)
  expect(thrustAt(1.5)).toBe(0)
  expect(thrustAt(2.25)).toBeCloseTo(0.5)
  expect(thrustAt(3)).toBe(1)
  expect(thrustAt(9)).toBe(1)
})

test('the rocket leaves the deck at liftoff and climbs', () => {
  expect(altitudeAt(2)).toBe(0)
  expect(altitudeAt(3)).toBeCloseTo(0)
  expect(altitudeAt(3 + timeAt(1.1))).toBeCloseTo(209.1, 0)
  expect(altitudeAt(3.4)).toBeGreaterThan(altitudeAt(3.2))
})

test('exhaust clouds follow thrust and stop once the jet no longer reaches the pad', () => {
  expect(exhaustRate(1, 1000)).toBe(0) // engines cold
  expect(exhaustRate(2.25, 1000)).toBeGreaterThan(0)
  expect(exhaustRate(2.25, 1000)).toBeLessThan(500)
  expect(exhaustRate(3, 1000)).toBeCloseTo(1000) // full thrust on the deck
  const reach = 3 + timeAt(1 + 1e-9) // just off the deck
  expect(exhaustRate(reach, 1000)).toBeGreaterThan(900)
  // past the reach of the jet: L where the rocket is above GROUND_REACH[1]
  let L = 3
  while (altitudeAt(L) < GROUND_REACH[1]) L += 0.01
  expect(exhaustRate(L, 1000)).toBe(0)
})

test('steam vents idle while betting, build up in the countdown and stop at liftoff', () => {
  expect(steamLevel('betting', 10)).toBeCloseTo(1)
  expect(steamLevel('countdown', 0)).toBeCloseTo(1)
  expect(steamLevel('countdown', 1.4)).toBeGreaterThan(2)
  expect(steamLevel('flight', 0)).toBe(0)
  expect(steamLevel('crashed', 0)).toBe(0)
})
