import logoSvg from '@brand/logo/clickable-logo-red.svg?raw'
import * as THREE from 'three'
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js'
import { SVGLoader } from 'three/examples/jsm/loaders/SVGLoader.js'
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js'
import { SYMBOLS, type SymbolId } from '../../game/config'
import { params } from '../../state/params'

/** shared by every symbol material: the grid window clips symbols above and below it */
export const CLIP_PLANES = [new THREE.Plane(new THREE.Vector3(0, -1, 0), 100), new THREE.Plane(new THREE.Vector3(0, 1, 0), 100)]

export interface SymbolParts {
  /** idle bob and sway; kept separate from the root, which GSAP animates */
  sway: THREE.Object3D
  /** turns while idle so the object shows its volume */
  spinner?: THREE.Object3D
  /** rotate: full turns around Y, swing: back and forth around Y, dial: back and forth around Z */
  motion?: 'rotate' | 'swing' | 'dial'
  /** twinkling star sprites */
  sparkles?: THREE.Object3D[]
}

export type SymbolModel = THREE.Group & { userData: { id: SymbolId; parts: SymbolParts } }

// ---------------------------------------------------------------- materials

const clip = { clippingPlanes: CLIP_PLANES }
/** real refraction costs an extra render pass, so only the laptop tier gets it */
const refraction = params.quality === 'high' && params.refraction

function neon(color: string, intensity: number) {
  return new THREE.MeshBasicMaterial({ color: new THREE.Color(color).multiplyScalar(intensity), toneMapped: false, ...clip })
}

/**
 * Faceted outer shell. Its colour comes mostly from the glowing core inside (see gemCore), so the
 * facets can stay dark and contrasty while white highlights flash across them.
 */
function gemMaterial(color: string, o: { ior?: number; dispersion?: number; glow?: number } = {}) {
  const { ior = 1.7, dispersion = 0.6, glow = 0.05 } = o
  const c = new THREE.Color(color)
  return new THREE.MeshPhysicalMaterial({
    // dark body: room light should glint off the facets, not flood the stone with diffuse pastel
    color: c.clone().multiplyScalar(0.5),
    emissive: c,
    emissiveIntensity: glow,
    metalness: 0,
    roughness: 0,
    ior,
    specularIntensity: 1,
    specularColor: new THREE.Color('#ffffff'),
    envMapIntensity: 2.2,
    flatShading: true,
    ...(refraction
      ? { transmission: 1, thickness: 0.7, dispersion, attenuationColor: c.clone().lerp(new THREE.Color('#ffffff'), 0.15), attenuationDistance: 1.6 }
      : { transparent: true, opacity: 0.62, depthWrite: false, iridescence: 0.15, iridescenceIOR: 1.6 }),
    ...clip,
  })
}

/** light trapped inside the stone: a smaller glowing copy seen through the facets */
function gemCore(color: string, strength = 1.25) {
  return new THREE.MeshBasicMaterial({ color: new THREE.Color(color).multiplyScalar(strength), toneMapped: false, ...clip })
}

let mats: ReturnType<typeof createMaterials> | null = null

function createMaterials() {
  return {
    gold: new THREE.MeshPhysicalMaterial({ color: '#ffcb5c', emissive: '#6a3f00', emissiveIntensity: 0.45, metalness: 1, roughness: 0.24, clearcoat: 0.15, envMapIntensity: 2, ...clip }),
    goldDark: new THREE.MeshStandardMaterial({ color: '#c58f2e', emissive: '#3a2200', emissiveIntensity: 0.5, metalness: 1, roughness: 0.38, envMapIntensity: 2, ...clip }),
    chrome: new THREE.MeshPhysicalMaterial({ color: '#e8ecf2', metalness: 1, roughness: 0.14, clearcoat: 0.2, envMapIntensity: 1.8, ...clip }),
    gunmetal: new THREE.MeshStandardMaterial({ color: '#23262e', metalness: 0.95, roughness: 0.28, envMapIntensity: 1.6, ...clip }),
    ruby: gemMaterial('#ff1a3c', { ior: 1.77, glow: 0.2 }),
    sparkle: new THREE.SpriteMaterial({ map: sparkleTexture(), color: new THREE.Color('#ffffff').multiplyScalar(4), blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false, ...clip }),
  }
}

