import { expect, test, vi } from 'vitest'
import { bindKeyboard, type KeyHandlers } from './input'

interface FakeKey {
  code?: string
  key?: string
  repeat?: boolean
  ctrlKey?: boolean
  metaKey?: boolean
  altKey?: boolean
}

function setupKeys(wakes = false) {
  let listener: ((e: unknown) => void) | null = null
  const target = {
    addEventListener: (_t: string, fn: (e: unknown) => void) => {
      listener = fn
    },
    removeEventListener: () => {
      listener = null
    },
  }
  const calls = { primary: 0, bet: [] as number[], auto: [] as number[], toggleAuto: 0, mute: 0, exit: 0, anyInput: 0, code: [] as string[] }
  const handlers: KeyHandlers = {
    primary: () => void calls.primary++,
    bet: (d) => void calls.bet.push(d),
    auto: (d) => void calls.auto.push(d),
    toggleAuto: () => void calls.toggleAuto++,
    mute: () => void calls.mute++,
    exit: () => void calls.exit++,
    anyInput: () => {
      calls.anyInput++
      return wakes
    },
    code: (k) => void calls.code.push(k),
  }
  const unbind = bindKeyboard(target as unknown as Window, handlers)
  const preventDefault = vi.fn()
  const fire = (e: FakeKey) => listener?.({ code: '', key: '', repeat: false, ...e, preventDefault })
  return { fire, calls, preventDefault, unbind, isBound: () => listener !== null }
}

test('space and enter trigger primary, auto-repeat is ignored', () => {
  const { fire, calls } = setupKeys()
  fire({ code: 'Space' })
  fire({ code: 'Space', repeat: true })
  fire({ code: 'Enter' })
  expect(calls.primary).toBe(2)
})

test('arrows step bet and auto, A toggles auto, M mutes, Escape exits', () => {
  const { fire, calls } = setupKeys()
  fire({ code: 'ArrowUp' })
  fire({ code: 'ArrowDown' })
  fire({ code: 'ArrowRight' })
  fire({ code: 'KeyA' })
  fire({ code: 'KeyM' })
  fire({ code: 'Escape' })
  expect(calls).toMatchObject({ bet: [1, -1], auto: [1], toggleAuto: 1, mute: 1, exit: 1 })
})

test('every keydown counts as input and feeds the code detector', () => {
  const { fire, calls } = setupKeys()
  fire({ code: 'KeyW', key: 'w' })
  expect(calls.anyInput).toBe(1)
  expect(calls.code).toEqual(['W'])
})

test('non-letter keys do not feed the code detector', () => {
  const { fire, calls } = setupKeys()
  fire({ code: 'Space', key: ' ' })
  fire({ code: 'ArrowUp', key: 'ArrowUp' })
  expect(calls.code).toEqual([])
})

test('primary keys prevent default page scrolling', () => {
  const { fire, preventDefault } = setupKeys()
  fire({ code: 'Space' })
  expect(preventDefault).toHaveBeenCalledTimes(1)
  fire({ code: 'KeyW', key: 'w' })
  expect(preventDefault).toHaveBeenCalledTimes(1)
})

test('unbind removes the listener', () => {
  const { unbind, isBound } = setupKeys()
  expect(isBound()).toBe(true)
  unbind()
  expect(isBound()).toBe(false)
})

test('typing HYPER and NUKE triggers no auto toggle and no mute', () => {
  const { fire, calls } = setupKeys()
  for (const ch of 'HYPERNUKE') fire({ code: `Key${ch}`, key: ch.toLowerCase() })
  expect(calls.code.join('')).toBe('HYPERNUKE')
  expect(calls.toggleAuto).toBe(0)
  expect(calls.mute).toBe(0)
})

test('codes come from the physical key, so they work on a cyrillic layout', () => {
  const { fire, calls } = setupKeys()
  for (const [code, key] of [['KeyH', 'р'], ['KeyY', 'н'], ['KeyP', 'з'], ['KeyE', 'у'], ['KeyR', 'к']]) fire({ code, key })
  expect(calls.code.join('')).toBe('HYPER')
})

test('ctrl, meta and alt combos belong to the browser', () => {
  const { fire, calls, preventDefault } = setupKeys()
  fire({ code: 'KeyM', key: 'm', ctrlKey: true })
  fire({ code: 'KeyA', key: 'a', metaKey: true })
  fire({ code: 'Space', key: ' ', altKey: true })
  expect(calls).toMatchObject({ mute: 0, toggleAuto: 0, primary: 0, anyInput: 0, code: [] })
  expect(preventDefault).not.toHaveBeenCalled()
})

test('a key that wakes the game from attract does nothing else but still counts towards a code', () => {
  const { fire, calls, preventDefault } = setupKeys(true)
  fire({ code: 'Space', key: ' ' })
  fire({ code: 'KeyM', key: 'm' })
  expect(calls).toMatchObject({ primary: 0, mute: 0, anyInput: 2, code: ['M'] })
  // space still must not press a focused button or scroll
  expect(preventDefault).toHaveBeenCalledTimes(1)
})

test('Escape always reaches exit, even when the key only woke the game or the stage is still loading', () => {
  const { fire, calls } = setupKeys(true)
  fire({ code: 'Escape', key: 'Escape' })
  expect(calls).toMatchObject({ exit: 1, anyInput: 1 })
})
