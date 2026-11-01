import gsap from 'gsap'
import * as THREE from 'three'
import { COLS, ROWS, SCATTER, SYMBOLS, type SymbolId } from '../game/config'
import type { Cell, ColumnFall, Grid } from '../game/engine'
import type { Fx } from './fx'
import { CLIP_PLANES, glowTexture, SymbolPool, type SymbolModel } from './symbols/factory'

export const CELL = 1.12
export const GRID_W = COLS * CELL
export const GRID_H = ROWS * CELL
/** how far symbols travel to enter or leave the window */
const OUT = GRID_H + 1.2
/** winners fly this far out of the window towards the camera */
const LIFT = 1.0

export function cellPosition(col: number, row: number, out = new THREE.Vector3()) {
  return out.set((col - (COLS - 1) / 2) * CELL, ((ROWS - 1) / 2 - row) * CELL, 0)
}

interface CellView {
  holder: THREE.Group
  model: SymbolModel | null
  halo: THREE.Sprite
  phase: number
}

interface Strip {
  col: number
  group: THREE.Group
  models: SymbolModel[]
  wraps: number[]
  offset: number
  speed: number
}

export interface SpinPlayback {
  /** first column that spins as a slowing reel because a third scatter may still land */
  anticipateFrom: number | null
  /** total scatters visible after this column landed */
  onColumnLand?: (col: number, scatters: number) => void
  onAnticipate?: (col: number) => void
}

const wait = (s: number) => new Promise<void>((resolve) => gsap.delayedCall(s, resolve))
const tween = (target: object, vars: gsap.TweenVars) => new Promise<void>((resolve) => gsap.to(target, { ...vars, onComplete: resolve }))
const randomSymbol = () => Math.floor(Math.random() * (SYMBOLS.length - 1)) as SymbolId
const v3 = new THREE.Vector3()
const clipCenter = new THREE.Vector3()
const clipEye = new THREE.Vector3()
const clipPoint = new THREE.Vector3()
const clipNormal = new THREE.Vector3()

function additive(color: THREE.ColorRepresentation, map?: THREE.Texture, clip = false) {
  return new THREE.MeshBasicMaterial({
    map,
    color: new THREE.Color(color),
    transparent: true,
    opacity: 0,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    toneMapped: false,
    ...(clip ? { clippingPlanes: CLIP_PLANES } : {}),
  })
}

function gradientTexture(stops: [number, number][]) {
  const canvas = document.createElement('canvas')
  canvas.width = 4
  canvas.height = 128
  const ctx = canvas.getContext('2d')!
  const g = ctx.createLinearGradient(0, 0, 0, 128)
  for (const [at, alpha] of stops) g.addColorStop(at, `rgba(255,255,255,${alpha})`)
  ctx.fillStyle = g
  ctx.fillRect(0, 0, 4, 128)
  return new THREE.CanvasTexture(canvas)
}

/** point on the window frame, walking from the top centre along one side to the bottom centre */
function framePoint(s: number, hw: number, hh: number, dir: number, out: THREE.Vector3) {
  if (s < hw) return out.set(dir * s, hh, 0)
  if (s < hw + 2 * hh) return out.set(dir * hw, hh - (s - hw), 0)
  return out.set(dir * (hw - (s - hw - 2 * hh)), -hh, 0)
}

/** vertical soft bar used for the light sweep across the window */
function barTexture() {
  const canvas = document.createElement('canvas')
  canvas.width = 4
  canvas.height = 128
  const ctx = canvas.getContext('2d')!
  const g = ctx.createLinearGradient(0, 0, 0, 128)
  g.addColorStop(0, 'rgba(255,255,255,0)')
  g.addColorStop(0.5, 'rgba(255,255,255,1)')
  g.addColorStop(1, 'rgba(255,255,255,0)')
  ctx.fillStyle = g
  ctx.fillRect(0, 0, 4, 128)
  return new THREE.CanvasTexture(canvas)
}

