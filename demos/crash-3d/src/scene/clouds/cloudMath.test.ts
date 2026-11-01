import { expect, test } from 'vitest'
import { altitudeAt, beerPowder, EARTH_R_M, henyeyGreenstein, marchDistance, remap, slabInterval, sphereHits } from './cloudMath'

const BASE = 1200
const TOP = 2600

test('sphere hits: straight up from the ground meets the shell at its altitude', () => {
  const [near, far] = sphereHits(0, 1, BASE)
  expect(far).toBeCloseTo(BASE, 3)
  expect(near).toBeCloseTo(-(2 * EARTH_R_M + BASE), -1)
})

test('sphere hits stay exact in float32 for a grazing ray far away', () => {
  const f = Math.fround
  // the same arithmetic rounded to float32 at every step, as the shader does it
  const h = f(300)
  const mu = f(0.01)
  const r = f(EARTH_R_M + h)
  const b = f(r * mu)
  const c = f(f(h - BASE) * f(2 * EARTH_R_M + h + BASE))
  const s = f(Math.sqrt(f(f(b * b) - c)))
  const q = f(-b + s)
  const exact = sphereHits(300, 0.01, BASE)[1]
  expect(Math.abs(q - exact) / exact).toBeLessThan(1e-5)
})

test('slab from below: base to top', () => {
  const [t0, t1] = slabInterval(300, 1, BASE, TOP)!
  expect(t0).toBeCloseTo(900, 3)
  expect(t1).toBeCloseTo(2300, 3)
  // a slanted ray crosses the deck farther away and for longer
  const [s0, s1] = slabInterval(300, 0.2, BASE, TOP)!
  expect(s0).toBeGreaterThan(900 / 0.2 - 100)
  expect(s1 - s0).toBeGreaterThan(1400 / 0.2 - 200)
})

test('slab from below: a level ray still meets the curved deck, about a hundred km out', () => {
  const [t0, t1] = slabInterval(300, 0, BASE, TOP)!
  expect(t0).toBeCloseTo(Math.sqrt(2 * EARTH_R_M * 900), -3)
  expect(t1).toBeGreaterThan(t0)
})

test('slab from inside: from the camera to the top, or to the base on the way down', () => {
  expect(slabInterval(1800, 1, BASE, TOP)).toEqual([0, expect.closeTo(800, 3)])
  expect(slabInterval(1800, -1, BASE, TOP)).toEqual([0, expect.closeTo(600, 3)])
  const level = slabInterval(1800, 0, BASE, TOP)!
  expect(level[0]).toBe(0)
  expect(level[1]).toBeCloseTo(Math.sqrt(2 * EARTH_R_M * 800), -3)
})

test('slab from above: top down to the base; level rays pass over it', () => {
  const [t0, t1] = slabInterval(11000, -1, BASE, TOP)!
  expect(t0).toBeCloseTo(8400, 3)
  expect(t1).toBeCloseTo(9800, 3)
  expect(slabInterval(11000, 0, BASE, TOP)).toBeNull()
  expect(slabInterval(11000, 0.3, BASE, TOP)).toBeNull()
  // grazing: dips into the deck past its top and climbs out without reaching the base
  const dipTop = Math.sqrt((2 * (11000 - TOP)) / EARTH_R_M)
  const dipBase = Math.sqrt((2 * (11000 - BASE)) / EARTH_R_M)
  const mu = -Math.sin((dipTop + dipBase) / 2)
  const [g0, g1] = slabInterval(11000, mu, BASE, TOP)!
  expect(g0).toBeGreaterThan(0)
  expect(g1).toBeGreaterThan(g0)
  expect(sphereHits(11000, mu, BASE)[0]).toBeNaN()
})

test('altitude of a point bends down with the earth', () => {
  expect(altitudeAt(500, 0, 100, 0)).toBeCloseTo(600, 6)
  // 100 km out on the level the ground has dropped about 785 m
  expect(altitudeAt(0, 100_000, 0, 0)).toBeCloseTo(785, 0)
})

test('henyey-greenstein: normalized, isotropic at g = 0, forward peaked for g > 0', () => {
  expect(henyeyGreenstein(0.3, 0)).toBeCloseTo(1 / (4 * Math.PI), 9)
  for (const g of [-0.3, 0.2, 0.6, 0.8]) {
    // integral over the sphere: 2 pi * integral over cos theta
    let sum = 0
    const n = 20000
    for (let i = 0; i < n; i++) {
      const c = -1 + ((i + 0.5) / n) * 2
      sum += henyeyGreenstein(c, g) * (2 / n)
    }
    expect(sum * 2 * Math.PI).toBeCloseTo(1, 2)
  }
  expect(henyeyGreenstein(1, 0.7)).toBeGreaterThan(henyeyGreenstein(-1, 0.7) * 50)
})

test('remap is linear and unclamped', () => {
  expect(remap(0.5, 0, 1, 2, 4)).toBe(3)
  expect(remap(0.2, 0.4, 1, 0, 1)).toBeCloseTo(-1 / 3, 9)
})

test('march distances run from the entry to the exit and widen with distance', () => {
  // the shader's LOG_C
  const n = 72
  const c = 120
  expect(marchDistance(0, 40000, n, 0, 0, c)).toBeCloseTo(0, 6)
  expect(marchDistance(0, 40000, n, n, 0, c)).toBeCloseTo(40000, 3)
  let last = -1
  let lastStep = 0
  for (let i = 0; i <= n; i++) {
    const t = marchDistance(0, 40000, n, i, 0, c)
    expect(t).toBeGreaterThan(last)
    if (i > 0) expect(t - last).toBeGreaterThan(lastStep)
    if (i > 0) lastStep = t - last
    last = t
  }
  // the first steps stay short enough to see wisps around a camera inside the deck
  expect(marchDistance(0, 40000, n, 1, 0, c)).toBeLessThan(12)
  // and a hundred meters out (the rocket, seen from inside) there are still a dozen samples before it
  let before = 0
  while (marchDistance(0, 40000, n, before, 0, c) < 140) before++
  expect(before).toBeGreaterThanOrEqual(10)
})

test('beer-powder: dark at the very edge and deep inside, brightest in between', () => {
  expect(beerPowder(0, 0)).toBe(0)
  expect(beerPowder(10, 1)).toBeLessThan(1e-4)
  expect(beerPowder(0.3, 0.6)).toBeGreaterThan(beerPowder(0.01, 0.02))
})
