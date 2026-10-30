import { expect, test } from 'vitest'
import { createCodeDetector } from './presenter'

test('typing WARP within 2 s fires once', () => {
  const hits: string[] = []
  const feed = createCodeDetector({ WARP: () => hits.push('warp'), BOOM: () => hits.push('boom') })
  ;['W', 'A', 'R', 'P'].forEach((k, i) => feed(k, i * 300))
  expect(hits).toEqual(['warp'])
})

test('slow typing or other keys do not fire', () => {
  const hits: string[] = []
  const feed = createCodeDetector({ WARP: () => hits.push('warp') })
  ;['W', 'A', 'R'].forEach((k, i) => feed(k, i * 300))
  feed('P', 5000)
  ;['W', 'X', 'R', 'P'].forEach((k, i) => feed(k, 6000 + i * 100))
  expect(hits).toEqual([])
})

test('BOOM fires and the buffer resets so it can fire again', () => {
  const hits: string[] = []
  const feed = createCodeDetector({ BOOM: () => hits.push('boom') })
  ;['B', 'O', 'O', 'M'].forEach((k, i) => feed(k, i * 100))
  ;['B', 'O', 'O', 'M'].forEach((k, i) => feed(k, 1000 + i * 100))
  expect(hits).toEqual(['boom', 'boom'])
})
