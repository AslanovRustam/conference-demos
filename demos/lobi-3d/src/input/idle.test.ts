import { afterEach, expect, test, vi } from 'vitest'
import { createIdleTimer } from './idle'

afterEach(() => {
  vi.useRealTimers()
})

test('fires once after the timeout; poke resets; stop cancels', async () => {
  vi.useFakeTimers()
  const onIdle = vi.fn()
  const t = createIdleTimer(1000, onIdle)
  t.start()
  await vi.advanceTimersByTimeAsync(900)
  t.poke()
  await vi.advanceTimersByTimeAsync(900)
  expect(onIdle).not.toHaveBeenCalled()
  await vi.advanceTimersByTimeAsync(100)
  expect(onIdle).toHaveBeenCalledTimes(1)
  await vi.advanceTimersByTimeAsync(5000)
  expect(onIdle).toHaveBeenCalledTimes(1)
  t.start()
  t.stop()
  await vi.advanceTimersByTimeAsync(5000)
  expect(onIdle).toHaveBeenCalledTimes(1)
})

test('poke before start does nothing', async () => {
  vi.useFakeTimers()
  const onIdle = vi.fn()
  const t = createIdleTimer(1000, onIdle)
  t.poke()
  await vi.advanceTimersByTimeAsync(5000)
  expect(onIdle).not.toHaveBeenCalled()
})
