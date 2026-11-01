// procedural, tileable noise for the volumetric clouds. pure functions: the worker (noise.worker.ts) runs them off the
// main thread and the tests run them in node.
// shape volume, two bytes per voxel: R perlin-worley (billowy lumps, the cloud bodies), G worley fbm (the cauliflower
// detail that erodes their edges). weather map, two bytes per texel: R coverage, G cloud height (low stratus to tall
// heaps). every feature wraps at the tile edges, so the textures repeat without seams

// integer hash of a lattice point -> 0..1
export function hash3(x: number, y: number, z: number, seed: number): number {
  let h = (Math.imul(x, 374761393) + Math.imul(y, 668265263) + Math.imul(z, 1440662683) + Math.imul(seed, 1013904223)) | 0
  h = Math.imul(h ^ (h >>> 13), 1274126177)
  h ^= h >>> 16
  return (h >>> 0) / 4294967296
}

const wrap = (i: number, p: number) => ((i % p) + p) % p
const fade = (t: number) => t * t * t * (t * (t * 6 - 15) + 10)

// the 12 edge directions of a cube, perlin's gradient set
const GRAD = new Int8Array([1, 1, 0, -1, 1, 0, 1, -1, 0, -1, -1, 0, 1, 0, 1, -1, 0, 1, 1, 0, -1, -1, 0, -1, 0, 1, 1, 0, -1, 1, 0, 1, -1, 0, -1, -1])

// perlin lattice that repeats every `period` cells on each axis: a gradient (offset into GRAD) per lattice point
export interface PerlinLattice {
  period: number
  grads: Uint8Array
}

export function perlinLattice(period: number, seed: number): PerlinLattice {
  const n = period * period * period
  const grads = new Uint8Array(n)
  for (let z = 0; z < period; z++) {
    for (let y = 0; y < period; y++) {
      for (let x = 0; x < period; x++) grads[(z * period + y) * period + x] = Math.floor(hash3(x, y, z, seed) * 12) * 3
    }
  }
  return { period, grads }
}

// perlin gradient noise on a repeating lattice, about -1..1; x, y, z in lattice cells
export function perlin3(l: PerlinLattice, x: number, y: number, z: number): number {
  const p = l.period
  const g = l.grads
  const ix = Math.floor(x)
  const iy = Math.floor(y)
  const iz = Math.floor(z)
  const fx = x - ix
  const fy = y - iy
  const fz = z - iz
  const x0 = wrap(ix, p)
  const y0 = wrap(iy, p) * p
  const z0 = wrap(iz, p) * p * p
  const x1 = x0 + 1 === p ? 0 : x0 + 1
  const y1 = y0 + p === p * p ? 0 : y0 + p
  const z1 = z0 + p * p === p * p * p ? 0 : z0 + p * p
  const dot = (i: number, ax: number, ay: number, az: number) => GRAD[i] * ax + GRAD[i + 1] * ay + GRAD[i + 2] * az
  const n000 = dot(g[z0 + y0 + x0], fx, fy, fz)
  const n100 = dot(g[z0 + y0 + x1], fx - 1, fy, fz)
  const n010 = dot(g[z0 + y1 + x0], fx, fy - 1, fz)
  const n110 = dot(g[z0 + y1 + x1], fx - 1, fy - 1, fz)
  const n001 = dot(g[z1 + y0 + x0], fx, fy, fz - 1)
  const n101 = dot(g[z1 + y0 + x1], fx - 1, fy, fz - 1)
  const n011 = dot(g[z1 + y1 + x0], fx, fy - 1, fz - 1)
  const n111 = dot(g[z1 + y1 + x1], fx - 1, fy - 1, fz - 1)
  const u = fade(fx)
  const v = fade(fy)
  const w = fade(fz)
  const a = n000 + u * (n100 - n000)
  const b = n010 + u * (n110 - n010)
  const c = n001 + u * (n101 - n001)
  const d = n011 + u * (n111 - n011)
  const e = a + v * (b - a)
  const f = c + v * (d - c)
  return e + w * (f - e)
}

// lattices for a fractal sum: octave o repeats every period * 2^o cells
export function perlinOctaves(period: number, octaves: number, seed: number): PerlinLattice[] {
  return Array.from({ length: octaves }, (_, o) => perlinLattice(period << o, seed + o * 17))
}

// fractal sum of perlin noise over a unit tile (u, v, w in 0..1), 0..1
export function perlinFbm(oct: PerlinLattice[], u: number, v: number, w: number): number {
  let sum = 0
  let amp = 0.5
  let norm = 0
  for (const l of oct) {
    sum += amp * perlin3(l, u * l.period, v * l.period, w * l.period)
    norm += amp
    amp *= 0.5
  }
  return Math.min(1, Math.max(0, 0.5 + 0.7 * (sum / norm)))
}

