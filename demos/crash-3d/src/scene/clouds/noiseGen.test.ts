import { expect, test } from 'vitest'
import { blueNoise, perlin3, perlinFbm, perlinLattice, perlinOctaves, shapeSlices, weatherMap, worley3, worleyGrid } from './noiseGen'

test('perlin repeats with its lattice period', () => {
  const l = perlinLattice(4, 7)
  for (const [x, y, z] of [[0.3, 1.7, 2.2], [3.9, 0.1, 0.5], [1.25, 2.5, 3.75]]) {
    expect(perlin3(l, x + 4, y, z)).toBeCloseTo(perlin3(l, x, y, z), 9)
    expect(perlin3(l, x, y - 4, z + 8)).toBeCloseTo(perlin3(l, x, y, z), 9)
  }
  // zero on the lattice, smooth and bounded between
  expect(perlin3(l, 1, 2, 3)).toBe(0)
  const oct = perlinOctaves(4, 4, 1)
  for (let i = 0; i < 200; i++) {
    const v = perlinFbm(oct, Math.random(), Math.random(), Math.random())
    expect(v).toBeGreaterThanOrEqual(0)
    expect(v).toBeLessThanOrEqual(1)
  }
})

test('worley wraps at the tile edge and peaks on its feature points', () => {
  const g = worleyGrid(8, 3)
  for (const [u, v, w] of [[0.001, 0.4, 0.7], [0.5, 0.0005, 0.25]]) {
    expect(worley3(g, u + 1, v, w)).toBeCloseTo(worley3(g, u, v, w), 6)
    expect(worley3(g, u, v + 1, w - 1)).toBeCloseTo(worley3(g, u, v, w), 6)
  }
  // across the seam: the last and the first voxel of a 128 grid are neighbors
  const a = worley3(g, 127.5 / 128, 0.3, 0.6)
  const b = worley3(g, 0.5 / 128, 0.3, 0.6)
  expect(Math.abs(a - b)).toBeLessThan(0.1)
  // a feature point itself
  const p = g.points
  expect(worley3(g, p[0] / 8, p[1] / 8, p[2] / 8)).toBeCloseTo(1, 6)
})

test('shape slices do not depend on how the volume is split', () => {
  const n = 16
  const whole = shapeSlices(n, 0, n)
  const lo = shapeSlices(n, 0, 5)
  const hi = shapeSlices(n, 5, n)
  expect(Array.from(lo.pw)).toEqual(Array.from(whole.pw.subarray(0, 5 * n * n)))
  expect(Array.from(hi.wf)).toEqual(Array.from(whole.wf.subarray(5 * n * n)))
  for (const v of whole.pw) {
    expect(v).toBeGreaterThanOrEqual(0)
    expect(v).toBeLessThanOrEqual(1)
  }
})

test('weather map: full byte range, seamless across its edges', () => {
  const size = 64
  const map = weatherMap(size)
  expect(map.length).toBe(size * size * 2)
  let lo = 255
  let hi = 0
  for (let i = 0; i < map.length; i += 2) {
    lo = Math.min(lo, map[i])
    hi = Math.max(hi, map[i])
  }
  expect(lo).toBe(0)
  expect(hi).toBe(255)
  // the step from the last column to the first is no bigger than an ordinary step between columns
  let seam = 0
  let inner = 0
  for (let y = 0; y < size; y++) {
    seam += Math.abs(map[(y * size + size - 1) * 2] - map[y * size * 2])
    inner += Math.abs(map[(y * size + 10) * 2] - map[(y * size + 11) * 2])
  }
  expect(seam).toBeLessThan(inner * 2 + size * 2)
})

test('blue noise: every rank once, no low-frequency clumps', () => {
  const size = 32
  const b = blueNoise(size)
  // ranks spread evenly over the bytes
  const hist = new Array(8).fill(0)
  for (const v of b) hist[v >> 5]++
  for (const h of hist) expect(h).toBe((size * size) / 8)
  // the darkest tenth is spread out: each dot's nearest neighbor sits farther away than in white noise (about 1.6)
  const dots: [number, number][] = []
  for (let i = 0; i < b.length; i++) if (b[i] < 26) dots.push([i % size, Math.floor(i / size)])
  let sum = 0
  for (const [x0, y0] of dots) {
    let nearest = Infinity
    for (const [x1, y1] of dots) {
      if (x0 === x1 && y0 === y1) continue
      const dx = Math.min(Math.abs(x0 - x1), size - Math.abs(x0 - x1))
      const dy = Math.min(Math.abs(y0 - y1), size - Math.abs(y0 - y1))
      nearest = Math.min(nearest, Math.hypot(dx, dy))
    }
    sum += nearest
  }
  expect(sum / dots.length).toBeGreaterThan(2.3)
})
