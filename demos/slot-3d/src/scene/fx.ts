import * as THREE from 'three'
import { coinGeometry, glowTexture } from './symbols/factory'

const tmpColor = new THREE.Color()

// ---------------------------------------------------------------- sparks

const sparkVertex = /* glsl */ `
  attribute float aSize;
  attribute float aAlpha;
  attribute vec3 aColor;
  uniform float uViewport;
  varying vec3 vColor;
  varying float vAlpha;
  void main() {
    vec4 mv = modelViewMatrix * vec4(position, 1.0);
    gl_Position = projectionMatrix * mv;
    gl_PointSize = aSize * projectionMatrix[1][1] * uViewport * 0.5 / -mv.z;
    vColor = aColor;
    vAlpha = aAlpha;
  }
`

const sparkFragment = /* glsl */ `
  varying vec3 vColor;
  varying float vAlpha;
  void main() {
    float r = length(gl_PointCoord - 0.5);
    float a = smoothstep(0.5, 0.0, r);
    a *= a;
    vec3 c = vColor * (1.0 + 3.0 * smoothstep(0.16, 0.0, r));
    gl_FragColor = vec4(c * a * vAlpha, 1.0);
  }
`

export interface EmitOptions {
  count: number
  speed?: number
  size?: number
  life?: number
  /** extra upward velocity */
  lift?: number
  /** 0 = sphere burst, 1 = flat burst in the screen plane */
  flat?: number
}

/** additive glowing points; one draw call for every spark in the scene */
export class Sparks {
  readonly object: THREE.Points
  private readonly max: number
  private readonly pos: Float32Array
  private readonly col: Float32Array
  private readonly size: Float32Array
  private readonly alpha: Float32Array
  private readonly vel: Float32Array
  private readonly life: Float32Array
  private readonly maxLife: Float32Array
  private readonly baseSize: Float32Array
  private cursor = 0
  private readonly geo: THREE.BufferGeometry
  readonly material: THREE.ShaderMaterial
  gravity = -5

  constructor(max: number) {
    this.max = max
    this.pos = new Float32Array(max * 3)
    this.col = new Float32Array(max * 3)
    this.size = new Float32Array(max)
    this.alpha = new Float32Array(max)
    this.vel = new Float32Array(max * 3)
    this.life = new Float32Array(max)
    this.maxLife = new Float32Array(max)
    this.baseSize = new Float32Array(max)
    this.geo = new THREE.BufferGeometry()
    this.geo.setAttribute('position', new THREE.BufferAttribute(this.pos, 3).setUsage(THREE.DynamicDrawUsage))
    this.geo.setAttribute('aColor', new THREE.BufferAttribute(this.col, 3).setUsage(THREE.DynamicDrawUsage))
    this.geo.setAttribute('aSize', new THREE.BufferAttribute(this.size, 1).setUsage(THREE.DynamicDrawUsage))
    this.geo.setAttribute('aAlpha', new THREE.BufferAttribute(this.alpha, 1).setUsage(THREE.DynamicDrawUsage))
    this.material = new THREE.ShaderMaterial({
      vertexShader: sparkVertex,
      fragmentShader: sparkFragment,
      uniforms: { uViewport: { value: 1080 } },
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      transparent: true,
      toneMapped: false,
    })
    this.object = new THREE.Points(this.geo, this.material)
    this.object.frustumCulled = false
    this.object.renderOrder = 10
  }

  emit(origin: THREE.Vector3, color: THREE.ColorRepresentation, o: EmitOptions) {
    const { count, speed = 4, size = 0.12, life = 0.9, lift = 1, flat = 0.4 } = o
    tmpColor.set(color)
    for (let n = 0; n < count; n++) {
      const i = this.cursor
      this.cursor = (this.cursor + 1) % this.max
      const theta = Math.random() * Math.PI * 2
      const u = Math.random() * 2 - 1
      const s = Math.sqrt(1 - u * u)
      const v = speed * (0.35 + Math.random() * 0.65)
      this.pos[i * 3] = origin.x
      this.pos[i * 3 + 1] = origin.y
      this.pos[i * 3 + 2] = origin.z
      this.vel[i * 3] = Math.cos(theta) * s * v
      this.vel[i * 3 + 1] = Math.sin(theta) * s * v + lift
      this.vel[i * 3 + 2] = u * v * (1 - flat) + Math.abs(u) * v * 0.6
      // mix towards white for a hot core
      const hot = Math.random() * 0.45
      this.col[i * 3] = tmpColor.r + (1 - tmpColor.r) * hot
      this.col[i * 3 + 1] = tmpColor.g + (1 - tmpColor.g) * hot
      this.col[i * 3 + 2] = tmpColor.b + (1 - tmpColor.b) * hot
      this.maxLife[i] = this.life[i] = life * (0.5 + Math.random() * 0.7)
      this.baseSize[i] = size * (0.5 + Math.random())
    }
  }

