import { expect, test } from 'vitest'
import { GROUND_Y } from '../pad/layout'
import { cameraAltitudeM, milkyWayAt, skyExposureAt, skyFadeAt, starLimitAt, STAR_LIMIT_PAD, STAR_LIMIT_SPACE } from './skyCurves'

const steps = (f: (s: number) => number) => Array.from({ length: 121 }, (_, i) => f(i * 0.05))

test('the sky exposure only comes down as the rocket climbs', () => {
  expect(skyExposureAt(0)).toBe(400)
  const e = steps(skyExposureAt)
  for (let i = 1; i < e.length; i++) expect(e[i]).toBeLessThanOrEqual(e[i - 1] + 1e-9)
  expect(skyExposureAt(6)).toBeGreaterThan(0)
})

test('the dome is gone by the time the earth carries the horizon', () => {
  expect(skyFadeAt(0)).toBe(1)
  expect(skyFadeAt(2.3)).toBe(1)
  expect(skyFadeAt(2.9)).toBe(0)
  expect(skyFadeAt(4)).toBe(0)
})

test('only the brightest stars on the pad, the whole field from stage 2.5', () => {
  expect(starLimitAt(0)).toBe(STAR_LIMIT_PAD)
  expect(starLimitAt(1.5)).toBe(STAR_LIMIT_PAD)
  expect(starLimitAt(2.5)).toBe(STAR_LIMIT_SPACE)
  const l = steps(starLimitAt)
  for (let i = 1; i < l.length; i++) expect(l[i]).toBeGreaterThanOrEqual(l[i - 1])
  expect(milkyWayAt(1)).toBe(0)
  expect(milkyWayAt(3)).toBe(1)
})

test('camera altitude counts from the ground and the sunk near field', () => {
  expect(cameraAltitudeM(GROUND_Y, 0)).toBe(0)
  expect(cameraAltitudeM(GROUND_Y + 50, 0)).toBe(50)
  expect(cameraAltitudeM(6000, 1000)).toBe(6000 - GROUND_Y + 1000)
  expect(cameraAltitudeM(GROUND_Y - 5, 0)).toBe(0)
})
