import { expect, test } from 'vitest'
import { ATTRACT_SCRIPT, attractRound } from './attract'

test('attract script cycles and includes a crash and a warp', () => {
  expect(attractRound(5)).toEqual(attractRound(0))
  expect(ATTRACT_SCRIPT.some((r) => r.autoAt === null)).toBe(true)
  expect(ATTRACT_SCRIPT.some((r) => r.crash >= 30)).toBe(true)
})

test('every scripted cash out happens before its crash', () => {
  for (const r of ATTRACT_SCRIPT) if (r.autoAt !== null) expect(r.autoAt).toBeLessThan(r.crash)
})