  update(dt: number) {
    const drag = Math.exp(-1.8 * dt)
    for (let i = 0; i < this.max; i++) {
      if (this.life[i] <= 0) {
        if (this.alpha[i] !== 0) this.alpha[i] = this.size[i] = 0
        continue
      }
      this.life[i] -= dt
      const k = Math.max(this.life[i] / this.maxLife[i], 0)
      this.vel[i * 3] *= drag
      this.vel[i * 3 + 1] = this.vel[i * 3 + 1] * drag + this.gravity * dt
      this.vel[i * 3 + 2] *= drag
      this.pos[i * 3] += this.vel[i * 3] * dt
      this.pos[i * 3 + 1] += this.vel[i * 3 + 1] * dt
      this.pos[i * 3 + 2] += this.vel[i * 3 + 2] * dt
      this.alpha[i] = Math.min(1, k * 1.6)
      this.size[i] = this.baseSize[i] * (0.4 + 0.6 * k)
    }
    for (const name of ['position', 'aColor', 'aSize', 'aAlpha']) this.geo.attributes[name].needsUpdate = true
  }
}

// ---------------------------------------------------------------- instanced debris (shards, coins)

interface Body {
  p: THREE.Vector3
  v: THREE.Vector3
  axis: THREE.Vector3
  spin: number
  angle: number
  life: number
  maxLife: number
  scale: number
}

const m4 = new THREE.Matrix4()
const q = new THREE.Quaternion()
const sc = new THREE.Vector3()

class InstancedBodies {
  readonly mesh: THREE.InstancedMesh
  protected readonly bodies: Body[]
  private cursor = 0
  gravity = -9

  constructor(geo: THREE.BufferGeometry, mat: THREE.Material, max: number) {
    this.mesh = new THREE.InstancedMesh(geo, mat, max)
    this.mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage)
    this.mesh.frustumCulled = false
    this.bodies = Array.from({ length: max }, () => ({
      p: new THREE.Vector3(),
      v: new THREE.Vector3(),
      axis: new THREE.Vector3(0, 1, 0),
      spin: 0,
      angle: 0,
      life: 0,
      maxLife: 1,
      scale: 1,
    }))
    m4.makeScale(0, 0, 0)
    for (let i = 0; i < max; i++) this.mesh.setMatrixAt(i, m4)
  }

  protected spawn(): [Body, number] {
    const i = this.cursor
    this.cursor = (this.cursor + 1) % this.bodies.length
    return [this.bodies[i], i]
  }

  /** like spawn, but skips bodies still in flight; null when the pool is busy */
  protected spawnFree(): [Body, number] | null {
    for (let n = 0; n < this.bodies.length; n++) {
      const [b, i] = this.spawn()
      if (b.life <= 0) return [b, i]
    }
    return null
  }

  /** remaining scale multiplier for a body at life fraction k (1 → 0) */
  protected fade(k: number) {
    return Math.min(1, k * 3)
  }

  update(dt: number) {
    let any = false
    for (let i = 0; i < this.bodies.length; i++) {
      const b = this.bodies[i]
      if (b.life <= 0) continue
      any = true
      b.life -= dt
      b.v.y += this.gravity * dt
      b.p.addScaledVector(b.v, dt)
      b.angle += b.spin * dt
      const k = Math.max(b.life / b.maxLife, 0)
      q.setFromAxisAngle(b.axis, b.angle)
      sc.setScalar(b.life > 0 ? b.scale * this.fade(k) : 0)
      m4.compose(b.p, q, sc)
      this.mesh.setMatrixAt(i, m4)
    }
    if (any) this.mesh.instanceMatrix.needsUpdate = true
  }
}

