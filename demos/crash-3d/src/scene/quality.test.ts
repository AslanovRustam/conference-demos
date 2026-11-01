import { expect, test } from 'vitest'
import { QUALITY_TIERS, tierFor } from './quality'

test('a discrete gpu gets ultra, a laptop\'s integrated one medium, a phone low', () => {
  expect(tierFor('ANGLE (NVIDIA, NVIDIA GeForce RTX 5060 Laptop GPU Direct3D11 vs_5_0 ps_5_0, D3D11)', false)).toBe('ultra')
  expect(tierFor('ANGLE (AMD, AMD Radeon RX 7800 XT Direct3D11 vs_5_0 ps_5_0, D3D11)', false)).toBe('ultra')
  expect(tierFor('ANGLE (Intel, Intel(R) UHD Graphics (0x0000A78B) Direct3D11 vs_5_0 ps_5_0, D3D11)', false)).toBe('medium')
  expect(tierFor('ANGLE (Intel, Intel(R) Iris(R) Xe Graphics Direct3D11 vs_5_0 ps_5_0, D3D11)', false)).toBe('medium')
  expect(tierFor('Apple M2', false)).toBe('medium')
  expect(tierFor('Adreno (TM) 740', true)).toBe('low')
  expect(tierFor('Apple GPU', true)).toBe('low')
  expect(tierFor('', false)).toBe('medium') // unknown: play safe
})

test('a debug override wins over the gpu', () => {
  expect(tierFor('NVIDIA GeForce RTX 5060', false, 'low')).toBe('low')
})

test('each tier is cheaper than the one above it where it counts', () => {
  const { ultra, medium, low } = QUALITY_TIERS
  for (const [a, b] of [[ultra, medium], [medium, low]] as const) {
    expect(b.cloudSteps).toBeLessThan(a.cloudSteps)
    expect(b.cloudScale).toBeLessThanOrEqual(a.cloudScale)
    expect(b.smokeParticles).toBeLessThan(a.smokeParticles)
  }
  // render scale: the laptop's integrated gpu draws the 3d under its 1x screen, a phone (2-3x) well under native
  expect(medium.dpr[1]).toBeLessThan(ultra.dpr[1])
  expect(medium.dpr[1]).toBeLessThan(1)
  expect(low.dpr[1]).toBeLessThanOrEqual(1.25)
  expect(medium.padReflection.enabled).toBe(false)
  expect(low.godRays).toBe(false)
})
