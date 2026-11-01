import logoSvg from '@brand/logo/clickable-logo-red.svg?raw'
import { brandColors, brandFonts } from '@brand/tokens'
import { CanvasTexture, Color, RepeatWrapping, SRGBColorSpace } from 'three'
import { createRng, type Rng } from '../../core/rng'
import { QUALITY } from '../quality'
import { DECAL, DIM, hullRadiusAt } from './geometry'
import { ROCKET_HEIGHT_M } from './refs'

// procedural canvas textures for the rocket: one hull atlas (u around from +z towards +x, v = height / 48 m)
// plus small tiles for carbon, the nozzles and the heat shield, and the capsule logo decal.
// "orm" textures pack clearcoat in red and roughness in green (three reads roughness from green)

export interface PbrSet {
  color: CanvasTexture
  orm: CanvasTexture
  normal: CanvasTexture
}

export interface RocketTextures {
  hull: PbrSet
  carbon: PbrSet
  nozzle: PbrSet
  shield: PbrSet // capsule heat shield (polar uv)
  plate: PbrSet // the same shield canvases at the scale of the engine plate (meter uv)
  logo: CanvasTexture
}

const TAU = Math.PI * 2
export const CARBON_TILE_M = 0.64 // one carbon tile covers this many meters

let pending: Promise<RocketTextures> | null = null
let built: RocketTextures | null = null

// built once and shared while the rocket is mounted; waits for the brand fonts so the livery never
// falls back to a system font
export function loadRocketTextures(): Promise<RocketTextures> {
  pending ??= build().then((t) => (built = t))
  return pending
}

// frees the gpu copy of every rocket texture and forgets the cache, so the next mount builds afresh.
// the canvases stay attached: a texture still in use simply uploads again (webgl context restore needs them too)
export function disposeRocketTextures(): void {
  pending = null
  if (!built) return
  const { hull, carbon, nozzle, shield, plate, logo } = built
  for (const set of [hull, carbon, nozzle, shield, plate]) for (const t of Object.values(set)) t.dispose()
  logo.dispose()
}

async function build(): Promise<RocketTextures> {
  await Promise.all([
    document.fonts.load(`900 120px ${brandFonts.display}`, 'CLICKABLE'),
    document.fonts.load(`600 120px ${brandFonts.body}`, 'LOX FILL 0123'),
  ]).catch(() => [])
  await document.fonts.ready
  const rng = createRng(0xc2)
  const hull = paintHull(rng)
  await yieldFrame()
  const carbon = paintCarbon(rng)
  const nozzle = paintNozzle()
  await yieldFrame()
  const shield = paintShield()
  return { hull, carbon, nozzle, shield, plate: rescale(shield, 1.5, 1.5), logo: paintLogo() }
}

const yieldFrame = () => new Promise<void>((resolve) => setTimeout(resolve, 0))

// frees a scratch canvas right away (safari keeps canvas memory until gc and caps the total)
function release(c: HTMLCanvasElement) {
  c.width = 0
  c.height = 0
}

// ---------- canvas and noise helpers ----------

function canvas(w: number, h: number, read = false) {
  const c = document.createElement('canvas')
  c.width = w
  c.height = h
  const ctx = c.getContext('2d', { willReadFrequently: read })!
  return { c, ctx }
}

function texture(c: HTMLCanvasElement, srgb: boolean, tile = false): CanvasTexture {
  const t = new CanvasTexture(c)
  if (srgb) t.colorSpace = SRGBColorSpace
  t.wrapS = RepeatWrapping // the hull atlas wraps around too
  if (tile) t.wrapT = RepeatWrapping
  t.anisotropy = QUALITY.anisotropy // the renderer clamps it to what the gpu supports
  return t
}

// integer lattice hash, periodic in x
function lattice(ix: number, iy: number, period: number, seed: number): number {
  const x = ((ix % period) + period) % period
  let h = (Math.imul(x, 374761393) + Math.imul(iy, 668265263) + Math.imul(seed, 1013904223)) | 0
  h = Math.imul(h ^ (h >>> 13), 1274126177)
  h ^= h >>> 16
  return (h >>> 0) / 4294967296
}

// smooth value noise in 0..1, periodic in x every `period` cells
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

