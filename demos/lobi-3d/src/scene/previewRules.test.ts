import { expect, test } from 'vitest'
import { previewShouldPlay } from './previewRules'

test('only the active cabinet plays, and only while the lobby is on screen', () => {
  expect(previewShouldPlay(0, 'lobby')).toBe(true)
  expect(previewShouldPlay(1, 'lobby')).toBe(false)
  expect(previewShouldPlay(0, 'entering')).toBe(false)
  expect(previewShouldPlay(0, 'playing')).toBe(false)
  expect(previewShouldPlay(0, 'exiting')).toBe(false)
})