export class Shards extends InstancedBodies {
  constructor(max: number) {
    const mat = new THREE.MeshBasicMaterial({ toneMapped: false })
    super(new THREE.TetrahedronGeometry(0.07), mat, max)
    this.mesh.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(max * 3), 3)
    this.gravity = -11
  }

  emit(origin: THREE.Vector3, color: THREE.ColorRepresentation, count: number, speed = 5) {
    tmpColor.set(color).multiplyScalar(2.2)
    for (let n = 0; n < count; n++) {
      const [b, i] = this.spawn()
      b.p.copy(origin)
      b.v.set(Math.random() - 0.5, Math.random() * 0.8 - 0.1, Math.random() * 0.8).normalize().multiplyScalar(speed * (0.5 + Math.random()))
      b.v.y += 2
      b.axis.randomDirection()
      b.spin = 6 + Math.random() * 14
      b.maxLife = b.life = 0.7 + Math.random() * 0.6
      b.scale = 0.6 + Math.random() * 1.2
      this.mesh.setColorAt(i, tmpColor)
    }
    this.mesh.instanceColor!.needsUpdate = true
  }
}

export class Coins extends InstancedBodies {
  /** coins spawned per second; 0 stops the fountain */
  rate = 0
  /** coins per second falling from above the screen */
  rainRate = 0
  private carry = 0
  private rainCarry = 0
  private readonly emitters: THREE.Vector3[]

  constructor(max: number, emitters: THREE.Vector3[]) {
    const mat = new THREE.MeshPhysicalMaterial({
      vertexColors: true,
      metalness: 1,
      roughness: 0.26,
      clearcoat: 0.2,
      envMapIntensity: 1.15,
      emissive: '#5a3500',
      emissiveIntensity: 0.4,
    })
    super(coinGeometry(), mat, max)
    this.gravity = -16
    this.emitters = emitters
  }

  protected fade(k: number) {
    return Math.min(1, k * 8)
  }

  burst(count: number) {
    for (let n = 0; n < count; n++) this.launch()
  }

  /** a coin dropping in from above the top of the screen, anywhere across its width */
  private launchRain() {
    const slot = this.spawnFree()
    if (!slot) return
    const [b] = slot
    b.p.set((Math.random() - 0.5) * 22, 9 + Math.random() * 2, 0.5 + Math.random() * 5)
    b.v.set((Math.random() - 0.5) * 1.5, -3 - Math.random() * 4, (Math.random() - 0.5) * 1)
    b.axis.set(1, (Math.random() - 0.5) * 0.8, (Math.random() - 0.5) * 0.5).normalize()
    b.spin = 5 + Math.random() * 8
    b.angle = Math.random() * Math.PI * 2
    b.maxLife = b.life = 2.2
    b.scale = 0.8 + Math.random() * 0.6
  }

  private launch() {
    const slot = this.spawnFree()
    if (!slot) return
    const [b] = slot
    const e = this.emitters[Math.floor(Math.random() * this.emitters.length)]
    b.p.copy(e).add(new THREE.Vector3((Math.random() - 0.5) * 1.5, 0, (Math.random() - 0.5) * 0.6))
    const side = Math.sign(e.x) || (Math.random() - 0.5)
    b.v.set(-side * (0.5 + Math.random() * 3) + (Math.random() - 0.5) * 2, 11 + Math.random() * 7, 0.8 + Math.random() * 2.6)
    // mostly end-over-end flips with a little wobble, like a real tossed coin
    b.axis.set(1, (Math.random() - 0.5) * 0.6, (Math.random() - 0.5) * 0.4).normalize()
    b.spin = 7 + Math.random() * 9
    b.angle = Math.random() * Math.PI
    b.maxLife = b.life = 2.6 + Math.random() * 0.8
    b.scale = 0.85 + Math.random() * 0.45
  }

  update(dt: number) {
    if (this.rate > 0) {
      this.carry += this.rate * dt
      while (this.carry >= 1) {
        this.carry--
        this.launch()
      }
    }
    if (this.rainRate > 0) {
      this.rainCarry += this.rainRate * dt
      while (this.rainCarry >= 1) {
        this.rainCarry--
        this.launchRain()
      }
    }
    super.update(dt)
  }
}