// worley cells: one jittered feature point per cell of a cells^dims grid over the unit tile
export interface WorleyGrid {
  cells: number
  points: Float32Array // xyz jitter in 0..1 per cell
  dims: 2 | 3
}

export function worleyGrid(cells: number, seed: number, dims: 2 | 3 = 3): WorleyGrid {
  const n = dims === 3 ? cells * cells * cells : cells * cells
  const points = new Float32Array(n * 3)
  for (let i = 0; i < n; i++) {
    points[i * 3] = hash3(i, 0, 1, seed)
    points[i * 3 + 1] = hash3(i, 1, 2, seed)
    points[i * 3 + 2] = dims === 3 ? hash3(i, 2, 3, seed) : 0
  }
  return { cells, points, dims }
}

// inverted distance to the nearest feature point, in cells: 1 on a point, 0 a cell away or more (u, v, w in 0..1)
export function worley3(g: WorleyGrid, u: number, v: number, w: number): number {
  const c = g.cells
  const flat = g.dims === 2
  const x = u * c
  const y = v * c
  const z = flat ? 0 : w * c
  const cx = Math.floor(x)
  const cy = Math.floor(y)
  const cz = Math.floor(z)
  const fx = x - cx
  const fy = y - cy
  const fz = z - cz
  const pts = g.points
  let best = 9
  const zr = flat ? 0 : 1
  for (let dz = -zr; dz <= zr; dz++) {
    const kz = flat ? 0 : wrap(cz + dz, c) * c * c
    for (let dy = -1; dy <= 1; dy++) {
      const ky = kz + wrap(cy + dy, c) * c
      for (let dx = -1; dx <= 1; dx++) {
        const i = (ky + wrap(cx + dx, c)) * 3
        const ex = dx + pts[i] - fx
        const ey = dy + pts[i + 1] - fy
        const ez = flat ? 0 : dz + pts[i + 2] - fz
        const d = ex * ex + ey * ey + ez * ez
        if (d < best) best = d
      }
    }
  }
  return Math.max(0, 1 - Math.sqrt(best))
}

// remap x from [lo, hi] to [nlo, nhi], not clamped
export function remap(x: number, lo: number, hi: number, nlo: number, nhi: number): number {
  return nlo + ((x - lo) * (nhi - nlo)) / (hi - lo)
}

// value range of a float field
export function rangeOf(src: Float32Array): [number, number] {
  let lo = Infinity
  let hi = -Infinity
  for (let i = 0; i < src.length; i++) {
    if (src[i] < lo) lo = src[i]
    if (src[i] > hi) hi = src[i]
  }
  return [lo, hi]
}

// stretch a float field from [lo, hi] over 0..255 into every `stride`-th byte from `offset`
export function toBytes(src: Float32Array, out: Uint8Array, stride: number, offset: number, lo: number, hi: number): void {
  const k = hi > lo ? 255 / (hi - lo) : 0
  for (let i = 0; i < src.length; i++) out[i * stride + offset] = Math.max(0, Math.min(255, Math.round((src[i] - lo) * k)))
}

export const SHAPE_SEED = 0x6c0d

// voxels z0..z1 (exclusive) of the size^3 shape volume as two float fields: perlin-worley and worley fbm.
// slices are independent, so the volume can be split across workers
export function shapeSlices(size: number, z0: number, z1: number, seed = SHAPE_SEED): { pw: Float32Array; wf: Float32Array } {
  const w4 = worleyGrid(4, seed + 1)
  const w8 = worleyGrid(8, seed + 2)
  const w16 = worleyGrid(16, seed + 3)
  const w32 = worleyGrid(32, seed + 4)
  const perlin = perlinOctaves(4, 4, seed)
  const n = size * size * (z1 - z0)
  const pw = new Float32Array(n)
  const wf = new Float32Array(n)
  let i = 0
  for (let z = z0; z < z1; z++) {
    const w = (z + 0.5) / size
    for (let y = 0; y < size; y++) {
      const v = (y + 0.5) / size
      for (let x = 0; x < size; x++) {
        const u = (x + 0.5) / size
        const b = worley3(w8, u, v, w)
        const c = worley3(w16, u, v, w)
        const low = worley3(w4, u, v, w) * 0.625 + b * 0.25 + c * 0.125
        // perlin dilated by the worley billows: round lumps that keep perlin's connected flow
        pw[i] = remap(perlinFbm(perlin, u, v, w), 0, 1, low, 1)
        wf[i] = b * 0.625 + c * 0.25 + worley3(w32, u, v, w) * 0.125
        i++
      }
    }
  }
  return { pw, wf }
}