export class GridView {
  readonly root = new THREE.Group()
  /** 1 normal, >1 turbo */
  speed = 1
  sparksPerSymbol = 60
  private readonly fx: Fx
  private readonly pool = new SymbolPool()
  private readonly cells: CellView[][]
  /** gold glow behind reels that are still deciding */
  private readonly beams: THREE.Mesh[] = []
  /** white impact flash when a reel locks */
  private readonly hits: THREE.Mesh[] = []
  /** darkens everything behind the winners */
  private readonly veil: THREE.Mesh
  private readonly sweepBar: THREE.Mesh
  /** full-window overlays: skipped entirely while transparent, they cost fill rate on weak GPUs */
  private readonly overlays: THREE.Mesh[]
  /** spin launch: security laser scanning the window */
  private readonly laser: THREE.Mesh
  /** spin launch: energy pouring down each reel */
  private readonly comets: THREE.Mesh[] = []
  /** spin launch: two lights racing round the neon frame */
  private readonly chasers: THREE.Sprite[] = []
  private strips: Strip[] = []
  private time = 0
  private nextGlint = 4

  constructor(fx: Fx, initial: Grid) {
    this.fx = fx
    this.pool.warm(4)
    const haloTex = glowTexture()
    this.cells = Array.from({ length: COLS }, (_, c) =>
      Array.from({ length: ROWS }, (_, r) => {
        const holder = new THREE.Group()
        cellPosition(c, r, holder.position)
        const halo = new THREE.Sprite(
          new THREE.SpriteMaterial({
            map: haloTex,
            transparent: true,
            opacity: 0,
            blending: THREE.AdditiveBlending,
            depthWrite: false,
            toneMapped: false,
            clippingPlanes: CLIP_PLANES,
          }),
        )
        halo.position.z = -0.25
        halo.scale.setScalar(1.6)
        holder.add(halo)
        this.root.add(holder)
        return { holder, model: null, halo, phase: Math.random() * Math.PI * 2 }
      }),
    )

    const columnGeo = new THREE.PlaneGeometry(CELL * 1.1, GRID_H * 1.05)
    for (let c = 0; c < COLS; c++) {
      const x = cellPosition(c, 0).x
      const beam = new THREE.Mesh(columnGeo, additive(new THREE.Color('#ffc44d').multiplyScalar(1.4), haloTex))
      beam.position.set(x, 0, -0.45)
      beam.visible = false
      const hit = new THREE.Mesh(columnGeo, additive(new THREE.Color('#ffffff').multiplyScalar(0.9), haloTex))
      hit.position.set(x, 0, 0.6)
      hit.renderOrder = 6
      this.beams.push(beam)
      this.hits.push(hit)
      this.root.add(beam, hit)
    }

    this.veil = new THREE.Mesh(
      // tall enough to darken the strips right up to the bezel, wherever the camera looks from
      new THREE.PlaneGeometry(GRID_W + 0.4, GRID_H + 0.7),
      new THREE.MeshBasicMaterial({ color: '#000000', transparent: true, opacity: 0, depthWrite: false }),
    )
    this.veil.position.z = 0.35
    this.veil.renderOrder = 5
    this.sweepBar = new THREE.Mesh(new THREE.PlaneGeometry(GRID_W * 1.6, 1.1), additive(new THREE.Color('#ffffff').multiplyScalar(1.1), barTexture(), true))
    this.sweepBar.position.z = 0.75
    this.sweepBar.renderOrder = 7
    this.laser = new THREE.Mesh(
      new THREE.PlaneGeometry(GRID_W + 0.5, 0.7),
      additive(new THREE.Color('#ffd27a').multiplyScalar(2.6), gradientTexture([[0, 0], [0.4, 0.12], [0.48, 0.85], [0.5, 1], [0.52, 0.85], [0.6, 0.12], [1, 0]]), true),
    )
    this.laser.position.z = 0.8
    this.laser.renderOrder = 8
    const cometTex = gradientTexture([[0, 0], [0.7, 0.22], [0.92, 0.9], [0.97, 1], [1, 0]])
    for (let c = 0; c < COLS; c++) {
      const comet = new THREE.Mesh(new THREE.PlaneGeometry(CELL * 0.75, 2.4), additive(new THREE.Color('#ffd76a').multiplyScalar(2.2), cometTex, true))
      comet.position.set(cellPosition(c, 0).x, 0, 0.7)
      comet.renderOrder = 7
      this.comets.push(comet)
    }
    for (const color of ['#ffc65a', '#ffffff']) {
      const s = new THREE.Sprite(
        new THREE.SpriteMaterial({ map: haloTex, color: new THREE.Color(color).multiplyScalar(4), blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false }),
      )
      s.scale.setScalar(0.9)
      s.visible = false
      s.renderOrder = 12
      this.chasers.push(s)
    }
    this.root.add(this.veil, this.sweepBar, this.laser, ...this.comets, ...this.chasers)
    this.overlays = [this.veil, this.sweepBar, this.laser, ...this.comets, ...this.hits]
    this.setGrid(initial)
  }