// ---------------------------------------------------------------- shockwave rings

export class Rings {
  readonly group = new THREE.Group()
  private readonly items: { mesh: THREE.Mesh; mat: THREE.MeshBasicMaterial; t: number; dur: number; size: number }[] = []
  private cursor = 0

  constructor(count = 24) {
    const geo = new THREE.RingGeometry(0.93, 1, 64)
    for (let i = 0; i < count; i++) {
      const mat = new THREE.MeshBasicMaterial({ transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false, opacity: 0 })
      const mesh = new THREE.Mesh(geo, mat)
      mesh.visible = false
      this.group.add(mesh)
      this.items.push({ mesh, mat, t: 1, dur: 1, size: 1 })
    }
    this.group.renderOrder = 9
  }

  emit(origin: THREE.Vector3, color: THREE.ColorRepresentation, size = 1.2, dur = 0.45) {
    const it = this.items[this.cursor]
    this.cursor = (this.cursor + 1) % this.items.length
    it.mesh.position.copy(origin)
    it.mat.color.set(color).multiplyScalar(3)
    it.t = 0
    it.dur = dur
    it.size = size
    it.mesh.visible = true
  }

  update(dt: number) {
    for (const it of this.items) {
      if (!it.mesh.visible) continue
      it.t += dt / it.dur
      if (it.t >= 1) {
        it.mesh.visible = false
        continue
      }
      const e = 1 - (1 - it.t) ** 3
      it.mesh.scale.setScalar(0.2 + e * it.size)
      it.mat.opacity = (1 - it.t) ** 1.5
    }
  }
}

// ---------------------------------------------------------------- lightning arcs

const ARC_SEGMENTS = 16

/** flickering energy bolts between winning symbols; ribbons in the screen plane, regenerated every few frames */
export class Arcs {
  readonly group = new THREE.Group()
  private readonly items: {
    mesh: THREE.Mesh
    pos: Float32Array
    mat: THREE.MeshBasicMaterial
    a: THREE.Vector3
    b: THREE.Vector3
    life: number
    max: number
    regen: number
  }[] = []
  private cursor = 0

  constructor(count = 48) {
    const index: number[] = []
    for (let i = 0; i < ARC_SEGMENTS - 1; i++) {
      const v = i * 2
      index.push(v, v + 1, v + 2, v + 1, v + 3, v + 2)
    }
    for (let i = 0; i < count; i++) {
      const pos = new Float32Array(ARC_SEGMENTS * 2 * 3)
      const geo = new THREE.BufferGeometry()
      geo.setAttribute('position', new THREE.BufferAttribute(pos, 3).setUsage(THREE.DynamicDrawUsage))
      geo.setIndex(index)
      const mat = new THREE.MeshBasicMaterial({
        transparent: true,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
        toneMapped: false,
        side: THREE.DoubleSide,
        opacity: 0,
      })
      const mesh = new THREE.Mesh(geo, mat)
      mesh.visible = false
      mesh.frustumCulled = false
      mesh.renderOrder = 11
      this.group.add(mesh)
      this.items.push({ mesh, pos, mat, a: new THREE.Vector3(), b: new THREE.Vector3(), life: 0, max: 1, regen: 0 })
    }
  }

  zap(a: THREE.Vector3, b: THREE.Vector3, color: THREE.ColorRepresentation, duration = 0.8) {
    const it = this.items[this.cursor]
    this.cursor = (this.cursor + 1) % this.items.length
    it.a.copy(a)
    it.b.copy(b)
    it.mat.color.set(color).multiplyScalar(3.5)
    it.max = it.life = duration
    it.regen = 0
    it.mesh.visible = true
  }

  private shape(it: (typeof this.items)[number]) {
    const dx = it.b.x - it.a.x
    const dy = it.b.y - it.a.y
    const len = Math.hypot(dx, dy) || 1
    const nx = -dy / len
    const ny = dx / len
    for (let i = 0; i < ARC_SEGMENTS; i++) {
      const t = i / (ARC_SEGMENTS - 1)
      const env = Math.sin(Math.PI * t)
      const jitter = (Math.random() * 2 - 1) * 0.16 * env * Math.min(1, len / 1.5)
      const x = it.a.x + dx * t + nx * jitter
      const y = it.a.y + dy * t + ny * jitter
      const z = it.a.z + (it.b.z - it.a.z) * t
      const w = 0.018 + 0.03 * env
      it.pos.set([x + nx * w, y + ny * w, z, x - nx * w, y - ny * w, z], i * 6)
    }
    it.mesh.geometry.attributes.position.needsUpdate = true
  }