export function materials() {
  return (mats ??= createMaterials())
}

// ---------------------------------------------------------------- textures

function canvasTexture(size: number, draw: (ctx: CanvasRenderingContext2D, size: number) => void) {
  const canvas = document.createElement('canvas')
  canvas.width = canvas.height = size
  draw(canvas.getContext('2d')!, size)
  const tex = new THREE.CanvasTexture(canvas)
  tex.colorSpace = THREE.SRGBColorSpace
  return tex
}

let glowTex: THREE.Texture | null = null
/** soft radial glow used for halos, particles and light cards */
export function glowTexture() {
  return (glowTex ??= canvasTexture(128, (ctx, s) => {
    const g = ctx.createRadialGradient(s / 2, s / 2, 0, s / 2, s / 2, s / 2)
    g.addColorStop(0, 'rgba(255,255,255,1)')
    g.addColorStop(0.25, 'rgba(255,255,255,0.55)')
    g.addColorStop(0.6, 'rgba(255,255,255,0.12)')
    g.addColorStop(1, 'rgba(255,255,255,0)')
    ctx.fillStyle = g
    ctx.fillRect(0, 0, s, s)
  }))
}

function sparkleTexture() {
  return canvasTexture(64, (ctx, s) => {
    const c = s / 2
    const g = ctx.createRadialGradient(c, c, 0, c, c, c)
    g.addColorStop(0, 'rgba(255,255,255,1)')
    g.addColorStop(0.2, 'rgba(255,255,255,0.4)')
    g.addColorStop(1, 'rgba(255,255,255,0)')
    ctx.fillStyle = g
    ctx.beginPath()
    // four-point star
    ctx.moveTo(c, 0)
    ctx.quadraticCurveTo(c, c, s, c)
    ctx.quadraticCurveTo(c, c, c, s)
    ctx.quadraticCurveTo(c, c, 0, c)
    ctx.quadraticCurveTo(c, c, c, 0)
    ctx.fill()
  })
}

// ---------------------------------------------------------------- gem cutting

interface Ring {
  /** scale of the outline */
  s: number
  y: number
  /** use midpoints between outline points: alternating facets like a brilliant */
  mid?: boolean
}

/**
 * Faceted gem from an outline (girdle shape, XZ plane) and a stack of rings from the table down to the culet.
 * Flat shading turns every triangle into a facet that catches light on its own.
 */
function cutGem(outline: THREE.Vector2[], rings: Ring[], culet: number) {
  const n = outline.length
  const ringPoints = rings.map(({ s, y, mid }) =>
    outline.map((p, i) => {
      const q = mid ? p.clone().add(outline[(i + 1) % n]).multiplyScalar(0.5) : p
      return new THREE.Vector3(q.x * s, y, q.y * s)
    }),
  )
  const pos: number[] = []
  const tri = (a: THREE.Vector3, b: THREE.Vector3, c: THREE.Vector3) => pos.push(a.x, a.y, a.z, b.x, b.y, b.z, c.x, c.y, c.z)
  const table = new THREE.Vector3(0, rings[0].y, 0)
  const tip = new THREE.Vector3(0, culet, 0)
  for (let i = 0; i < n; i++) tri(table, ringPoints[0][(i + 1) % n], ringPoints[0][i])
  for (let r = 0; r < ringPoints.length - 1; r++) {
    const a = ringPoints[r]
    const b = ringPoints[r + 1]
    for (let i = 0; i < n; i++) {
      const j = (i + 1) % n
      tri(a[i], a[j], b[i])
      tri(a[j], b[j], b[i])
    }
  }
  const last = ringPoints[ringPoints.length - 1]
  for (let i = 0; i < n; i++) tri(last[i], last[(i + 1) % n], tip)
  const geo = new THREE.BufferGeometry()
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3))
  geo.computeVertexNormals()
  return geo
}