  /** pooled model with any leftover tweens from its previous life stopped */
  private take(id: SymbolId) {
    const model = this.pool.acquire(id)
    gsap.killTweensOf([model.position, model.scale, model.rotation])
    return model
  }

  /**
   * Inner edge of the frame round the reels, relative to the grid: half its height and how far in
   * front of the symbols it sits. Symbols are clipped where this edge is, as seen from the camera.
   */
  windowEdge = { halfH: GRID_H / 2 + 0.06, z: 0 }

  /**
   * Each clip plane runs from the camera through the frame's top or bottom inner edge, so a symbol
   * leaving the window disappears exactly behind the frame instead of being cut off across the
   * visible strip of frame lining. Call every frame: the camera drifts.
   */
  updateClip(camera: THREE.Camera) {
    this.root.updateWorldMatrix(true, false)
    const center = this.root.getWorldPosition(clipCenter)
    const eye = camera.getWorldPosition(clipEye)
    const edgeZ = center.z + this.windowEdge.z
    const edges = [center.y + this.windowEdge.halfH, center.y - this.windowEdge.halfH]
    edges.forEach((y, i) => {
      const plane = CLIP_PLANES[i]
      // the plane contains the edge line (along x) and the eye
      clipNormal.set(0, -(eye.z - edgeZ), eye.y - y).normalize()
      plane.setFromNormalAndCoplanarPoint(clipNormal, clipPoint.set(0, y, edgeZ))
      if (plane.distanceToPoint(center) < 0) plane.negate()
    })
  }

  setGrid(grid: Grid) {
    this.cells.forEach((col, c) =>
      col.forEach((cell, r) => {
        if (cell.model) this.pool.release(cell.model)
        cell.model = this.take(grid[c][r])
        cell.holder.add(cell.model)
      }),
    )
  }

  /** ids currently shown, for sanity checks */
  snapshot(): Grid {
    return this.cells.map((col) => col.map((cell) => (cell.model?.userData.id ?? -1) as SymbolId))
  }

  update(dt: number) {
    this.time += dt
    const t = this.time
    for (const col of this.cells) for (const cell of col) if (cell.model) this.idle(cell.model, t, cell.phase, dt)
    for (const strip of this.strips) this.updateStrip(strip, dt)
    this.beams.forEach((b, i) => {
      if (b.visible) (b.material as THREE.MeshBasicMaterial).opacity = 0.45 + 0.25 * Math.sin(t * 9 + i)
    })
    for (const o of this.overlays) o.visible = (o.material as THREE.MeshBasicMaterial).opacity > 0.003
    // a slow diagonal glint across the stones keeps the idle machine alive
    if (t > this.nextGlint) {
      this.nextGlint = t + 9 + Math.random() * 4
      if (this.strips.length === 0) this.sweep({ angle: -0.55, opacity: 0.16, duration: 1.4 })
    }
  }

