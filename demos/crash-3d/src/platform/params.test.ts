import { expect, test } from 'vitest'
import { parseParams } from './params'

test('debug-only params are ignored without debug=1', () => {
  expect(parseParams('?seed=7&freeze=3&cam=close')).toEqual({ embed: false, debug: false, seed: null, freeze: null, cam: null, shot: null })
})

test('parses embed and debug params', () => {
  expect(parseParams('?embed=1&debug=1&seed=7&freeze=2.5&cam=top')).toEqual({ embed: true, debug: true, seed: 7, freeze: 2.5, cam: 'top', shot: null })
})

test('the pad wide shot is a debug camera too', () => {
  expect(parseParams('?debug=1&cam=pad').cam).toBe('pad')
  expect(parseParams('?cam=pad').cam).toBeNull()
})

test('the sun shot is a debug camera too', () => {
  expect(parseParams('?debug=1&cam=sun').cam).toBe('sun')
  expect(parseParams('?cam=sun').cam).toBeNull()
})

test('rejects garbage and out-of-range values', () => {
  expect(parseParams('?debug=1&seed=abc').seed).toBeNull()
  expect(parseParams('?debug=1&freeze=0.5').freeze).toBeNull()
  expect(parseParams('?debug=1&freeze=1001').freeze).toBeNull()
  expect(parseParams('?debug=1&cam=orbit').cam).toBeNull()
})

test('debug shot forces a broadcast camera, ignored without debug or when unknown', () => {
  expect(parseParams('?debug=1&shot=onboard').shot).toBe('onboard')
  expect(parseParams('?shot=onboard').shot).toBeNull()
  expect(parseParams('?debug=1&shot=selfie').shot).toBeNull()
})
