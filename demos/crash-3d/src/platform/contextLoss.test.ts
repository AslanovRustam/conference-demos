import { expect, test } from 'vitest'
import { reloadOnContextLoss } from './contextLoss'
import type { SafeStorage } from './storage'

function setup(stamp: string | null = null) {
  const listeners = new Map<string, () => void>()
  const canvas = {
    addEventListener: (t: string, fn: () => void) => void listeners.set(t, fn),
    removeEventListener: (t: string) => void listeners.delete(t),
  }
  const store = new Map<string, string>(stamp ? [['crash.ctxReload', stamp]] : [])
  const storage: SafeStorage = { get: (k) => store.get(k) ?? null, set: (k, v) => void store.set(k, v) }
  let reloads = 0
  const off = reloadOnContextLoss(canvas, () => reloads++, storage)
  const lose = () => listeners.get('webglcontextlost')?.()
  return { lose, off, reloads: () => reloads, listeners, store }
}

test('a lost webgl context reloads the page instead of leaving a frozen frame', () => {
  const s = setup()
  s.lose()
  expect(s.reloads()).toBe(1)
  expect(s.store.get('crash.ctxReload')).toBe('1')
})

test('only once per session: a phone that keeps losing it does not reload in a loop', () => {
  const s = setup('1')
  s.lose()
  expect(s.reloads()).toBe(0)
})

test('unbinding stops listening', () => {
  const s = setup()
  s.off()
  expect(s.listeners.size).toBe(0)
})
