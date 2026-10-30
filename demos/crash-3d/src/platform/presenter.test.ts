import { expect, test } from 'vitest'
import { createCodeDetector } from './presenter'

test('typing HYPER within 2 s fires once', () => {
  const hits: string[] = []
  const feed = createCodeDetector({ HYPER: () => hits.push('warp'), NUKE: () => hits.push('boom') })
  ;['H', 'Y', 'P', 'E', 'R'].forEach((k, i) => feed(k, i * 300))
  expect(hits).toEqual(['warp'])
})

test('slow typing or other keys do not fire', () => {
  const hits: string[] = []
  const feed = createCodeDetector({ HYPER: () => hits.push('warp') })
  ;['H', 'Y', 'P'].forEach((k, i) => feed(k, i * 300))
  feed('E', 5000)
  ;['H', 'Y', 'X', 'E', 'R'].forEach((k, i) => feed(k, 6000 + i * 100))
  expect(hits).toEqual([])
})

test('NUKE fires and the buffer resets so it can fire again', () => {
  const hits: string[] = []
  const feed = createCodeDetector({ NUKE: () => hits.push('boom') })
  ;['N', 'U', 'K', 'E'].forEach((k, i) => feed(k, i * 100))
  ;['N', 'U', 'K', 'E'].forEach((k, i) => feed(k, 1000 + i * 100))
  expect(hits).toEqual(['boom', 'boom'])
})