  private idle(model: SymbolModel, t: number, phase: number, dt: number) {
    const { sway, spinner, motion, sparkles } = model.userData.parts
    sway.rotation.x = Math.sin(t * 0.7 + phase * 1.3) * 0.08
    sway.position.y = Math.sin(t * 1.4 + phase) * 0.035
    if (spinner) {
      if (motion === 'rotate') spinner.rotation.y += dt * 0.9
      else if (motion === 'dial') spinner.rotation.z = Math.sin(t * 0.8 + phase) * 1.4
      else spinner.rotation.y = Math.sin(t * 0.85 + phase) * 0.75
    }
    sparkles?.forEach((s, i) => s.scale.setScalar(0.34 * Math.max(0, Math.sin(t * 2.2 + phase + i * 2.3)) ** 6))
  }

  /** a bar of light passing over the window */
  sweep({ angle = 0, opacity = 0.7, duration = 0.45 }: { angle?: number; opacity?: number; duration?: number } = {}) {
    const bar = this.sweepBar
    const mat = bar.material as THREE.MeshBasicMaterial
    gsap.killTweensOf([bar.position, mat])
    bar.rotation.z = angle
    bar.position.y = GRID_H / 2 + 1.2
    mat.opacity = opacity
    gsap.to(bar.position, { y: -GRID_H / 2 - 1.2, duration, ease: 'power1.inOut' })
    gsap.to(mat, { opacity: 0, duration: duration * 0.4, delay: duration * 0.6 })
  }

  /** spin start: a security laser scans the window, energy pours into every reel and light races round the frame */
  private launchFx() {
    const sp = this.speed
    const top = GRID_H / 2 + 0.4
    const bottom = -GRID_H / 2 - 0.4
    const edge = GRID_W / 2 + 0.2

    const lm = this.laser.material as THREE.MeshBasicMaterial
    gsap.killTweensOf([this.laser.position, lm])
    this.laser.position.y = top
    lm.opacity = 1
    gsap.to(this.laser.position, {
      y: bottom,
      duration: 0.42 / sp,
      ease: 'power2.inOut',
      onUpdate: () => {
        for (const side of [-1, 1]) {
          v3.set(side * edge, this.laser.position.y, 0.8)
          this.root.localToWorld(v3)
          this.fx.sparks.emit(v3, '#ffd27a', { count: 2, speed: 2.5, size: 0.08, life: 0.45, lift: 0.5, flat: 0.8 })
        }
      },
    })
    gsap.to(lm, { opacity: 0, duration: 0.12 / sp, delay: 0.34 / sp })

    this.comets.forEach((m, c) => {
      const mat = m.material as THREE.MeshBasicMaterial
      const delay = (0.08 + c * 0.035) / sp
      gsap.killTweensOf([m.position, mat])
      m.position.y = top + 1.2
      mat.opacity = 0
      gsap.to(mat, { opacity: 0.9, duration: 0.06 / sp, delay })
      gsap.to(m.position, { y: bottom - 1.2, duration: 0.32 / sp, delay, ease: 'power2.in' })
      gsap.to(mat, { opacity: 0, duration: 0.1 / sp, delay: delay + 0.24 / sp })
    })

    const hw = GRID_W / 2 + 0.36
    const hh = GRID_H / 2 + 0.32
    const half = 2 * hw + 2 * hh
    this.chasers.forEach((s, i) => {
      const dir = i === 0 ? 1 : -1
      const color = i === 0 ? '#ffc65a' : '#ffffff'
      const p = { s: 0 }
      s.visible = true
      gsap.to(p, {
        s: half,
        duration: 0.55 / sp,
        ease: 'power1.inOut',
        onUpdate: () => {
          framePoint(p.s, hw, hh, dir, s.position).setZ(1.06)
          v3.copy(s.position)
          this.root.localToWorld(v3)
          this.fx.sparks.emit(v3, color, { count: 2, speed: 1.2, size: 0.07, life: 0.4, lift: 0, flat: 0.9 })
        },
        onComplete: () => {
          s.visible = false
          v3.set(0, -hh, 1.06)
          this.root.localToWorld(v3)
          this.fx.flashes.emit(v3, '#ffc65a', 2.4, 0.35)
        },
      })
    })

    v3.set(0, 0, 0.9)
    this.root.localToWorld(v3)
    this.fx.rings.emit(v3, '#ffd27a', 3.2, 0.5)
    this.fx.flashes.emit(v3, '#ffe2a8', 3.4, 0.3)
  }

