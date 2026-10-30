import { expect, test } from 'vitest'
import { formatAlt, formatClock, formatCredits, formatMult, formatVel } from './format'

test('formats credits, multipliers, clock and telemetry', () => {
  expect(formatCredits(9563)).toBe('9,563')
  expect(formatMult(4.3)).toBe('4.30')
  expect(formatMult(1000)).toBe('1000.00')
  expect(formatClock(12.43)).toBe('T+00:12.4')
  expect(formatClock(75)).toBe('T+01:15.0')
  expect(formatAlt(0.42)).toBe('ALT 420 M')
  expect(formatAlt(84.25)).toBe('ALT 84.3 KM')
  expect(formatAlt(12400)).toBe('ALT 12,400 KM')
  expect(formatVel(2.414)).toBe('VEL 2.41 KM/S')
})

test('clock counts down before liftoff and units switch without odd rounding', () => {
  expect(formatClock(-2.43)).toBe('T-00:02.4')
  expect(formatClock(0)).toBe('T+00:00.0')
  expect(formatClock(8.2)).toBe('T+00:08.2')
  expect(formatAlt(0)).toBe('ALT 0 M')
  expect(formatAlt(0.9996)).toBe('ALT 1.0 KM')
  expect(formatAlt(999.97)).toBe('ALT 1,000 KM')
  expect(formatCredits(437.9)).toBe('438')
})
