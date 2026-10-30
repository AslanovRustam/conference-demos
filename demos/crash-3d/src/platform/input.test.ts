import { expect, test, vi } from 'vitest'
import { bindKeyboard, type KeyHandlers } from './input'

interface FakeKey {
  code?: string
  key?: string
  repeat?: boolean
}

function setupKeys() {
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
    anyInput: () => void calls.anyInput++,
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