  update(dt: number) {
    for (const it of this.items) {
      if (!it.mesh.visible) continue
      it.life -= dt
      if (it.life <= 0) {
        it.mesh.visible = false
        continue
      }
      it.regen -= dt
      if (it.regen <= 0) {
        it.regen = 0.045
        this.shape(it)
      }
      const k = it.life / it.max
      it.mat.opacity = Math.min(1, k * 3) * (0.65 + Math.random() * 0.35)
    }
  }
}

// ---------------------------------------------------------------- light flashes

/** soft additive bursts of light: impacts, explosions, landings */
export class Flashes {
  readonly group = new THREE.Group()
  private readonly items: { sprite: THREE.Sprite; mat: THREE.SpriteMaterial; t: number; dur: number; size: number }[] = []
  private cursor = 0

  constructor(count = 40) {
    for (let i = 0; i < count; i++) {
      const mat = new THREE.SpriteMaterial({ map: glowTexture(), transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false, opacity: 0 })
      const sprite = new THREE.Sprite(mat)
      sprite.visible = false
      sprite.renderOrder = 12
      this.group.add(sprite)
      this.items.push({ sprite, mat, t: 1, dur: 1, size: 1 })
    }
  }

  emit(at: THREE.Vector3, color: THREE.ColorRepresentation, size = 2.5, dur = 0.35) {
    const it = this.items[this.cursor]
    this.cursor = (this.cursor + 1) % this.items.length
    it.sprite.position.copy(at)
    it.mat.color.set(color).multiplyScalar(2.5)
    it.t = 0
    it.dur = dur
    it.size = size
    it.sprite.visible = true
  }

  update(dt: number) {
    for (const it of this.items) {
      if (!it.sprite.visible) continue
      it.t += dt / it.dur
      if (it.t >= 1) {
        it.sprite.visible = false
        continue
      }
      it.sprite.scale.setScalar(it.size * (0.35 + 0.65 * Math.min(1, it.t * 4)))
      it.mat.opacity = (1 - it.t) ** 2
    }
  }
}

// ---------------------------------------------------------------- floating dust

export function createDust(count: number, spread: THREE.Vector3, color: THREE.ColorRepresentation) {
  const pos = new Float32Array(count * 3)
  for (let i = 0; i < count; i++) {
    pos[i * 3] = (Math.random() - 0.5) * spread.x
    pos[i * 3 + 1] = (Math.random() - 0.5) * spread.y
    pos[i * 3 + 2] = (Math.random() - 0.5) * spread.z
  }
  const geo = new THREE.BufferGeometry()
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3))
  const mat = new THREE.PointsMaterial({
    map: glowTexture(),
    color: new THREE.Color(color),
    size: 0.09,
    transparent: true,
    opacity: 0.7,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    toneMapped: false,
  })
  const points = new THREE.Points(geo, mat)
  points.frustumCulled = false
  return points
}

/** everything that flies around; owned by the scene and driven by the director */
export class Fx {
  readonly root = new THREE.Group()
  readonly sparks: Sparks
  readonly shards: Shards
  readonly coins: Coins
  readonly rings = new Rings()
  readonly arcs = new Arcs()
  readonly flashes = new Flashes()

  constructor(limits: { sparks: number; shards: number; coins: number }, coinEmitters: THREE.Vector3[]) {
    this.sparks = new Sparks(limits.sparks)
    this.shards = new Shards(limits.shards)
    this.coins = new Coins(limits.coins, coinEmitters)
    this.root.add(this.sparks.object, this.shards.mesh, this.coins.mesh, this.rings.group, this.arcs.group, this.flashes.group)
  }

  update(dt: number) {
    this.sparks.update(dt)
    this.shards.update(dt)
    this.coins.update(dt)
    this.rings.update(dt)
    this.arcs.update(dt)
    this.flashes.update(dt)
  }
}
