import { expect, test } from 'vitest'
import { lampColor } from './materials'

test('lamp: warm white when active, dim red otherwise, bright red while flashing', () => {
  const on = lampColor(true, 0)
  const off = lampColor(false, 0)
  const flash = lampColor(false, 1)
  expect(on.r).toBeGreaterThan(1.5)
  expect(on.g).toBeGreaterThan(1.2)
  expect(off.r).toBeLessThan(1)
  expect(off.g).toBeLessThan(0.1)
  expect(flash.r).toBeGreaterThan(2)
})

test('the core mark is bright enough to bloom (luminance above the 1.1 + 0.3 bloom ramp)', async () => {
  const { CORE_GLOW } = await import('./materials')
  const lum = 0.2126 * CORE_GLOW.r + 0.7152 * CORE_GLOW.g + 0.0722 * CORE_GLOW.b
  expect(lum).toBeGreaterThanOrEqual(1.4)
})
