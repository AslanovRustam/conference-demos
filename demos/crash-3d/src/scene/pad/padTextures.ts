import { CanvasTexture, RepeatWrapping, SRGBColorSpace } from 'three'
import { createRng, type Rng } from '../../core/rng'
import { QUALITY } from '../quality'
import { DECK_HALF, DECK_HOLE_R, HARDSTAND_R, TRENCH_EXIT, TRENCH_HALF_W } from './layout'

// procedural canvas textures for the pad, painted once: the wet concrete hardstand (one atlas over the whole apron,
// meter uv / HARDSTAND_SPAN), the steel deck of the launch mount, and two tiles (concrete, soil).
// "orm" textures keep roughness in green, where three reads it

export interface PadSet {
  color: CanvasTexture
  orm: CanvasTexture
  normal: CanvasTexture
}

export interface PadTextures {
  hardstand: PadSet
  deck: PadSet
  concrete: PadSet
  soil: PadSet
}

export const HARDSTAND_SPAN = HARDSTAND_R * 2 // the atlas covers this many meters each way
export const CONCRETE_TILE_M = 8
export const SOIL_TILE_M = 48

let pending: Promise<PadTextures> | null = null
let built: PadTextures | null = null

export function loadPadTextures(): Promise<PadTextures> {
  pending ??= build().then((t) => (built = t))
  return pending
}

// frees the gpu copies and forgets the cache, so the next mount paints afresh
export function disposePadTextures(): void {
  pending = null
  if (!built) return
  const { hardstand, deck, concrete, soil } = built
  for (const set of [hardstand, deck, concrete, soil]) {
    set.color.dispose()
    set.orm.dispose()
    set.normal.dispose()
  }
  built = null
}

async function build(): Promise<PadTextures> {
  const rng = createRng(0x9ad)
  const hardstand = paintHardstand(rng)
  await yieldFrame()
  const deck = paintDeck(rng)
  await yieldFrame()
  return { hardstand, deck, concrete: paintConcreteTile(), soil: paintSoilTile() }
}

const yieldFrame = () => new Promise<void>((resolve) => setTimeout(resolve, 0))

// ---------- canvas and noise helpers ----------

function canvas(w: number, h = w) {
  const c = document.createElement('canvas')
  c.width = w
  c.height = h
  const ctx = c.getContext('2d')!
  return { c, ctx }
}

function texture(c: HTMLCanvasElement, srgb: boolean, tile = false): CanvasTexture {
  const t = new CanvasTexture(c)
  if (srgb) t.colorSpace = SRGBColorSpace
  if (tile) {
    t.wrapS = RepeatWrapping
    t.wrapT = RepeatWrapping
  }
  t.anisotropy = QUALITY.anisotropy
  return t
}

// integer lattice hash, periodic every `period` cells (0: not periodic)
function lattice(ix: number, iy: number, period: number, seed: number): number {
  if (period > 0) {
    ix = ((ix % period) + period) % period
    iy = ((iy % period) + period) % period
  }
  let h = (Math.imul(ix, 374761393) + Math.imul(iy, 668265263) + Math.imul(seed, 1013904223)) | 0
  h = Math.imul(h ^ (h >>> 13), 1274126177)
  h ^= h >>> 16
  return (h >>> 0) / 4294967296
}

function vnoise(x: number, y: number, period: number, seed: number): number {
  const ix = Math.floor(x)
  const iy = Math.floor(y)
  const fx = x - ix
  const fy = y - iy
  const sx = fx * fx * (3 - 2 * fx)
  const sy = fy * fy * (3 - 2 * fy)
  const a = lattice(ix, iy, period, seed)
  const b = lattice(ix + 1, iy, period, seed)
  const c = lattice(ix, iy + 1, period, seed)
  const d = lattice(ix + 1, iy + 1, period, seed)
  return a + (b - a) * sx + (c - a) * sy + (a - b - c + d) * sx * sy
}