  // ------------------------------------------------------------ spin

  async spin(next: Grid, play: SpinPlayback) {
    const sp = this.speed
    const firstSlow = play.anticipateFrom ?? COLS
    let scatters = 0
    const landed = (c: number) => {
      scatters += next[c].filter((s) => s === SCATTER).length
      play.onColumnLand?.(c, scatters)
    }

    this.launchFx()
    // every reel launches almost together and blurs into motion
    const outs: Promise<void>[] = []
    for (let c = 0; c < COLS; c++) {
      outs.push(this.dropOut(c, (c * 0.03) / sp))
      gsap.delayedCall((c * 0.03 + 0.06) / sp, () => this.startStrip(c))
    }

    // then they lock one after another, left to right
    const stops: Promise<void>[] = []
    for (let c = 0; c < firstSlow; c++) {
      stops.push(wait((0.55 + c * 0.16) / sp).then(() => this.stopReel(c, next[c], false)).then(() => landed(c)))
    }
    await Promise.all(stops)

    for (let c = firstSlow; c < COLS; c++) {
      const decided = scatters >= 3
      play.onAnticipate?.(c)
      this.beams[c].visible = true
      const strip = this.strips.find((s) => s.col === c)
      // the last reel gets the longest hold; earlier slow reels keep the pace up
      const suspense = (decided ? 0.45 : c === COLS - 1 ? 1.35 : 0.65) / sp
      if (strip) gsap.to(strip, { speed: 7, duration: suspense, ease: 'power1.out' })
      await wait(suspense)
      this.beams[c].visible = false
      await this.stopReel(c, next[c], true)
      landed(c)
    }
    await Promise.all(outs)
    this.verify(next)
  }

  private dropOut(c: number, delay: number) {
    const sp = this.speed
    const jobs = this.cells[c].map((cell, r) => {
      const model = cell.model
      if (!model) return Promise.resolve()
      cell.model = null
      return tween(model.position, {
        y: -OUT,
        duration: 0.22 / sp,
        delay: delay + ((ROWS - 1 - r) * 0.008) / sp,
        ease: 'power2.in',
      }).then(() => this.pool.release(model))
    })
    return Promise.all(jobs).then(() => undefined)
  }

  /** the reel locks: the blurred strip slides away and the final symbols snap in with an overshoot */
  private stopReel(c: number, column: SymbolId[], heavy: boolean) {
    const sp = this.speed
    this.stopStrip(c)
    const from = (heavy ? 3.2 : 2.2) * CELL
    const duration = (heavy ? 0.42 : 0.24) / sp
    const jobs = this.cells[c].map((cell, r) => {
      const model = this.take(column[r])
      cell.model = model
      cell.holder.add(model)
      model.position.y = from
      model.scale.set(0.92, 1.35, 1)
      gsap.to(model.scale, { x: 1, y: 1, z: 1, duration: duration * 1.4, ease: 'back.out(3)' })
      return tween(model.position, { y: 0, duration, ease: heavy ? 'back.out(2.4)' : 'back.out(1.8)' })
    })
    return Promise.all(jobs).then(() => this.impact(c, heavy))
  }