const circle = (n: number, rx: number, rz = rx) =>
  Array.from({ length: n }, (_, i) => {
    const a = (i / n) * Math.PI * 2
    return new THREE.Vector2(Math.cos(a) * rx, Math.sin(a) * rz)
  })

/** rounded square: superellipse */
const cushion = (n: number, r: number, k = 4) =>
  Array.from({ length: n }, (_, i) => {
    const a = (i / n) * Math.PI * 2 + Math.PI / n
    const c = Math.cos(a)
    const s = Math.sin(a)
    return new THREE.Vector2(Math.sign(c) * Math.abs(c) ** (2 / k) * r, Math.sign(s) * Math.abs(s) ** (2 / k) * r)
  })

/** rectangle with cut corners, the classic emerald cut */
const octagon = (w: number, h: number, cut: number) =>
  [
    [w, h - cut], [w - cut, h], [-w + cut, h], [-w, h - cut],
    [-w, -h + cut], [-w + cut, -h], [w - cut, -h], [w, -h + cut],
  ].map(([x, y]) => new THREE.Vector2(x, y))

/** teardrop, pear cut: point up, round bottom */
const pear = (n: number, w: number, h: number) =>
  Array.from({ length: n }, (_, i) => {
    const t = (i / n) * Math.PI * 2
    return new THREE.Vector2(w * Math.sin(t) * Math.sin(t / 2) ** 0.9, h * Math.cos(t) - h * 0.12)
  })

const BRILLIANT: Ring[] = [
  { s: 0.56, y: 0.19 },
  { s: 0.84, y: 0.11, mid: true },
  { s: 1, y: 0.025 },
  { s: 1, y: -0.025 },
  { s: 0.58, y: -0.2, mid: true },
]

const STEP: Ring[] = [
  { s: 0.64, y: 0.17 },
  { s: 0.84, y: 0.115 },
  { s: 1, y: 0.03 },
  { s: 1, y: -0.03 },
  { s: 0.72, y: -0.14 },
  { s: 0.4, y: -0.25 },
]

// ---------------------------------------------------------------- helpers

function mesh(geo: THREE.BufferGeometry, mat: THREE.Material) {
  return new THREE.Mesh(geo, mat)
}

/** the shared kit has no vector brand mark yet, so gold is stamped with the logo's first letter */
function logoLetterShapes() {
  const box = new THREE.Box2()
  const left = (p: THREE.ShapePath) => {
    box.makeEmpty()
    p.subPaths.forEach((sp) => sp.getPoints().forEach((pt) => box.expandByPoint(pt)))
    return box.min.x
  }
  const paths = new SVGLoader().parse(logoSvg).paths
  return paths.reduce((a, b) => (left(a) <= left(b) ? a : b)).toShapes()
}

/** extruded logo letter, centred, `height` tall, facing +Z */
function letterGeometry(height: number, depth: number) {
  const g = new THREE.ExtrudeGeometry(logoLetterShapes(), { depth: 1, bevelEnabled: false, curveSegments: 8 })
  g.center()
  g.computeBoundingBox()
  const s = height / (g.boundingBox!.max.y - g.boundingBox!.min.y)
  // flip two axes (SVG y points down) so the winding, and therefore the normals, stay correct
  g.scale(s, -s, -depth)
  return g
}

function tinted(geo: THREE.BufferGeometry, color: string) {
  const g = geo.index ? geo.toNonIndexed() : geo
  const c = new THREE.Color(color)
  const colors = new Float32Array(g.attributes.position.count * 3)
  for (let i = 0; i < colors.length; i += 3) colors.set([c.r, c.g, c.b], i)
  g.setAttribute('color', new THREE.BufferAttribute(colors, 3))
  return g
}

/**
 * A minted coin in one geometry (for instancing): darker field, bright raised rim, an inner ring
 * and the logo letter struck on both faces. Relief colours live in vertex colours.
 */