// fractal noise in 0..1, x and y in base cells
function fbm(x: number, y: number, octaves: number, seed: number, period = 0): number {
  let sum = 0
  let amp = 0.5
  let norm = 0
  for (let o = 0; o < octaves; o++) {
    sum += amp * vnoise(x, y, period, seed + o * 17)
    norm += amp
    x *= 2
    y *= 2
    if (period) period *= 2
    amp *= 0.5
  }
  return sum / norm
}

const clamp01 = (x: number) => Math.min(1, Math.max(0, x))
const smooth = (a: number, b: number, x: number) => {
  const t = clamp01((x - a) / (b - a))
  return t * t * (3 - 2 * t)
}

// tangent-space normal map from a height field (0..1 per pixel), strength in height units per pixel
function normalFromHeight(h: Float32Array, w: number, strength: number, wrap: boolean): HTMLCanvasElement {
  const { c, ctx } = canvas(w)
  const img = ctx.createImageData(w, w)
  const d = img.data
  const at = (x: number, y: number) => {
    if (wrap) return h[((y + w) % w) * w + ((x + w) % w)]
    return h[Math.min(w - 1, Math.max(0, y)) * w + Math.min(w - 1, Math.max(0, x))]
  }
  for (let y = 0; y < w; y++) {
    for (let x = 0; x < w; x++) {
      const dx = (at(x + 1, y) - at(x - 1, y)) * strength
      // canvas rows grow downwards, uv v grows upwards
      const dy = (at(x, y - 1) - at(x, y + 1)) * strength
      const inv = 1 / Math.hypot(dx, dy, 1)
      const i = (y * w + x) * 4
      d[i] = (-dx * inv * 0.5 + 0.5) * 255
      d[i + 1] = (-dy * inv * 0.5 + 0.5) * 255
      d[i + 2] = (inv * 0.5 + 0.5) * 255
      d[i + 3] = 255
    }
  }
  ctx.putImageData(img, 0, 0)
  return c
}

// paints rgba per pixel into a canvas; f gets the pixel and fills out[0..3] in 0..255
function field(w: number, f: (x: number, y: number, out: number[]) => void): HTMLCanvasElement {
  const { c, ctx } = canvas(w)
  const img = ctx.createImageData(w, w)
  const d = img.data
  const px = [0, 0, 0, 255]
  for (let y = 0; y < w; y++) {
    for (let x = 0; x < w; x++) {
      px[3] = 255
      f(x, y, px)
      const i = (y * w + x) * 4
      d[i] = px[0]
      d[i + 1] = px[1]
      d[i + 2] = px[2]
      d[i + 3] = px[3]
    }
  }
  ctx.putImageData(img, 0, 0)
  return c
}

// ---------- hardstand ----------

const SLAB = 7.5 // concrete slabs, m

// distance from a point to the flame trench opening (0 inside)
function trenchDist(x: number, z: number): number {
  const dx = Math.max(0, Math.abs(x) - TRENCH_HALF_W)
  const dz = Math.max(0, Math.abs(z) - TRENCH_EXIT)
  return Math.hypot(dx, dz)
}