  /** flash and sparks where a reel locks */
  private impact(c: number, heavy: boolean) {
    const hit = this.hits[c].material as THREE.MeshBasicMaterial
    gsap.fromTo(hit, { opacity: heavy ? 0.75 : 0.4 }, { opacity: 0, duration: heavy ? 0.5 : 0.28, ease: 'power2.out' })
    const at = cellPosition(c, ROWS - 1, v3).add(new THREE.Vector3(0, -CELL * 0.45, 0.4))
    this.root.localToWorld(at)
    this.fx.sparks.emit(at, heavy ? '#ffd76a' : '#ffffff', { count: heavy ? 40 : 14, speed: heavy ? 5 : 3, size: 0.09, life: 0.6, lift: 2, flat: 0.8 })
  }

  private startStrip(c: number) {
    const group = new THREE.Group()
    group.position.x = cellPosition(c, 0).x
    this.root.add(group)
    const models = Array.from({ length: ROWS + 2 }, () => {
      const m = this.take(randomSymbol())
      group.add(m)
      return m
    })
    this.strips.push({ col: c, group, models, wraps: models.map(() => 0), offset: 0, speed: 30 })
  }

  private updateStrip(strip: Strip, dt: number) {
    strip.offset += strip.speed * dt
    const n = strip.models.length
    const span = n * CELL
    const top = GRID_H / 2 + CELL / 2
    const stretch = Math.min(strip.speed, 30)
    strip.models.forEach((m, i) => {
      const travel = i * CELL + strip.offset
      const wrap = Math.floor(travel / span)
      if (wrap !== strip.wraps[i]) {
        strip.wraps[i] = wrap
        this.pool.release(m)
        m = strip.models[i] = this.take(randomSymbol())
        strip.group.add(m)
      }
      m.position.y = top - (travel % span)
      m.scale.set(1 - stretch * 0.008, 1 + stretch * 0.045, 1)
    })
  }

  private stopStrip(c: number) {
    const strip = this.strips.find((s) => s.col === c)
    if (!strip) return
    this.strips = this.strips.filter((s) => s !== strip)
    const models = strip.models
    Promise.all(
      models.map((m) => tween(m.position, { y: m.position.y - OUT, duration: 0.18 / this.speed, ease: 'power1.in' })),
    ).then(() => {
      models.forEach((m) => this.pool.release(m))
      strip.group.removeFromParent()
    })
  }

  // ------------------------------------------------------------ wins

  private forCells(cells: Cell[]) {
    return cells.map((p) => this.cells[p.col][p.row])
  }

  /** winners leap out of the darkened window towards the camera, linked by arcs of energy */
  async highlight(cells: Cell[]) {
    const sp = this.speed
    const winners = new Set(this.forCells(cells))
    gsap.to(this.veil.material, { opacity: 0.62, duration: 0.25 / sp })
    for (const col of this.cells) {
      for (const cell of col) {
        const model = cell.model
        if (!model || winners.has(cell)) continue
        gsap.to(model.scale, { x: 0.88, y: 0.88, z: 0.88, duration: 0.25 / sp })
      }
    }
    for (const cell of winners) {
      const model = cell.model
      if (!model) continue
      const color = SYMBOLS[model.userData.id].color
      const halo = cell.halo.material as THREE.SpriteMaterial
      halo.color.set(color).multiplyScalar(1.6)
      gsap.to(halo, { opacity: 0.8, duration: 0.2 / sp })
      gsap.to(cell.halo.position, { z: LIFT - 0.3, duration: 0.3 / sp, ease: 'power3.out' })
      gsap.to(model.position, { z: LIFT, duration: 0.3 / sp, ease: 'back.out(2)' })
      gsap.to(model.scale, { x: 1.3, y: 1.3, z: 1.3, duration: 0.3 / sp, ease: 'back.out(2.5)' })
      gsap.to(model.rotation, { y: model.rotation.y + Math.PI * 2, duration: 0.85 / sp, ease: 'power2.inOut' })
    }
    // bolts between neighbours of the same win, in reading order
    await wait(0.18 / sp)
    const groups = new Map<SymbolId, THREE.Vector3[]>()
    for (const cell of winners) {
      if (!cell.model) continue
      const id = cell.model.userData.id
      const p = cell.holder.getWorldPosition(new THREE.Vector3())
      p.z += LIFT + 0.15
      let list = groups.get(id)
      if (!list) groups.set(id, (list = []))
      list.push(p)
    }
    for (const [id, pts] of groups) {
      const path = nearestPath(pts)
      for (let i = 0; i < path.length - 1; i++) {
        gsap.delayedCall((i * 0.03) / sp, () => this.fx.arcs.zap(path[i], path[i + 1], SYMBOLS[id].color, 0.75 / sp))
      }
    }
    await wait(0.62 / sp)
  }

