import { expect, test } from 'vitest'
import { createIdleTimer } from './idle'

test('idle fires once after 45 s without input and re-arms after a poke', () => {
  let now = 0
  let fired = 0
  const t = createIdleTimer(45_000, () => fired++, () => now)
  now = 44_999
  t.tick()
  expect(fired).toBe(0)
  now = 45_000
  t.tick()
  t.tick()
  expect(fired).toBe(1)
  t.poke()
  now = 89_999
  t.tick()
  expect(fired).toBe(1)
  now = 90_000
  t.tick()
  expect(fired).toBe(2)
})

test('a disposed timer never fires', () => {
  let now = 0
  let fired = 0
  const t = createIdleTimer(1000, () => fired++, () => now)
  t.dispose()
  now = 5000
  t.tick()
  expect(fired).toBe(0)
})
