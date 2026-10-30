import { expect, test } from 'vitest'
import type { Slot } from '../config/games'
import { hudTag } from './hudTag'

const game = (id: string): Slot => ({ kind: 'game', key: `game:${id}`, game: { id, title: id, subtitle: '' }, url: '' })
const soon = (n: number): Slot => ({ kind: 'soon', key: `pad:${n}`, title: null })
const slots = [game('a'), soon(0), game('b'), soon(1)]

test('hudTag numbers games among game slots only', () => {
  expect(hudTag(slots, 0)).toBe('GAME 01 / 02')
  expect(hudTag(slots, 2)).toBe('GAME 02 / 02')
  expect(hudTag(slots, 1)).toBe('COMING SOON')
})
