import { expect, test } from 'vitest'
import { mapKey } from './hotkeys'

test('lobby keys', () => {
  expect(mapKey('ArrowLeft', 'lobby', false)).toEqual({ type: 'step', dir: -1 })
  expect(mapKey('a', 'lobby', false)).toEqual({ type: 'step', dir: -1 })
  expect(mapKey('d', 'lobby', false)).toEqual({ type: 'step', dir: 1 })
  expect(mapKey('ArrowRight', 'lobby', true)).toEqual({ type: 'step', dir: 1 })
  expect(mapKey('Enter', 'lobby', false)).toEqual({ type: 'enter' })
  expect(mapKey(' ', 'lobby', true)).toBeNull()
  expect(mapKey('3', 'lobby', false)).toEqual({ type: 'openGame', n: 3 })
  expect(mapKey('0', 'lobby', false)).toBeNull()
  expect(mapKey('M', 'lobby', false)).toEqual({ type: 'toggleMute' })
  expect(mapKey('f', 'lobby', false)).toEqual({ type: 'toggleFps' })
  expect(mapKey('t', 'lobby', false)).toEqual({ type: 'toggleAttract' })
})

test('only Escape works while a game is open', () => {
  for (const p of ['entering', 'playing'] as const) {
    expect(mapKey('Escape', p, false)).toEqual({ type: 'exit' })
    expect(mapKey('ArrowLeft', p, false)).toBeNull()
    expect(mapKey('m', p, false)).toBeNull()
  }
  expect(mapKey('Escape', 'exiting', false)).toBeNull()
  expect(mapKey('Enter', 'loading', false)).toBeNull()
})