// the apron around the launch mount: slabs of weathered concrete, soot fanning out of the trench exits,
// rain puddles (near-mirror roughness) and painted safety lines
function paintHardstand(rng: Rng): PadSet {
  const N = QUALITY.padTexture
  const M = N / 2 // noise fields at half resolution, scaled up smoothly
  const mpp = HARDSTAND_SPAN / M // meters per pixel of the fields
  const toX = (px: number) => (px + 0.5) * mpp - HARDSTAND_R
  // canvas row 0 is the far edge, z = -R (uv v = 1)
  const toZ = (py: number) => (py + 0.5) * mpp - HARDSTAND_R
  const seed = Math.floor(rng() * 1000)

  const wet = new Float32Array(M * M)
  const height = new Float32Array(M * M)
  const albedo = field(M, (px, py, out) => {
    const x = toX(px)
    const z = toZ(py)
    const sx = Math.floor(x / SLAB)
    const sz = Math.floor(z / SLAB)
    const slab = lattice(sx, sz, 0, seed) - 0.5
    const mottle = fbm(x / 3.2, z / 3.2, 3, seed + 3)
    const stain = smooth(0.55, 0.8, fbm(x / 14, z / 14, 3, seed + 7))
    // soot: a fan from each trench exit and a halo around the mount
    const exit = Math.abs(z) > TRENCH_EXIT - 8 ? Math.exp(-Math.max(0, Math.abs(x) - TRENCH_HALF_W) / 9 - Math.max(0, Math.abs(z) - TRENCH_EXIT) / 22) : 0
    const halo = Math.exp(-Math.max(0, Math.hypot(x, z) - DECK_HALF) / 14)
    const soot = clamp01(Math.max(exit, halo * 0.75, Math.exp(-trenchDist(x, z) / 3) * 0.8) * (0.7 + 0.5 * mottle))
    // puddles collect in low spots; everything is damp after the rain
    const w = fbm(x / 11, z / 11, 4, seed + 11)
    const puddle = smooth(0.54, 0.68, w)
    wet[py * M + px] = puddle
    height[py * M + px] = 0.5 + 0.18 * mottle - 0.08 * puddle
    let g = 0.25 + 0.03 * slab + 0.08 * (mottle - 0.5) - 0.035 * stain
    g *= 1 - 0.65 * soot
    // standing water is darker still
    g *= 1 - 0.14 * puddle
    out[0] = clamp01(g) * 255
    out[1] = clamp01(g) * 255
    out[2] = clamp01(g * 1.03) * 255
  })

  // full resolution: scale the fields up, then draw the crisp parts on top
  const { c: color, ctx } = canvas(N)
  ctx.imageSmoothingQuality = 'high'
  ctx.drawImage(albedo, 0, 0, N, N)
  albedo.width = 0
  const ppm = N / HARDSTAND_SPAN // pixels per meter
  const toPx = (m: number) => (m + HARDSTAND_R) * ppm
  // slab joints, sealed with dark tar
  ctx.strokeStyle = 'rgba(20, 20, 22, 0.7)'
  ctx.lineWidth = Math.max(1, 0.06 * ppm)
  ctx.beginPath()
  for (let m = -HARDSTAND_R + (HARDSTAND_R % SLAB); m < HARDSTAND_R; m += SLAB) {
    ctx.moveTo(toPx(m), 0)
    ctx.lineTo(toPx(m), N)
    ctx.moveTo(0, toPx(m))
    ctx.lineTo(N, toPx(m))
  }
  ctx.stroke()
  // a yellow safety line around the trench and a dashed ring around the mount, worn
  ctx.globalAlpha = 0.55
  ctx.strokeStyle = '#b8901c'
  ctx.lineWidth = 0.22 * ppm
  const m0 = TRENCH_HALF_W + 1.4
  ctx.strokeRect(toPx(-m0), toPx(-TRENCH_EXIT - 1.4), 2 * m0 * ppm, 2 * (TRENCH_EXIT + 1.4) * ppm)
  ctx.setLineDash([2.4 * ppm, 1.6 * ppm])
  ctx.beginPath()
  ctx.arc(toPx(0), toPx(0), 26 * ppm, 0, Math.PI * 2)
  ctx.stroke()
  ctx.setLineDash([])
  // hazard chevrons at both trench exits
  ctx.globalAlpha = 0.5
  for (const s of [-1, 1]) {
    for (let k = -3; k <= 3; k++) {
      ctx.fillStyle = k % 2 === 0 ? '#c9a020' : '#141414'
      const z0 = s * (TRENCH_EXIT + 3)
      ctx.fillRect(toPx(k * 1.8 - 0.9), toPx(Math.min(z0, z0 + s * 2)), 1.8 * ppm, 2 * ppm)
    }
  }
  ctx.globalAlpha = 1
  // a little grain so close-ups are not mush
  const img = ctx.getImageData(0, 0, N, N)
  const d = img.data
  for (let i = 0; i < d.length; i += 4) {
    const n = (rng() - 0.5) * 14
    d[i] = Math.max(0, Math.min(255, d[i] + n))
    d[i + 1] = Math.max(0, Math.min(255, d[i + 1] + n))
    d[i + 2] = Math.max(0, Math.min(255, d[i + 2] + n))
  }
  ctx.putImageData(img, 0, 0)

  // roughness: puddles are near mirrors, damp concrete satin, tar joints hold water too
  const R = M
  const orm = field(R, (px, py, out) => {
    const p = wet[py * M + px]
    const x = toX(px)
    const z = toZ(py)
    const damp = 0.2 + 0.2 * fbm(x / 5, z / 5, 2, seed + 21)
    const r = damp * (1 - p) + 0.035 * p
    out[0] = 255
    out[1] = clamp01(r) * 255
    out[2] = 0
  })
  const { c: ormFull, ctx: octx } = canvas(R)
  octx.drawImage(orm, 0, 0)
  orm.width = 0
  octx.strokeStyle = 'rgb(255, 30, 0)'
  octx.lineWidth = Math.max(1, (0.08 * R) / HARDSTAND_SPAN)
  octx.beginPath()
  const toR = (m: number) => ((m + HARDSTAND_R) * R) / HARDSTAND_SPAN
  for (let m = -HARDSTAND_R + (HARDSTAND_R % SLAB); m < HARDSTAND_R; m += SLAB) {
    octx.moveTo(toR(m), 0)
    octx.lineTo(toR(m), R)
    octx.moveTo(0, toR(m))
    octx.lineTo(R, toR(m))
  }
  octx.stroke()

  // height: joints are grooves
  const jw = 0.1 / mpp
  for (let py = 0; py < M; py++) {
    for (let px = 0; px < M; px++) {
      const x = toX(px)
      const z = toZ(py)
      const fx = Math.abs(((x % SLAB) + SLAB) % SLAB)
      const fz = Math.abs(((z % SLAB) + SLAB) % SLAB)
      const edge = Math.min(fx, SLAB - fx, fz, SLAB - fz) / mpp
      if (edge < jw + 1) height[py * M + px] -= 0.35 * (1 - clamp01(edge - jw))
    }
  }
  const normal = normalFromHeight(height, M, 1.6, false)

  const set = { color: texture(color, true), orm: texture(ormFull, false), normal: texture(normal, false) }
  return set
}

