import { expect, test } from 'vitest'
import { exitToLobby, parseLobbyMessage, readyToLobby } from './embed'

function parent() {
  const sent: unknown[] = []
  return { sent, postMessage: (m: unknown, o: string) => void sent.push([m, o]) }
}

test('posts clickable:exit to the parent only when embedded', () => {
  const p = parent()
  exitToLobby(p, { embed: false })
  expect(p.sent).toEqual([])
  exitToLobby(p, { embed: true })
  expect(p.sent).toEqual([[{ type: 'clickable:exit' }, '*']])
})

test('tells the lobby when the scene is ready, only when embedded', () => {
  const p = parent()
  readyToLobby(p, { embed: false })
  expect(p.sent).toEqual([])
  readyToLobby(p, { embed: true })
  expect(p.sent).toEqual([[{ type: 'clickable:ready' }, '*']])
})

test('takes mute and visible from the parent window of the same origin only', () => {
  const lobby = {}
  const from = (data: unknown, origin = 'http://lobby', source: unknown = lobby) => parseLobbyMessage({ data, origin, source }, 'http://lobby', lobby)
  expect(from({ type: 'clickable:mute', muted: true })).toEqual({ type: 'mute', muted: true })
  expect(from({ type: 'clickable:visible' })).toEqual({ type: 'visible' })
  expect(from({ type: 'clickable:mute', muted: true }, 'http://evil')).toBeNull()
  expect(from({ type: 'clickable:mute', muted: true }, 'http://lobby', {})).toBeNull()
  expect(from({ type: 'clickable:mute', muted: 'yes' })).toBeNull()
  expect(from('clickable:mute')).toBeNull()
  expect(from(null)).toBeNull()
})
