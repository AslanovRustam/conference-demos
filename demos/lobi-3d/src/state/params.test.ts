import { expect, test } from 'vitest'
import { parseParams } from './params'

test('parseParams reads presenter and test overrides', () => {
  expect(parseParams('?idle=3&attractIdle=2&tg=noready%3D1&fps=1')).toEqual({
    idleReturnSec: 3,
    attractIdleSec: 2,
    testGameQuery: 'noready=1',
    fps: true,
  })
})

test('parseParams defaults', () => {
  expect(parseParams('')).toEqual({ testGameQuery: '', fps: false })
})

test('parseParams ignores non-numeric timings', () => {
  expect(parseParams('?idle=abc')).toEqual({ testGameQuery: '', fps: false })
})