// fractal noise in 0..1; x and y are in base cells, x wraps every `period` cells
function fbm(x: number, y: number, period: number, octaves: number, seed: number): number {
  let sum = 0
  let amp = 0.5
  let norm = 0
  for (let o = 0; o < octaves; o++) {
    sum += amp * vnoise(x, y, period, seed + o * 17)
    norm += amp
    x *= 2
    y *= 2
    period *= 2
    amp *= 0.5
  }
  return sum / norm
}

// paints a small canvas pixel by pixel; f gets u, v in 0..1 (v grows downwards) and fills rgba 0..255
function field(w: number, h: number, f: (u: number, v: number, out: number[]) => void): HTMLCanvasElement {
  const { c, ctx } = canvas(w, h)
  const img = ctx.createImageData(w, h)
  const d = img.data
  const px = [0, 0, 0, 255]
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      px[3] = 255
      f((x + 0.5) / w, (y + 0.5) / h, px)
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

// tangent-space normal map from the red channel of a height canvas (height grows with brightness),
// the height canvas is released afterwards. kx, ky: normal tilt per unit of height change across one
// pixel, per row; they already include the scale of the uv frame three.js derives from the texture coordinates
function normalFromHeight(src: HTMLCanvasElement, kx: (row: number) => number, ky: (row: number) => number, wrapY: boolean): HTMLCanvasElement {
  const w = src.width
  const h = src.height
  const hd = src.getContext('2d')!.getImageData(0, 0, w, h).data
  release(src)
  const { c, ctx } = canvas(w, h)
  const out = ctx.createImageData(w, h)
  const o = out.data
  for (let y = 0; y < h; y++) {
    const yu = y > 0 ? y - 1 : wrapY ? h - 1 : 0
    const yd = y < h - 1 ? y + 1 : wrapY ? 0 : h - 1
    const ax = (kx(y) * 0.5) / 255
    const ay = (ky(y) * 0.5) / 255
    const row = y * w
    for (let x = 0; x < w; x++) {
      const xl = x > 0 ? x - 1 : w - 1
      const xr = x < w - 1 ? x + 1 : 0
      const nx = -(hd[(row + xr) * 4] - hd[(row + xl) * 4]) * ax
      const ny = -(hd[(yu * w + x) * 4] - hd[(yd * w + x) * 4]) * ay
      const inv = 1 / Math.sqrt(nx * nx + ny * ny + 1)
      const i = (row + x) * 4
      o[i] = (nx * inv * 0.5 + 0.5) * 255
      o[i + 1] = (ny * inv * 0.5 + 0.5) * 255
      o[i + 2] = (inv * 0.5 + 0.5) * 255
      o[i + 3] = 255
    }
  }
  ctx.putImageData(out, 0, 0)
  return c
}

const lerp = (a: number, b: number, t: number) => a + (b - a) * t
const clamp01 = (x: number) => Math.min(1, Math.max(0, x))
const smoothstep = (a: number, b: number, x: number) => {
  const t = clamp01((x - a) / (b - a))
  return t * t * (3 - 2 * t)
}

// ---------- hull atlas ----------

// painted panel rows: [bottom, top, vertical seams around]; joints between them are grooves or rings
const ROWS: [number, number, number][] = [
  [2.41, 4.7, 8], [4.7, DIM.skirtTop, 8],
  [DIM.skirtTop, 9.55, 8], [9.55, 12.05, 8], [12.05, 14.6, 8], [14.6, 17.1, 8],
  [17.1, 19.65, 8], [19.65, 22.15, 8], [22.15, 24.7, 8], [24.7, DIM.stage1Top, 8],
  [DIM.interTop, 33.45, 8], [33.45, 35.5, 8], [35.5, 37.55, 8], [37.55, DIM.stage2Top, 8],
  [DIM.stage2Top, 39.84, 0], [39.84, DIM.capsuleBase, 4],
  [42.55, 43.6, 10], [43.6, 44.6, 10], [44.6, 45.3, 10],
  [46.1, 46.62, 0], [46.62, 47.4, 0],
]
// joints with a geometric groove: rivet rows on both sides, no painted groove
const GROOVES = [12.05, 17.1, 22.15, 35.5, 39.84]
// joints covered by a metal ring: nothing painted
const RINGS: number[] = [DIM.skirtTop, DIM.stage1Top, DIM.interTop, DIM.stage2Top]

// the livery: a red band with the wordmark down the front (+z) and the back (-z) of stage 1
const BAND = { y0: 7.55, y1: 26.65, width: 2.9 }

// brand red as a paint albedo: the filmic tone mapping (agx) washes bright reds out to salmon and cannot reach
// the brand red's chroma at all; it is most saturated at a mid value, so the paint is the brand hue at a lower value.
// tuned under the final lights (task 10): the floodlit pad and the sun key in space land the band in agx's strongest
// red; brighter and the sunlit side turns salmon, darker and the floodlit side turns maroon
export const LIVERY_RED_SCALE = 0.19
function liveryRed(): string {
  const c = new Color(brandColors.red).multiplyScalar(LIVERY_RED_SCALE)
  return `#${c.getHexString()}`
}

interface Painter {
  w: number
  h: number
  row: (y: number) => number // canvas row of a rocket height
  col: (a: number) => number // canvas column of an azimuth fraction (0 = +z, 0.25 = +x)
  mx: (m: number, y: number) => number // arc meters to pixels at a height
  sy: number // pixels per meter up the rocket
}

function hullPainter(w: number, h: number): Painter {
  const sy = h / ROCKET_HEIGHT_M
  return {
    w,
    h,
    sy,
    row: (y) => (ROCKET_HEIGHT_M - y) * sy,
    col: (a) => a * w,
    mx: (m, y) => (m * w) / (TAU * hullRadiusAt(y)),
  }
}

// draws something three times so it wraps around the u seam
function wrapped(p: Painter, draw: (dx: number) => void) {
  for (const dx of [-p.w, 0, p.w]) draw(dx)
}

interface Font {
  weight: number
  family: string
}
const DISPLAY: Font = { weight: 900, family: brandFonts.display }
const STENCIL: Font = { weight: 600, family: brandFonts.body }
const STENCIL_INK = '#3a3d43'

// text in meters at azimuth a and height y; vertical text reads top to bottom
function hullText(ctx: CanvasRenderingContext2D, p: Painter, text: string, a: number, y: number, sizeM: number, font: Font, color: string, vertical = false) {
  const aspect = p.mx(1, y) / p.sy // keeps letters in proportion on the anisotropic atlas
  ctx.save()
  ctx.fillStyle = color
  ctx.font = `${font.weight} ${sizeM * p.sy}px ${font.family}`
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  wrapped(p, (dx) => {
    ctx.setTransform(aspect, 0, 0, 1, p.col(a) + dx, p.row(y))
    if (vertical) ctx.rotate(Math.PI / 2)
    ctx.fillText(text, 0, 0)
  })
  ctx.restore()
}

// a rectangle in meters centered at azimuth a and height y
function hullRect(p: Painter, a: number, y: number, wM: number, hM: number) {
  const w = p.mx(wM, y)
  const h = hM * p.sy
  return { x: p.col(a) - w / 2, y: p.row(y) - h / 2, w, h }
}

// font size that fits the wordmark into the band: length along the band, cap height across it
function fitWordmark(ctx: CanvasRenderingContext2D, p: Painter): number {
  ctx.font = `900 100px ${brandFonts.display}`
  const m = ctx.measureText('CLICKABLE')
  const len = m.actualBoundingBoxLeft + m.actualBoundingBoxRight
  const cap = m.actualBoundingBoxAscent + m.actualBoundingBoxDescent
  const byLen = ((BAND.y1 - BAND.y0) * 0.86 * p.sy * 100) / len
  const byCap = (BAND.width * 0.6 * p.sy * 100) / cap
  return Math.min(byLen, byCap) / p.sy // in meters
}

interface Feature {
  a: number // azimuth fraction
  y: number
  w: number // meters
  h: number
  label?: string
  vent?: boolean
}

// access panels and vents: small technical detail that reads as a real vehicle up close
const FEATURES: Feature[] = [
  { a: 0.36, y: 24.4, w: 0.62, h: 0.46, label: 'LOX FILL' },
  { a: 0.64, y: 9.9, w: 0.62, h: 0.46, label: 'FUEL FILL' },
  { a: 0.3, y: 33.1, w: 0.44, h: 0.34, label: 'GN2' },
  { a: 0.15, y: 26.2, w: 0.5, h: 0.22, vent: true },
  { a: 0.52, y: 38.7, w: 0.6, h: 0.24, vent: true },
  { a: 0.85, y: 18.6, w: 0.36, h: 0.36, label: 'T-0' },
]

const SOOT_FLOOR = 2.3

// soot cover 0..1 at azimuth fraction u and height y
function sootAt(u: number, y: number): number {
  const lip = DIM.skirtBottom
  const t = clamp01((y - lip) / 8.2)
  const blotch = fbm(u * 10, y * 0.9, 10, 5, 41)
  const streak = fbm(u * 70, y * 0.12, 70, 3, 53)
  let m = Math.pow(1 - t, 2.3) * 1.05 + (blotch - 0.5) * 0.9 * Math.pow(1 - t, 0.5) + (streak - 0.45) * 0.7 * Math.pow(1 - t, 0.4)
  if (y < lip + 0.7) m = Math.max(m, lerp(1, 0.6, (y - lip) / 0.7))
  return smoothstep(0.12, 0.95, m)
}

function paintHull(rng: Rng): PbrSet {
  const [w, h] = QUALITY.rocketHullTexture
  const p = hullPainter(w, h)
  const col = canvas(w, h)
  const orm = canvas(w, h)
  const hgt = canvas(w, h, true)
  const c = col.ctx
  const o = orm.ctx
  const g = hgt.ctx

  // base coats: warm white paint, full clearcoat, roughness 0.3; flat height
  c.fillStyle = '#e9e8e3'
  c.fillRect(0, 0, w, h)
  o.fillStyle = 'rgb(255, 104, 0)'
  o.fillRect(0, 0, w, h)
  g.fillStyle = 'rgb(128, 128, 128)'
  g.fillRect(0, 0, w, h)

  // livery band and wordmark
  const wordM = fitWordmark(c, p)
  for (const a of [0, 0.5]) {
    const yMid = (BAND.y0 + BAND.y1) / 2
    const r = hullRect(p, a, yMid, BAND.width, BAND.y1 - BAND.y0)
    c.fillStyle = liveryRed()
    wrapped(p, (dx) => c.fillRect(r.x + dx, r.y, r.w, r.h))
    hullText(c, p, 'CLICKABLE', a, yMid, wordM, DISPLAY, '#f6f6f2', true)
  }

  // serial and small stencils
  hullText(c, p, 'C2 · 01', 0.83, 8.6, 0.22, STENCIL, STENCIL_INK)
  hullText(c, p, 'C2', 0.5 - 0.135, 36.6, 0.42, STENCIL, STENCIL_INK)

  // access panels and vents
  for (const f of FEATURES) {
    const r = hullRect(p, f.a, f.y, f.w, f.h)
    c.fillStyle = f.vent ? '#2b2d31' : 'rgba(0, 0, 0, 0.035)'
    c.fillRect(r.x, r.y, r.w, r.h)
    c.strokeStyle = 'rgba(40, 42, 46, 0.55)'
    c.lineWidth = 1.5
    c.strokeRect(r.x, r.y, r.w, r.h)
    g.strokeStyle = 'rgb(60, 60, 60)'
    g.lineWidth = 2.5
    g.strokeRect(r.x, r.y, r.w, r.h)
    if (f.vent) {
      // louvres
      const n = Math.round(f.h / 0.045)
      for (let i = 0; i < n; i++) {
        const yy = r.y + ((i + 0.5) * r.h) / n
        c.fillStyle = 'rgba(120, 124, 130, 0.5)'
        c.fillRect(r.x + 2, yy - 0.6, r.w - 4, 1.2)
        g.fillStyle = 'rgb(175, 175, 175)'
        g.fillRect(r.x + 2, yy - 1, r.w - 4, 2)
      }
    } else {
      // corner fasteners
      for (const [fx, fy] of [[0.08, 0.1], [0.92, 0.1], [0.08, 0.9], [0.92, 0.9]]) {
        const cx = r.x + fx * r.w
        const cy = r.y + fy * r.h
        c.fillStyle = 'rgba(60, 62, 66, 0.6)'
        c.beginPath()
        c.ellipse(cx, cy, p.mx(0.016, f.y), 0.016 * p.sy, 0, 0, TAU)
        c.fill()
        g.fillStyle = 'rgb(190, 190, 190)'
        g.beginPath()
        g.ellipse(cx, cy, p.mx(0.016, f.y), 0.016 * p.sy, 0, 0, TAU)
        g.fill()
      }
    }
    if (f.label) hullText(c, p, f.label, f.a, f.y + f.h / 2 + 0.16, 0.13, STENCIL, STENCIL_INK)
  }

  // panel to panel tone and roughness: every sheet came from a slightly different batch
  ROWS.forEach(([y0, y1, n], ri) => {
    const top = p.row(y1)
    const bottom = p.row(y0)
    const cells = Math.max(1, n)
    const off = ri % 2 ? 0.5 / cells : 0
    for (let i = 0; i < cells; i++) {
      const x0 = ((i / cells + off) % 1) * w
      const cw = w / cells
      const tone = (rng() - 0.5) * 0.07
      c.fillStyle = tone > 0 ? `rgba(255, 252, 246, ${tone})` : `rgba(20, 18, 16, ${-tone})`
      const rough = Math.round(rng() * 26)
      o.fillStyle = `rgb(0, ${rough}, 0)`
      o.globalCompositeOperation = 'lighter'
      for (const dx of [0, -w]) {
        c.fillRect(x0 + dx, top, cw, bottom - top)
        o.fillRect(x0 + dx, top, cw, bottom - top)
      }
      o.globalCompositeOperation = 'source-over'
    }
  })

  // large mottling in the paint and the roughness
  const ds = QUALITY.rocketNoiseDownscale
  const mottle = field(w / (ds * 2), h / (ds * 2), (u, v, px) => {
    const n = fbm(u * 12, v * 40, 12, 4, 11)
    const k = 225 + n * 30
    px[0] = k
    px[1] = k - 1
    px[2] = k - 3
  })
  c.globalCompositeOperation = 'multiply'
  c.drawImage(mottle, 0, 0, w, h)
  c.globalCompositeOperation = 'source-over'
  release(mottle)
  const roughNoise = field(w / ds, h / ds, (u, v, px) => {
    const n = fbm(u * 24, v * 90, 24, 5, 23)
    px[0] = 0
    px[1] = Math.max(0, n - 0.35) * 70
    px[2] = 0
  })
  o.globalCompositeOperation = 'lighter'
  o.drawImage(roughNoise, 0, 0, w, h)
  o.globalCompositeOperation = 'source-over'
  release(roughNoise)

  // grime streaks running down from joints and panels
  const streakFrom = [...GROOVES, 9.55, 14.6, 19.65, 24.7, 33.45, 37.55, ...FEATURES.map((f) => f.y - f.h / 2)]
  for (let i = 0; i < 520; i++) {
    const y0 = streakFrom[Math.floor(rng() * streakFrom.length)]
    const len = 0.3 + rng() * rng() * 2.2
    const x = rng() * w
    const sw = 1 + rng() * 3
    const a = 0.02 + rng() * 0.06
    const top = p.row(y0)
    const bottom = p.row(Math.max(2.5, y0 - len))
    const grad = c.createLinearGradient(0, top, 0, bottom)
    grad.addColorStop(0, `rgba(70, 62, 54, ${a})`)
    grad.addColorStop(1, 'rgba(70, 62, 54, 0)')
    c.fillStyle = grad
    c.fillRect(x, top, sw, bottom - top)
    o.globalCompositeOperation = 'lighter'
    o.fillStyle = `rgba(0, 40, 0, ${a * 4})`
    o.fillRect(x, top, sw, bottom - top)
    o.globalCompositeOperation = 'source-over'
  }

  // seams: grime line in the paint, rough and dull in the coat, a groove in the height
  const seamRows = new Set<number>()
  for (const [y0, y1] of ROWS) {
    seamRows.add(y0)
    seamRows.add(y1)
  }
  for (const y of seamRows) {
    if (RINGS.includes(y)) continue
    const r = p.row(y)
    c.fillStyle = 'rgba(48, 46, 44, 0.42)'
    c.fillRect(0, r - 1, w, 2)
    o.globalCompositeOperation = 'lighter'
    o.fillStyle = 'rgb(0, 45, 0)'
    o.fillRect(0, r - 1.5, w, 3)
    o.globalCompositeOperation = 'source-over'
    if (!GROOVES.includes(y)) {
      g.fillStyle = 'rgb(70, 70, 70)'
      g.fillRect(0, r - 1.5, w, 3)
      g.fillStyle = 'rgb(30, 30, 30)'
      g.fillRect(0, r - 0.5, w, 1)
    }
    // fastener rows
    const rows = GROOVES.includes(y) ? [-0.085, 0.085] : [0.05]
    for (const dy of rows) {
      const yy = p.row(y + dy)
      const n = Math.round((TAU * hullRadiusAt(y)) / 0.13)
      const rx = p.mx(0.011, y)
      const ry = 0.011 * p.sy
      for (let k = 0; k < n; k++) {
        const x = ((k + 0.5) / n) * w
        c.fillStyle = 'rgba(70, 70, 70, 0.22)'
        c.beginPath()
        c.ellipse(x, yy, rx, ry, 0, 0, TAU)
        c.fill()
        g.fillStyle = 'rgb(185, 185, 185)'
        g.beginPath()
        g.ellipse(x, yy, rx * 1.2, ry * 1.2, 0, 0, TAU)
        g.fill()
      }
    }
  }
  ROWS.forEach(([y0, y1, n], ri) => {
    if (!n) return
    const top = p.row(y1)
    const bottom = p.row(y0)
    const off = ri % 2 ? 0.5 / n : 0
    for (let i = 0; i < n; i++) {
      const x = ((i / n + off) % 1) * w
      for (const dx of [0, w]) {
        c.fillStyle = 'rgba(48, 46, 44, 0.38)'
        c.fillRect(x + dx - 1, top, 2, bottom - top)
        g.fillStyle = 'rgb(70, 70, 70)'
        g.fillRect(x + dx - 1.5, top, 3, bottom - top)
        g.fillStyle = 'rgb(30, 30, 30)'
        g.fillRect(x + dx - 0.5, top, 1, bottom - top)
      }
      o.globalCompositeOperation = 'lighter'
      o.fillStyle = 'rgb(0, 45, 0)'
      o.fillRect(x - 1.5, top, 3, bottom - top)
      o.globalCompositeOperation = 'source-over'
      // fasteners along the vertical seam
      const yStep = 0.16
      for (let yy = y0 + yStep / 2; yy < y1; yy += yStep) {
        const rx = p.mx(0.01, yy)
        const ry = 0.01 * p.sy
        g.fillStyle = 'rgb(180, 180, 180)'
        g.beginPath()
        g.ellipse(x + rx * 3.2, p.row(yy), rx, ry, 0, 0, TAU)
        g.fill()
        c.fillStyle = 'rgba(70, 70, 70, 0.18)'
        c.beginPath()
        c.ellipse(x + rx * 3.2, p.row(yy), rx, ry, 0, 0, TAU)
        c.fill()
      }
    }
  })

  // capsule thruster pods leave short scorch trails
  for (const a of [0.125, 0.375, 0.625, 0.875]) {
    const yTop = DIM.capsuleBase + 2.4
    const top = p.row(yTop)
    const bottom = p.row(yTop - 0.7)
    const half = p.mx(0.14, yTop)
    const grad = c.createLinearGradient(0, top, 0, bottom)
    grad.addColorStop(0, 'rgba(30, 24, 20, 0.55)')
    grad.addColorStop(1, 'rgba(30, 24, 20, 0)')
    c.fillStyle = grad
    c.fillRect(p.col(a) - half, top, half * 2, bottom - top)
  }

  // engine soot: dense at the skirt lip, fading up the first stage in noisy, rising streaks
  const sootTop = 13
  const sootW = Math.round(w / ds)
  const sootH = Math.ceil(((sootTop - SOOT_FLOOR) * p.sy) / ds)
  const mask = new Float32Array(sootW * sootH)
  for (let j = 0; j < sootH; j++) {
    const y = sootTop - ((j + 0.5) / sootH) * (sootTop - SOOT_FLOOR)
    for (let i = 0; i < sootW; i++) mask[j * sootW + i] = sootAt((i + 0.5) / sootW, y)
  }
  const sootColor = field(sootW, sootH, (u, v, px) => {
    const warm = clamp01((sootTop - v * (sootTop - SOOT_FLOOR) - DIM.skirtBottom) / 5)
    px[0] = lerp(14, 52, warm)
    px[1] = lerp(12, 42, warm)
    px[2] = lerp(10, 33, warm)
    px[3] = mask[Math.floor(v * sootH) * sootW + Math.floor(u * sootW)] * 255
  })
  // soot kills the clearcoat and roughens the paint
  const sootOrm = field(sootW, sootH, (u, v, px) => {
    px[0] = 20
    px[1] = 220
    px[2] = 0
    px[3] = mask[Math.floor(v * sootH) * sootW + Math.floor(u * sootW)] * 255
  })
  c.drawImage(sootColor, 0, p.row(sootTop), w, sootH * ds)
  o.drawImage(sootOrm, 0, p.row(sootTop), w, sootH * ds)
  release(sootColor)
  release(sootOrm)

  // relief: depth in meters per unit of height; kx and ky follow the radius of each row
  const depth = 0.012
  const normal = normalFromHeight(
    hgt.c,
    (row) => (w / (TAU * hullRadiusAt(ROCKET_HEIGHT_M - row / p.sy))) * depth,
    (row) => {
      const r = hullRadiusAt(ROCKET_HEIGHT_M - row / p.sy)
      return (p.sy * depth * ROCKET_HEIGHT_M) / (TAU * r) // |grad u| / |grad v| corrects the v axis
    },
    false,
  )

  return { color: texture(col.c, true), orm: texture(orm.c, false), normal: texture(normal, false) }
}

// ---------- carbon fibre tile (2/2 twill), meters uv ----------

function paintCarbon(rng: Rng): PbrSet {
  const s = QUALITY.rocketTileTexture
  const n = 16 // tows across the tile
  const cell = s / n
  const col = canvas(s, s)
  const orm = canvas(s, s)
  const hgt = canvas(s, s, true)
  for (let i = 0; i < n; i++) {
    for (let j = 0; j < n; j++) {
      const horizontal = (i + j) % 4 < 2
      const x = i * cell
      const y = j * cell
      const base = 17 + rng() * 6
      const tow = (ctx: CanvasRenderingContext2D, edge: string, mid: string) => {
        const grad = horizontal ? ctx.createLinearGradient(0, y, 0, y + cell) : ctx.createLinearGradient(x, 0, x + cell, 0)
        grad.addColorStop(0, edge)
        grad.addColorStop(0.5, mid)
        grad.addColorStop(1, edge)
        ctx.fillStyle = grad
        ctx.fillRect(x, y, cell, cell)
      }
      tow(col.ctx, `rgb(${base - 3}, ${base - 3}, ${base - 2})`, `rgb(${base + 5}, ${base + 6}, ${base + 7})`)
      tow(orm.ctx, 'rgb(0, 160, 0)', 'rgb(0, 112, 0)')
      tow(hgt.ctx, 'rgb(70, 70, 70)', 'rgb(190, 190, 190)')
      // fibre lines along the tow
      col.ctx.fillStyle = 'rgba(255, 255, 255, 0.015)'
      for (let k = 0; k < 6; k++) {
        const t = rng() * cell
        if (horizontal) col.ctx.fillRect(x, y + t, cell, 1)
        else col.ctx.fillRect(x + t, y, 1, cell)
      }
    }
  }
  const k = (s / CARBON_TILE_M) * 0.003
  const normal = normalFromHeight(hgt.c, () => k, () => k, true)
  const set = { color: texture(col.c, true, true), orm: texture(orm.c, false, true), normal: texture(normal, false, true) }
  for (const t of Object.values(set)) t.repeat.set(1 / CARBON_TILE_M, 1 / CARBON_TILE_M)
  return set
}

// ---------- nozzle bell: v 0..0.45 inside (throat to exit), lip, 0.55..1 outside (exit to throat) ----------

// heat tint up the outside of the bell, from the cooler exit to the hot throat
const TINT: [number, [number, number, number]][] = [
  [0.55, [52, 45, 40]], // sooty lip
  [0.59, [104, 80, 58]], // dark bronze
  [0.67, [112, 86, 60]],
  [0.72, [140, 112, 72]], // straw
  [0.765, [104, 74, 88]], // purple bronze
  [0.81, [76, 86, 112]], // steel blue
  [0.85, [84, 78, 76]], // grey
  [0.92, [92, 70, 54]], // dark copper
  [1, [80, 60, 46]],
]

function tintAt(v: number): [number, number, number] {
  for (let i = 1; i < TINT.length; i++) {
    if (v <= TINT[i][0]) {
      const [v0, c0] = TINT[i - 1]
      const [v1, c1] = TINT[i]
      const t = smoothstep(0, 1, (v - v0) / (v1 - v0))
      return [lerp(c0[0], c1[0], t), lerp(c0[1], c1[1], t), lerp(c0[2], c1[2], t)]
    }
  }
  return TINT[TINT.length - 1][1]
}

function paintNozzle(): PbrSet {
  const w = QUALITY.rocketTileTexture
  const h = w * 2
  const tubes = Math.round(w / 8)
  const color = field(w, h, (u, vd, px) => {
    const v = 1 - vd
    const streak = fbm(u * 48, v * 3, 48, 3, 61)
    const blot = fbm(u * 6, v * 8, 6, 4, 67)
    let c: [number, number, number]
    if (v >= 0.55) c = tintAt(v + (blot - 0.5) * 0.05)
    else if (v <= 0.45) c = [52, 42, 36] // soot inside
    else c = [44, 38, 34]
    const k = 0.82 + streak * 0.3 + (blot - 0.5) * 0.12
    px[0] = c[0] * k
    px[1] = c[1] * k
    px[2] = c[2] * k
  })
  const orm = field(w, h, (u, vd, px) => {
    const v = 1 - vd
    const streak = fbm(u * 48, v * 3, 48, 3, 71)
    px[0] = 0
    px[1] = (v >= 0.55 ? 0.3 + streak * 0.18 : 0.55 + streak * 0.15) * 255
    px[2] = 0
  })
  // regenerative cooling tubes run along the bell
  const height = canvas(w, h, true)
  const img = height.ctx.createImageData(w, h)
  for (let y = 0; y < h; y++) {
    const v = 1 - y / h
    const on = v >= 0.57 || v <= 0.43 ? 1 : 0
    for (let x = 0; x < w; x++) {
      const k = 128 + on * 90 * (Math.sin((x / w) * tubes * TAU) * 0.5)
      const i = (y * w + x) * 4
      img.data[i] = img.data[i + 1] = img.data[i + 2] = k
      img.data[i + 3] = 255
    }
  }
  height.ctx.putImageData(img, 0, 0)
  const k = 0.9
  const normal = normalFromHeight(height.c, () => k, () => k * 1.6, false)
  return { color: texture(color, true), orm: texture(orm, false), normal: texture(normal, false) }
}

// ---------- ablative heat shield tile ----------

function paintShield(): PbrSet {
  const s = QUALITY.rocketTileTexture
  const color = field(s, s, (u, v, px) => {
    const n = fbm(u * 8, v * 8, 8, 5, 81)
    const char = fbm(u * 3, v * 3, 3, 3, 83)
    const k = 0.7 + n * 0.5
    px[0] = (30 + char * 16) * k
    px[1] = (24 + char * 10) * k
    px[2] = (20 + char * 6) * k
  })
  const orm = field(s, s, (u, v, px) => {
    const n = fbm(u * 8, v * 8, 8, 4, 87)
    px[0] = 0
    px[1] = (0.72 + n * 0.22) * 255
    px[2] = 0
  })
  const height = field(s, s, (u, v, px) => {
    const n = fbm(u * 16, v * 16, 16, 4, 89)
    const k = 128 + (n - 0.5) * 120
    px[0] = px[1] = px[2] = k
  })
  const normal = normalFromHeight(height, () => 16, () => 16, true)
  const set = { color: texture(color, true, true), orm: texture(orm, false, true), normal: texture(normal, false, true) }
  for (const t of Object.values(set)) t.repeat.set(10, 3) // polar uv: 10 tiles around, 3 from center to rim
  return set
}

// another view of the same canvases with its own tiling (clones share the image source)
function rescale(set: PbrSet, x: number, y: number): PbrSet {
  const out = { color: set.color.clone(), orm: set.orm.clone(), normal: set.normal.clone() }
  for (const t of Object.values(out)) t.repeat.set(x, y)
  return out
}

// ---------- capsule logo decal ----------

// the brand logo is plain filled paths: drawn as Path2D straight from the svg source,
// so there is no image decode and no canvas tainting on any browser
function paintLogo(): CanvasTexture {
  const w = QUALITY.rocketLogoTexture
  const h = Math.round(w / DECAL.aspect)
  const { c, ctx } = canvas(w, h)
  const box = /viewBox="([^"]+)"/.exec(logoSvg)?.[1].trim().split(/[\s,]+/).map(Number) ?? [0, 0, 262, 36]
  const [bx, by, bw, bh] = box
  const k = Math.min((h * 0.9) / bh, (w * 0.96) / bw)
  ctx.translate((w - bw * k) / 2 - bx * k, (h - bh * k) / 2 - by * k)
  ctx.scale(k, k)
  for (const [tag] of logoSvg.matchAll(/<path\s[^>]*>/g)) {
    const d = /\sd="([^"]+)"/.exec(tag)?.[1]
    if (!d) continue
    ctx.fillStyle = /\sfill="([^"]+)"/.exec(tag)?.[1] ?? brandColors.red
    ctx.fill(new Path2D(d))
  }
  return texture(c, true)
}