  async explode(cells: Cell[]) {
    const sp = this.speed
    for (const cell of this.forCells(cells)) {
      const model = cell.model
      if (!model) continue
      cell.model = null
      const color = SYMBOLS[model.userData.id].color
      model.getWorldPosition(v3)
      this.fx.flashes.emit(v3, color, 3.2, 0.4)
      this.fx.sparks.emit(v3, color, { count: this.sparksPerSymbol, speed: 7.5, size: 0.15, life: 1.2, lift: 1.5, flat: 0.2 })
      this.fx.sparks.emit(v3, '#ffffff', { count: Math.round(this.sparksPerSymbol / 3), speed: 10, size: 0.08, life: 0.5, lift: 0 })
      this.fx.shards.emit(v3, color, 10, 6)
      this.fx.rings.emit(v3, color, 1.25, 0.38)
      gsap.killTweensOf(model.scale)
      gsap.to(cell.halo.material, { opacity: 0, duration: 0.25 / sp })
      gsap.to(cell.halo.position, { z: -0.25, duration: 0.3 / sp })
      tween(model.scale, { x: 1.7, y: 1.7, z: 1.7, duration: 0.07 / sp, ease: 'power2.out' })
        .then(() => tween(model.scale, { x: 0, y: 0, z: 0, duration: 0.09 / sp, ease: 'power2.in' }))
        .then(() => this.pool.release(model))
    }
    for (const col of this.cells) {
      for (const cell of col) {
        if (!cell.model) continue
        gsap.to(cell.model.position, { z: 0, duration: 0.3 / sp })
        gsap.to(cell.model.scale, { x: 1, y: 1, z: 1, duration: 0.3 / sp })
      }
    }
    await wait(0.3 / sp)
  }

  async collapse(fall: ColumnFall[], next: Grid) {
    const sp = this.speed
    gsap.to(this.veil.material, { opacity: 0, duration: 0.35 / sp })
    const jobs: Promise<void>[] = []
    for (const f of fall) {
      const c = f.col
      const old = this.cells[c].map((cell) => cell.model)
      const fresh: (SymbolModel | null)[] = Array(ROWS).fill(null)
      const offset: number[] = Array(ROWS).fill(0)
      const movedFrom = new Set(f.moves.map((m) => m.from))
      old.forEach((m, r) => {
        if (m && !movedFrom.has(r)) fresh[r] = m
      })
      for (const { from, to } of f.moves) {
        fresh[to] = old[from]
        offset[to] = (to - from) * CELL
      }
      const k = f.incoming.length
      f.incoming.forEach((id, i) => {
        fresh[i] = this.take(id)
        offset[i] = k * CELL + 0.8
      })
      fresh.forEach((model, r) => {
        const cell = this.cells[c][r]
        cell.model = model
        if (!model || offset[r] === 0) return
        cell.holder.add(model)
        model.position.y = offset[r]
        jobs.push(
          tween(model.position, {
            y: 0,
            duration: (0.2 + 0.08 * Math.sqrt(offset[r])) / sp,
            delay: (c * 0.03 + (ROWS - 1 - r) * 0.03) / sp,
            ease: 'power2.in',
          }).then(() => this.squash(model, 0.7)),
        )
      })
    }
    await Promise.all(jobs)
    this.verify(next)
  }

