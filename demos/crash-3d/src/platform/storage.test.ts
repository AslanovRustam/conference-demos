import { expect, test } from 'vitest'
import { createSafeStorage } from './storage'

test('safeStorage survives a throwing localStorage', () => {
  const thrower = {
    getItem() {
      throw new Error('denied')
    },
    setItem() {
      throw new Error('denied')
    },
  }
  const s = createSafeStorage(() => thrower as unknown as Storage)
  expect(s.get('muted')).toBeNull()
  expect(() => s.set('muted', '1')).not.toThrow()
})

test('safeStorage survives the getter itself throwing', () => {
  const s = createSafeStorage(() => {
    throw new Error('no storage')
  })
  expect(s.get('a')).toBeNull()
  expect(() => s.set('a', 'b')).not.toThrow()
})

test('safeStorage reads back what it wrote', () => {
  const map = new Map<string, string>()
  const fake = { getItem: (k: string) => map.get(k) ?? null, setItem: (k: string, v: string) => void map.set(k, v) }
  const s = createSafeStorage(() => fake as unknown as Storage)
  s.set('muted', '1')
  expect(s.get('muted')).toBe('1')
})