export const WEATHER_SEED = 0x3a71

// the weather map, size^2 texels of RG bytes. coverage: broken cloud banks (fbm) with rounded cells (worley) inside;
// height: a slow field that raises some banks into tall heaps and keeps others flat
export function weatherMap(size: number, seed = WEATHER_SEED): Uint8Array {
  const cells = worleyGrid(10, seed + 1, 2)
  const fine = worleyGrid(26, seed + 2, 2)
  const banks = perlinOctaves(3, 5, seed)
  const slow = perlinOctaves(2, 3, seed + 9)
  const cov = new Float32Array(size * size)
  const tall = new Float32Array(size * size)
  let i = 0
  for (let y = 0; y < size; y++) {
    const v = (y + 0.5) / size
    for (let x = 0; x < size; x++) {
      const u = (x + 0.5) / size
      const lumps = worley3(cells, u, v, 0) * 0.7 + worley3(fine, u, v, 0) * 0.3
      cov[i] = perlinFbm(banks, u, v, 0) * 0.65 + lumps * 0.35
      tall[i] = perlinFbm(slow, u, v, 0.37)
      i++
    }
  }
  const out = new Uint8Array(size * size * 2)
  const [cl, ch] = rangeOf(cov)
  const [tl, th] = rangeOf(tall)
  toBytes(cov, out, 2, 0, cl, ch)
  toBytes(tall, out, 2, 1, tl, th)
  return out
}

// blue noise by void and cluster (ulichney 1993): a size^2 tile of ranks 0..255 where every threshold gives evenly
// spread, clump-free dots. the clouds offset each pixel's first sample by it: banding turns into fine, even grain
// with no visible pattern. energy is a gaussian splat on the torus, updated as pixels flip
export function blueNoise(size: number, seed = 0xb10e): Uint8Array {
  const n = size * size
  const sigma = 1.9
  const r = Math.ceil(sigma * 3.5)
  const kernel = new Float32Array((2 * r + 1) * (2 * r + 1))
  for (let y = -r; y <= r; y++) {
    for (let x = -r; x <= r; x++) kernel[(y + r) * (2 * r + 1) + x + r] = Math.exp(-(x * x + y * y) / (2 * sigma * sigma))
  }
  const energy = new Float32Array(n)
  const on = new Uint8Array(n)
  const splat = (i: number, sign: number) => {
    const px = i % size
    const py = (i - px) / size
    for (let y = -r; y <= r; y++) {
      const row = ((py + y + size) % size) * size
      for (let x = -r; x <= r; x++) energy[row + ((px + x + size) % size)] += sign * kernel[(y + r) * (2 * r + 1) + x + r]
    }
  }
  // the tightest cluster among the set pixels (want = 1) or the largest void among the empty ones (want = 0)
  const find = (want: number) => {
    let best = -1
    let e = want ? -Infinity : Infinity
    for (let i = 0; i < n; i++) {
      if (on[i] !== want) continue
      if (want ? energy[i] > e : energy[i] < e) {
        e = energy[i]
        best = i
      }
    }
    return best
  }
  // initial pattern: a tenth of the pixels at random, relaxed until the tightest cluster is the largest void
  const rng = (i: number) => hash3(i, 7, 11, seed)
  const ones = Math.max(1, Math.floor(n / 10))
  let placed = 0
  for (let k = 0; placed < ones; k++) {
    const i = Math.floor(rng(k) * n)
    if (on[i]) continue
    on[i] = 1
    splat(i, 1)
    placed++
  }
  for (let guard = 0; guard < n; guard++) {
    const c = find(1)
    on[c] = 0
    splat(c, -1)
    const v = find(0)
    on[v] = 1
    splat(v, 1)
    if (v === c) break
  }
  const rank = new Uint32Array(n)
  const start = on.slice()
  const startEnergy = energy.slice()
  // phase 1: peel the initial dots off, tightest cluster first
  for (let k = ones - 1; k >= 0; k--) {
    const c = find(1)
    on[c] = 0
    splat(c, -1)
    rank[c] = k
  }
  // phases 2 and 3: from the initial pattern, fill the largest void until every pixel is set
  on.set(start)
  energy.set(startEnergy)
  for (let k = ones; k < n; k++) {
    const v = find(0)
    on[v] = 1
    splat(v, 1)
    rank[v] = k
  }
  const out = new Uint8Array(n)
  for (let i = 0; i < n; i++) out[i] = Math.floor((rank[i] * 256) / n)
  return out
}