export function coinGeometry(R = 0.26, T = 0.05) {
  const field = '#d39b36'
  const relief = '#ffd772'
  const parts = [
    tinted(new THREE.CylinderGeometry(R, R, T, 40).rotateX(Math.PI / 2), field),
    tinted(new THREE.TorusGeometry(R - 0.022, 0.022, 6, 40).translate(0, 0, T / 2), relief),
    tinted(new THREE.TorusGeometry(R - 0.022, 0.022, 6, 40).translate(0, 0, -T / 2), relief),
    tinted(new THREE.TorusGeometry(R * 0.68, 0.007, 4, 36).translate(0, 0, T / 2), relief),
    tinted(new THREE.TorusGeometry(R * 0.68, 0.007, 4, 36).translate(0, 0, -T / 2), relief),
    tinted(letterGeometry(R * 0.82, 0.016).translate(0, 0, T / 2 + 0.006), relief),
    tinted(letterGeometry(R * 0.82, 0.016).rotateY(Math.PI).translate(0, 0, -T / 2 - 0.006), relief),
  ]
  // merge needs identical attribute sets
  for (const p of parts) for (const name of Object.keys(p.attributes)) if (!['position', 'normal', 'color'].includes(name)) p.deleteAttribute(name)
  return mergeGeometries(parts)
}

function ingotGeometry(w: number, h: number, d: number) {
  const bar = new THREE.BoxGeometry(w, h, d, 1, 1, 1)
  const pos = bar.attributes.position
  for (let i = 0; i < pos.count; i++) {
    if (pos.getY(i) > 0) {
      pos.setX(i, pos.getX(i) * 0.78)
      pos.setZ(i, pos.getZ(i) * 0.7)
    }
  }
  bar.computeVertexNormals()
  return bar
}

// ---------------------------------------------------------------- symbol builders

interface Built {
  group: THREE.Group
  parts: Omit<SymbolParts, 'sway'>
}

interface Builder {
  build(): Built
}

/** a gem shown table-first, tilted towards the viewer, swinging so the facets flash */
function gemBuilder(geo: THREE.BufferGeometry, mat: THREE.Material, core: THREE.Material, motion: SymbolParts['motion'] = 'swing'): Builder {
  const coreGeo = geo.clone().scale(0.52, 0.42, 0.52)
  return {
    build() {
      const group = new THREE.Group()
      const spinner = new THREE.Group()
      const tilt = new THREE.Group()
      tilt.rotation.x = Math.PI / 2 - 0.42
      const inner = mesh(coreGeo, core)
      inner.renderOrder = -1
      tilt.add(inner, mesh(geo, mat))
      spinner.add(tilt)
      group.add(spinner)
      return { group, parts: { spinner, motion } }
    },
  }
}

function coinBuilder(): Builder {
  const m = materials()
  const R = 0.42
  const body = new THREE.CylinderGeometry(R, R, 0.09, 72).rotateX(Math.PI / 2)
  const rim = mergeGeometries([
    new THREE.TorusGeometry(R - 0.035, 0.03, 10, 72).translate(0, 0, 0.045),
    new THREE.TorusGeometry(R - 0.035, 0.03, 10, 72).translate(0, 0, -0.045),
  ])
  const reeds = mergeGeometries(
    Array.from({ length: 90 }, (_, i) => {
      const a = (i / 90) * Math.PI * 2
      return new THREE.BoxGeometry(0.012, 0.022, 0.08).translate(0, R + 0.004, 0).rotateZ(a)
    }),
  )
  const letter = letterGeometry(0.34, 0.03)
  const front = letter.clone().translate(0, 0, 0.06)
  const back = letter.clone().rotateY(Math.PI).translate(0, 0, -0.06)
  const stamps = mergeGeometries([front, back])
  return {
    build() {
      const group = new THREE.Group()
      const spinner = new THREE.Group()
      spinner.add(mesh(body, m.goldDark), mesh(rim, m.gold), mesh(reeds, m.gold), mesh(stamps, m.gold))
      spinner.rotation.x = -0.12
      group.add(spinner)
      return { group, parts: { spinner, motion: 'rotate' } }
    },
  }
}

