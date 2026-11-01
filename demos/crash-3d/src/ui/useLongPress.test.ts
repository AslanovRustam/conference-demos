import { afterEach, expect, test, vi } from 'vitest'
import { createPressTimer } from './useLongPress'

afterEach(() => {
  vi.useRealTimers()
})

test('holding for the full time fires once', () => {
  vi.useFakeTimers()
  let fired = 0
  const p = createPressTimer(2000, () => fired++)
  p.down()
  vi.advanceTimersByTime(1999)
  expect(fired).toBe(0)
  vi.advanceTimersByTime(1)
  expect(fired).toBe(1)
  vi.advanceTimersByTime(5000)
  expect(fired).toBe(1)
})

test('letting go early cancels', () => {
  vi.useFakeTimers()
  let fired = 0
  const p = createPressTimer(2000, () => fired++)
  p.down()
  vi.advanceTimersByTime(1500)
  p.up()
  vi.advanceTimersByTime(1000)
  expect(fired).toBe(0)
})

test('a second press restarts the clock', () => {
  vi.useFakeTimers()
  let fired = 0
  const p = createPressTimer(2000, () => fired++)
  p.down()
  vi.advanceTimersByTime(1500)
  p.down()
  vi.advanceTimersByTime(1500)
  expect(fired).toBe(0)
  vi.advanceTimersByTime(500)
  expect(fired).toBe(1)
})