// ---------- launch mount deck ----------

// heavy steel plates around the exhaust opening: blackened and blistered near it, paler towards the rim
function paintDeck(rng: Rng): PadSet {
  const N = QUALITY.padDeckTexture
  const span = DECK_HALF * 2
  const mpp = span / N
  const seed = Math.floor(rng() * 1000)
  const height = new Float32Array(N * N)
  const PLATE = 2.5
  const color = field(N, (px, py, out) => {
    const x = (px + 0.5) * mpp - DECK_HALF
    const z = (py + 0.5) * mpp - DECK_HALF
    const r = Math.hypot(x, z)
    const plate = lattice(Math.floor(x / PLATE), Math.floor(z / PLATE), 0, seed) - 0.5
    const n = fbm(x / 1.4, z / 1.4, 4, seed + 1)
    const burn = Math.exp(-Math.max(0, r - DECK_HOLE_R) / 2.6) * (0.75 + 0.4 * n)
    const fx = Math.abs(((x % PLATE) + PLATE) % PLATE)
    const fz = Math.abs(((z % PLATE) + PLATE) % PLATE)
    const seam = Math.min(fx, PLATE - fx, fz, PLATE - fz)
    const joint = seam < 0.03 ? 1 : 0
    height[py * N + px] = 0.5 + 0.12 * n - 0.4 * joint
    let g = 0.3 + 0.05 * plate + 0.08 * (n - 0.5)
    g *= 1 - 0.8 * clamp01(burn)
    g *= 1 - 0.5 * joint
    // a heat-tinted ring right at the opening
    const tint = Math.exp(-Math.max(0, r - DECK_HOLE_R) / 0.8) * 0.5
    out[0] = clamp01(g * (1 + 0.25 * tint)) * 255
    out[1] = clamp01(g * (1 + 0.05 * tint)) * 255
    out[2] = clamp01(g * (1 - 0.1 * tint)) * 255
  })
  const orm = field(N, (px, py, out) => {
    const x = (px + 0.5) * mpp - DECK_HALF
    const z = (py + 0.5) * mpp - DECK_HALF
    const w = smooth(0.55, 0.62, fbm(x / 3, z / 3, 3, seed + 5))
    const rough = 0.42 + 0.2 * fbm(x / 0.8, z / 0.8, 2, seed + 9)
    out[0] = 255
    out[1] = clamp01(rough * (1 - w) + 0.08 * w) * 255
    out[2] = 0
  })
  const normal = normalFromHeight(height, N, 1.2, false)
  return { color: texture(color, true), orm: texture(orm, false), normal: texture(normal, false) }
}