function keyBuilder(): Builder {
  const m = materials()
  const bow = mergeGeometries([
    new THREE.TorusGeometry(0.17, 0.045, 14, 48),
    new THREE.TorusGeometry(0.1, 0.022, 10, 36),
    ...Array.from({ length: 4 }, (_, i) => new THREE.BoxGeometry(0.03, 0.2, 0.03).rotateZ((i * Math.PI) / 4)),
  ]).translate(-0.24, 0.02, 0)
  const shaft = mergeGeometries([
    new THREE.CylinderGeometry(0.038, 0.038, 0.52, 20).rotateZ(Math.PI / 2).translate(0.15, 0.02, 0),
    new THREE.TorusGeometry(0.048, 0.016, 8, 24).rotateY(Math.PI / 2).translate(-0.05, 0.02, 0),
  ])
  const bit = mergeGeometries([
    new RoundedBoxGeometry(0.05, 0.16, 0.05, 2, 0.012).translate(0.33, -0.06, 0),
    new RoundedBoxGeometry(0.05, 0.11, 0.05, 2, 0.012).translate(0.24, -0.04, 0),
    new RoundedBoxGeometry(0.1, 0.035, 0.05, 2, 0.01).translate(0.3, -0.13, 0),
  ])
  const jewel = cutGem(circle(10, 0.075), BRILLIANT, -0.07)
  return {
    build() {
      const group = new THREE.Group()
      const spinner = new THREE.Group()
      const gem = mesh(jewel, m.ruby)
      gem.rotation.x = Math.PI / 2
      gem.position.set(-0.24, 0.02, 0.04)
      spinner.add(mesh(bow, m.gold), mesh(shaft, m.chrome), mesh(bit, m.chrome), gem)
      spinner.rotation.z = 0.62
      spinner.scale.setScalar(1.15)
      group.add(spinner)
      return { group, parts: { spinner, motion: 'swing' } }
    },
  }
}

function barsBuilder(): Builder {
  const m = materials()
  const bar = ingotGeometry(0.46, 0.18, 0.26)
  const stamp = letterGeometry(0.1, 0.012).rotateX(-Math.PI / 2).translate(0, 0.092, 0)
  const stack = mergeGeometries([
    bar.clone().translate(-0.25, -0.1, 0),
    bar.clone().translate(0.25, -0.1, 0),
    bar.clone().translate(0, 0.08, 0),
  ])
  const stamps = mergeGeometries([stamp.clone().translate(-0.25, -0.1, 0), stamp.clone().translate(0.25, -0.1, 0), stamp.clone().translate(0, 0.08, 0)])
  return {
    build() {
      const group = new THREE.Group()
      const spinner = new THREE.Group()
      spinner.add(mesh(stack, m.gold), mesh(stamps, m.goldDark))
      spinner.rotation.x = 0.5
      spinner.scale.setScalar(1.12)
      group.add(spinner)
      return { group, parts: { spinner, motion: 'swing' } }
    },
  }
}

function diamondBuilder(): Builder {
  const geo = cutGem(circle(16, 0.46), [{ s: 0.55, y: 0.21 }, { s: 0.82, y: 0.13, mid: true }, { s: 1, y: 0.03 }, { s: 1, y: -0.03 }, { s: 0.6, y: -0.24, mid: true }], -0.5)
  const mat = gemMaterial('#f2f9ff', { ior: 2.42, dispersion: 6, glow: 0.1 })
  const base = gemBuilder(geo, mat, gemCore('#dff3ff', 0.95), 'rotate')
  const m = materials()
  return {
    build() {
      const built = base.build()
      const sparkles = [new THREE.Vector3(0.2, 0.22, 0.32), new THREE.Vector3(-0.24, -0.04, 0.34), new THREE.Vector3(0.05, -0.28, 0.3)].map((p) => {
        const s = new THREE.Sprite(m.sparkle)
        s.position.copy(p)
        s.scale.setScalar(0.3)
        built.group.add(s)
        return s
      })
      built.parts.sparkles = sparkles
      return built
    },
  }
}

