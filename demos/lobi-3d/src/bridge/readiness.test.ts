import { afterEach, beforeEach, expect, test, vi } from 'vitest'
import { createReadiness } from './readiness'

beforeEach(() => {
  vi.useFakeTimers()
})
afterEach(() => {
  vi.useRealTimers()
})

test('message wins immediately', async () => {
  const r = createReadiness({ timeoutMs: 15000, revealDelayMs: 0 })
  r.messageReady()
  await expect(r.result).resolves.toBe('message')
})

test('probe success waits revealDelayMs', async () => {
  const r = createReadiness({ timeoutMs: 15000, revealDelayMs: 500 })
  let done = false
  r.result.then(() => {
    done = true
  })
  r.loaded(async () => true)
  await vi.advanceTimersByTimeAsync(499)
  expect(done).toBe(false)
  await vi.advanceTimersByTimeAsync(1)
  await expect(r.result).resolves.toBe('probe')
})

test('failed probe and no message → timeout at 15 s', async () => {
  const r = createReadiness({ timeoutMs: 15000, revealDelayMs: 0 })
  let done = false
  r.result.then(() => {
    done = true
  })
  r.loaded(async () => false)
  await vi.advanceTimersByTimeAsync(14999)
  expect(done).toBe(false)
  await vi.advanceTimersByTimeAsync(1)
  await expect(r.result).resolves.toBe('timeout')
})

test('first reason sticks', async () => {
  const r = createReadiness({ timeoutMs: 15000, revealDelayMs: 0 })
  r.loaded(async () => true)
  await vi.advanceTimersByTimeAsync(0)
  r.messageReady()
  await expect(r.result).resolves.toBe('probe')
})

test('dispose stops the timeout', async () => {
  const r = createReadiness({ timeoutMs: 1000, revealDelayMs: 0 })
  let done = false
  r.result.then(() => {
    done = true
  })
  r.dispose()
  await vi.advanceTimersByTimeAsync(5000)
  expect(done).toBe(false)
})