// ---------- tiles ----------

// cast concrete for the mount legs, the trench and the tower foundations
function paintConcreteTile(): PadSet {
  const N = QUALITY.padTileTexture
  const height = new Float32Array(N * N)
  const period = 8
  const color = field(N, (px, py, out) => {
    const u = (px / N) * period
    const v = (py / N) * period
    const n = fbm(u, v, 5, 41, period)
    const pores = vnoise(u * 16, v * 16, period * 16, 43)
    height[py * N + px] = 0.5 + 0.3 * n - 0.15 * smooth(0.82, 0.95, pores)
    const g = 0.42 + 0.14 * (n - 0.5) - 0.08 * smooth(0.82, 0.95, pores)
    out[0] = clamp01(g) * 255
    out[1] = clamp01(g * 0.99) * 255
    out[2] = clamp01(g * 0.96) * 255
  })
  const orm = field(N, (px, py, out) => {
    const u = (px / N) * period
    const v = (py / N) * period
    out[0] = 255
    out[1] = clamp01(0.55 + 0.25 * fbm(u * 2, v * 2, 3, 47, period * 2)) * 255
    out[2] = 0
  })
  const normal = normalFromHeight(height, N, 2, true)
  return { color: texture(color, true, true), orm: texture(orm, false, true), normal: texture(normal, false, true) }
}

// dark scrub and sand beyond the apron
function paintSoilTile(): PadSet {
  const N = QUALITY.padTileTexture
  const height = new Float32Array(N * N)
  const period = 6
  const color = field(N, (px, py, out) => {
    const u = (px / N) * period
    const v = (py / N) * period
    const n = fbm(u, v, 5, 61, period)
    const grass = smooth(0.45, 0.6, fbm(u * 0.5 + 3, v * 0.5, 3, 63, period / 2))
    height[py * N + px] = n
    const g = 0.1 + 0.07 * (n - 0.5)
    out[0] = clamp01(g * (1.05 - 0.25 * grass)) * 255
    out[1] = clamp01(g * (0.98 + 0.05 * grass)) * 255
    out[2] = clamp01(g * (0.86 - 0.2 * grass)) * 255
  })
  const orm = field(N, (_, __, out) => {
    out[0] = 255
    out[1] = 0.92 * 255
    out[2] = 0
  })
  const normal = normalFromHeight(height, N, 3, true)
  return { color: texture(color, true, true), orm: texture(orm, false, true), normal: texture(normal, false, true) }
}