function scatterBuilder(): Builder {
  const m = materials()
  const color = SYMBOLS[8].color
  const disc = new THREE.CylinderGeometry(0.43, 0.43, 0.12, 64).rotateX(Math.PI / 2)
  const rim = new THREE.TorusGeometry(0.43, 0.04, 12, 80)
  const glow = new THREE.TorusGeometry(0.5, 0.016, 8, 80)
  const ticks = mergeGeometries(
    Array.from({ length: 24 }, (_, i) => {
      const long = i % 6 === 0
      const g = new THREE.BoxGeometry(0.018, long ? 0.09 : 0.05, 0.02)
      g.translate(0, 0.34 - (long ? 0.02 : 0), 0.07)
      g.rotateZ((i / 24) * Math.PI * 2)
      return g
    }),
  )
  const knob = new THREE.CylinderGeometry(0.15, 0.17, 0.12, 48).rotateX(Math.PI / 2)
  const spokes = mergeGeometries(
    Array.from({ length: 3 }, (_, i) => {
      const g = new RoundedBoxGeometry(0.06, 0.3, 0.05, 2, 0.02)
      g.translate(0, 0.18, 0.1)
      g.rotateZ((i / 3) * Math.PI * 2)
      return g
    }),
  )
  const pointer = new THREE.ConeGeometry(0.05, 0.1, 3).rotateZ(Math.PI)
  const tickMat = neon(color, 3)
  const glowMat = neon(color, 4)
  const pointerMat = neon('#ff1923', 4)
  return {
    build() {
      const group = new THREE.Group()
      group.add(mesh(disc, m.gunmetal), mesh(rim, m.gold), mesh(glow, glowMat))
      const dial = new THREE.Group()
      const k = mesh(knob, m.chrome)
      k.position.z = 0.06
      dial.add(mesh(ticks, tickMat), k, mesh(spokes, m.gold))
      group.add(dial)
      const p = mesh(pointer, pointerMat)
      p.position.set(0, 0.5, 0.1)
      group.add(p)
      group.rotation.x = -0.18
      return { group, parts: { spinner: dial, motion: 'dial' } }
    },
  }
}

let builders: Builder[] | null = null

function getBuilders(): Builder[] {
  return (builders ??= [
    gemBuilder(cutGem(octagon(0.46, 0.34, 0.12), STEP, -0.32), gemMaterial(SYMBOLS[0].color, { ior: 1.58 }), gemCore(SYMBOLS[0].color)),
    gemBuilder(cutGem(cushion(20, 0.42), BRILLIANT, -0.42), gemMaterial(SYMBOLS[1].color, { ior: 1.77 }), gemCore(SYMBOLS[1].color, 1.5)),
    gemBuilder(cutGem(pear(24, 0.5, 0.5), BRILLIANT, -0.36), gemMaterial(SYMBOLS[2].color, { ior: 1.54 }), gemCore(SYMBOLS[2].color, 1.4)),
    gemBuilder(cutGem(circle(18, 0.47, 0.36), BRILLIANT, -0.38), gemMaterial(SYMBOLS[3].color, { ior: 1.62 }), gemCore(SYMBOLS[3].color)),
    coinBuilder(),
    keyBuilder(),
    barsBuilder(),
    diamondBuilder(),
    scatterBuilder(),
  ])
}

export function createSymbol(id: SymbolId): SymbolModel {
  const { group, parts } = getBuilders()[id].build()
  const root = new THREE.Group() as SymbolModel
  const sway = new THREE.Group()
  sway.add(group)
  root.add(sway)
  root.userData = { id, parts: { ...parts, sway } }
  return root
}

/** recycles symbol models so spins and cascades never allocate */
export class SymbolPool {
  private free = new Map<SymbolId, SymbolModel[]>()

  acquire(id: SymbolId): SymbolModel {
    const list = this.free.get(id)
    const model = list?.pop() ?? createSymbol(id)
    model.visible = true
    model.scale.setScalar(1)
    model.rotation.set(0, 0, 0)
    model.position.set(0, 0, 0)
    return model
  }

  release(model: SymbolModel) {
    model.removeFromParent()
    const id = model.userData.id
    let list = this.free.get(id)
    if (!list) this.free.set(id, (list = []))
    list.push(model)
  }

  /** builds a few of each so the first spin doesn't stutter */
  warm(perSymbol: number) {
    for (const s of SYMBOLS) {
      const made = Array.from({ length: perSymbol }, () => this.acquire(s.id))
      made.forEach((m) => this.release(m))
    }
  }
}
