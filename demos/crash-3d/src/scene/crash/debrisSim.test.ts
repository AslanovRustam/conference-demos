import { expect, test } from 'vitest'
import { createRng } from '../../core/rng'
import { spawnDebris, stepDebris } from './debrisSim'

test('pieces burst outwards from the blast in every direction', () => {
  const parts = spawnDebris(createRng(1), 320, { x: 0, alt: 1000, z: 0 })
  expect(parts).toHaveLength(320)
  const dirs = { px: 0, nx: 0, pz: 0, nz: 0 }
  for (const p of parts) {
    if (p.vx > 0) dirs.px++
    else dirs.nx++
    if (p.vz > 0) dirs.pz++
    else dirs.nz++
    expect(Math.hypot(p.vx, p.vy, p.vz)).toBeGreaterThan(5)
  }
  for (const n of Object.values(dirs)) expect(n).toBeGreaterThan(100)
})

test('in the air gravity pulls the pieces down, in space they coast', () => {
  const air = spawnDebris(createRng(2), 50, { x: 0, alt: 1000, z: 0 })
  const space = spawnDebris(createRng(2), 50, { x: 0, alt: 1000, z: 0 })
  const vy0 = space.map((p) => p.vy)
  for (let t = 0; t < 2; t += 1 / 60) {
    stepDebris(air, 1 / 60, true)
    stepDebris(space, 1 / 60, false)
  }
  expect(space.map((p) => p.vy)).toEqual(vy0)
  // gravity wins over every throw, even the ones flung upwards
  for (let t = 0; t < 2; t += 1 / 60) stepDebris(air, 1 / 60, true)
  expect(air.every((p) => p.vy < 0)).toBe(true)
})

test('pieces tumble and their glow cools down', () => {
  const parts = spawnDebris(createRng(3), 10, { x: 0, alt: 1000, z: 0 })
  const r0 = parts.map((p) => p.rx)
  for (let t = 0; t < 1; t += 1 / 60) stepDebris(parts, 1 / 60, false)
  expect(parts.some((p, i) => p.rx !== r0[i])).toBe(true)
  expect(parts.every((p) => p.heat < 1 && p.heat >= 0)).toBe(true)
})
