import { expect, test } from 'vitest'
import { showLobbyExitButton } from './exitRules'

const g = { id: 'x', title: 'X', subtitle: '' }

test('corner exit button only for playing games without their own exit', () => {
  expect(showLobbyExitButton(g, 'playing')).toBe(true)
  expect(showLobbyExitButton({ ...g, ownExit: true }, 'playing')).toBe(false)
  expect(showLobbyExitButton(g, 'entering')).toBe(false)
})