  private squash(model: SymbolModel, amount: number) {
    gsap.fromTo(
      model.scale,
      { x: 1 + 0.12 * amount, y: 1 - 0.18 * amount, z: 1 },
      { x: 1, y: 1, z: 1, duration: 0.32 / this.speed, ease: 'back.out(4)' },
    )
  }

  async celebrateScatters(cells: Cell[]) {
    const gold = SYMBOLS[SCATTER].color
    gsap.to(this.veil.material, { opacity: 0.55, duration: 0.3 })
    for (const cell of this.forCells(cells)) {
      const model = cell.model
      if (!model) continue
      ;(cell.halo.material as THREE.SpriteMaterial).color.set(gold).multiplyScalar(2.2)
      gsap.to(cell.halo.material, { opacity: 1, duration: 0.3 })
      gsap.to(cell.halo.position, { z: LIFT - 0.3, duration: 0.4 })
      gsap.to(model.position, { z: LIFT, duration: 0.4, ease: 'power2.out' })
      gsap.to(model.scale, { x: 1.5, y: 1.5, z: 1.5, duration: 0.7, ease: 'elastic.out(1, 0.45)' })
      gsap.to(model.rotation, { z: model.rotation.z - Math.PI * 4, duration: 1.5, ease: 'power3.inOut' })
      model.getWorldPosition(v3)
      for (let i = 0; i < 3; i++) {
        const at = v3.clone().setZ(v3.z + LIFT)
        gsap.delayedCall(i * 0.35, () => {
          this.fx.sparks.emit(at, gold, { count: this.sparksPerSymbol, speed: 5, size: 0.13, life: 1.2, lift: 0.5 })
          this.fx.rings.emit(at, gold, 2.2, 0.6)
          this.fx.flashes.emit(at, gold, 2.6, 0.45)
        })
      }
    }
    const pts = this.forCells(cells).map((c) => c.holder.getWorldPosition(new THREE.Vector3()).setZ(LIFT + 0.15))
    const path = nearestPath(pts)
    for (let k = 0; k < 3; k++) {
      gsap.delayedCall(0.3 + k * 0.4, () => {
        for (let i = 0; i < path.length - 1; i++) this.fx.arcs.zap(path[i], path[i + 1], gold, 0.5)
      })
    }
    await wait(1.7)
    gsap.to(this.veil.material, { opacity: 0, duration: 0.4 })
    for (const cell of this.forCells(cells)) {
      gsap.to(cell.halo.material, { opacity: 0, duration: 0.4 })
      gsap.to(cell.halo.position, { z: -0.25, duration: 0.4 })
      if (!cell.model) continue
      gsap.to(cell.model.position, { z: 0, duration: 0.4 })
      gsap.to(cell.model.scale, { x: 1, y: 1, z: 1, duration: 0.4 })
    }
  }

  private verify(expected: Grid) {
    if (!import.meta.env.DEV) return
    const shown = this.snapshot()
    if (JSON.stringify(shown) !== JSON.stringify(expected)) console.warn('[grid] view out of sync', { shown, expected })
  }
}

/** greedy chain through the points, starting top-left, so arcs hop between neighbours */
function nearestPath(points: THREE.Vector3[]) {
  if (points.length < 2) return points
  const left = [...points].sort((a, b) => b.y - a.y || a.x - b.x)
  const path = [left.shift()!]
  while (left.length) {
    const last = path[path.length - 1]
    let best = 0
    for (let i = 1; i < left.length; i++) if (left[i].distanceToSquared(last) < left[best].distanceToSquared(last)) best = i
    path.push(left.splice(best, 1)[0])
  }
  return path
}
