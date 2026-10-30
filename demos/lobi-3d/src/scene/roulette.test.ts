import { expect, test } from 'vitest'
import { ROULETTE_SEGMENTS, segmentColor } from './roulette'

test('one green zero, then red and black alternate', () => {
  expect(segmentColor(0)).toBe('green')
  expect(segmentColor(1)).toBe('red')
  expect(segmentColor(2)).toBe('black')
  expect(segmentColor(36)).toBe('black')
  const colors = Array.from({ length: ROULETTE_SEGMENTS }, (_, i) => segmentColor(i))
  expect(colors.filter((c) => c === 'red')).toHaveLength(18)
  expect(colors.filter((c) => c === 'black')).toHaveLength(18)
})
