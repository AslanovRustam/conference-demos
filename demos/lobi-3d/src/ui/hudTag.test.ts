import { expect, test } from 'vitest'
import type { Slot } from '../config/games'
import { hudCaption, hudTag } from './hudTag'

const game = (id: string): Slot => ({ kind: 'game', key: `game:${id}`, game: { id, title: id, subtitle: '' }, url: '' })
const soon = (n: number): Slot => ({ kind: 'soon', key: `pad:${n}`, title: null })
const slots = [game('a'), soon(0), game('b'), soon(1)]

test('hudTag numbers games among game slots only', () => {
  expect(hudTag(slots, 0)).toBe('GAME 01 / 02')
  expect(hudTag(slots, 2)).toBe('GAME 02 / 02')
  expect(hudTag(slots, 1)).toBe('COMING SOON')
})

test('padding cabinets do not repeat COMING SOON in the title', () => {
  const cap = hudCaption(soon(3))
  expect(hudTag([soon(3)], 0)).toBe('COMING SOON')
  expect(cap.title).not.toBe('COMING SOON')
  expect(hudCaption({ kind: 'soon', key: 'soon:x', title: 'PLINKO 3D' }).title).toBe('PLINKO 3D')
  expect(hudCaption(game('a')).title).toBe('a')
})
