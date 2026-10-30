import { expect, test, vi } from 'vitest'
import { parseGameMessage, sendToGame } from './protocol'

const src = {}
const ok = { origin: 'http://x', source: src }

test('accepts known messages from the open game only', () => {
  expect(parseGameMessage({ ...ok, data: { type: 'clickable:exit' } }, 'http://x', src)).toEqual({ type: 'clickable:exit' })
  expect(parseGameMessage({ ...ok, data: { type: 'clickable:ready' } }, 'http://x', src)).toEqual({ type: 'clickable:ready' })
  expect(parseGameMessage({ ...ok, origin: 'http://evil', data: { type: 'clickable:exit' } }, 'http://x', src)).toBeNull()
  expect(parseGameMessage({ ...ok, source: {}, data: { type: 'clickable:exit' } }, 'http://x', src)).toBeNull()
  expect(parseGameMessage({ ...ok, data: 'clickable:exit' }, 'http://x', src)).toBeNull()
  expect(parseGameMessage({ ...ok, data: { type: 'clickable:other' } }, 'http://x', src)).toBeNull()
  expect(parseGameMessage({ ...ok, data: null }, 'http://x', src)).toBeNull()
})

test('sendToGame posts with the lobby origin', () => {
  const postMessage = vi.fn()
  sendToGame({ postMessage } as unknown as Window, { type: 'clickable:mute', muted: true }, 'http://x')
  expect(postMessage).toHaveBeenCalledWith({ type: 'clickable:mute', muted: true }, 'http://x')
  expect(() => sendToGame(null, { type: 'clickable:visible' }, 'http://x')).not.toThrow()
})

test('on reveal the game gets visible + mute, unless its config opts out of visible', async () => {
  const { revealMessages } = await import('./protocol')
  const g = { id: 'a', title: 'A', subtitle: '' }
  expect(revealMessages(g, true)).toEqual([{ type: 'clickable:visible' }, { type: 'clickable:mute', muted: true }])
  expect(revealMessages({ ...g, sendVisible: false }, false)).toEqual([{ type: 'clickable:mute', muted: false }])
})
