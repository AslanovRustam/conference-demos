import logoSvg from '@brand/logo/clickable-logo-red.svg?raw'
import gsap from 'gsap'
import * as THREE from 'three'
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js'
import { SVGLoader } from 'three/examples/jsm/loaders/SVGLoader.js'
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js'
import { VAULT } from './layout'
import { vaultMaterials } from './materials'

/** door geometry, world units; the opening is centred on the origin in the wall plane z = 0 */
export const DOOR = {
  /** radius of the plug that sits inside the opening */
  plug: 4.5,
  /** radius of the front plate that overlaps the frame */
  face: 4.92,
  /** hinge axis position */
  hingeX: -5.75,
  hingeZ: 0.75,
  /** how far the door swings open, radians */
  // past square, so it folds back towards the wall and leaves the doorway clear
  openAngle: -2.05,
}

/** closed, the door's back plane sits just in front of the frame lip so the two never z-fight */
const CLOSED_Z = -DOOR.hingeZ + VAULT.frameLip + 0.02
/** knuckles on the hinge pin: the door carries three, the wall mount two in between */
const DOOR_KNUCKLES = [2.8, 0, -2.8]
const WALL_KNUCKLES = [1.4, -1.4]

const tween = (target: object, vars: gsap.TweenVars) => new Promise<void>((resolve) => gsap.to(target, { ...vars, onComplete: resolve }))

const disc = (r: number, depth: number, z: number, segments = 96) =>
  new THREE.CylinderGeometry(r, r, depth, segments).rotateX(Math.PI / 2).translate(0, 0, z + depth / 2)

const around = (n: number, r: number, make: (a: number) => THREE.BufferGeometry, offset = 0) =>
  Array.from({ length: n }, (_, i) => {
    const a = offset + (i / n) * Math.PI * 2
    return make(a).translate(Math.cos(a) * r, Math.sin(a) * r, 0)
  })

export function logoGeometry(width: number, depth: number) {
  const g = new THREE.ExtrudeGeometry(new SVGLoader().parse(logoSvg).paths.flatMap((p) => p.toShapes()), { depth: 1, bevelEnabled: false, curveSegments: 6 })
  g.center()
  g.computeBoundingBox()
  const s = width / (g.boundingBox!.max.x - g.boundingBox!.min.x)
  // flip two axes (SVG y points down) so the normals stay correct
  g.scale(s, -s, -depth)
  return g
}

/** bright band at the seam radius (RingGeometry maps its UVs across the outer radius) */
function seamGlowTexture() {
  const c = document.createElement('canvas')
  c.width = c.height = 256
  const ctx = c.getContext('2d')!
  const g = ctx.createRadialGradient(128, 128, 0, 128, 128, 128)
  g.addColorStop(0, 'rgba(255,255,255,0)')
  g.addColorStop(0.8, 'rgba(255,255,255,0)')
  g.addColorStop(0.87, 'rgba(255,255,255,1)')
  g.addColorStop(0.94, 'rgba(255,255,255,0.25)')
  g.addColorStop(1, 'rgba(255,255,255,0)')
  ctx.fillStyle = g
  ctx.fillRect(0, 0, 256, 256)
  return new THREE.CanvasTexture(c)
}

/** hinge knuckle: a cylinder with softened edges, along Y */
function knuckle(height: number, r: number) {
  const h = height / 2
  const c = 0.05
  const profile = [
    new THREE.Vector2(0.0001, -h),
    new THREE.Vector2(r - c, -h),
    new THREE.Vector2(r, -h + c),
    new THREE.Vector2(r, h - c),
    new THREE.Vector2(r - c, h),
    new THREE.Vector2(0.0001, h),
  ]
  return new THREE.LatheGeometry(profile, 40)
}

/**
 * Scale for the dial's sloped skirt, as a strip wrapped round it: 100 marks, numbers every 10.
 * White paint on dark steel; the same image doubles as a bump map so the marks read engraved.
 */
function dialScaleTexture() {
  const c = document.createElement('canvas')
  c.width = 2048
  c.height = 128
  const ctx = c.getContext('2d')!
  ctx.fillStyle = '#1b1d21'
  ctx.fillRect(0, 0, c.width, c.height)
  const step = c.width / 100
  for (let i = 0; i < 100; i++) {
    const x = (i + 0.5) * step
    const major = i % 10 === 0
    const mid = i % 5 === 0
    ctx.fillStyle = major ? '#f4f4f4' : mid ? '#d0d3d8' : '#9aa0a8'
    // marks start at the outer edge (top of the strip)
    ctx.fillRect(x - (major ? 4 : 2), 0, major ? 8 : 4, major ? 50 : mid ? 38 : 26)
  }
  ctx.fillStyle = '#f4f4f4'
  ctx.font = '800 58px Montserrat, system-ui, sans-serif'
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  for (let n = 0; n < 10; n++) ctx.fillText(String(n * 10), (n * 10 + 0.5) * step, 92)
  const tex = new THREE.CanvasTexture(c)
  tex.colorSpace = THREE.SRGBColorSpace
  tex.anisotropy = 8
  // lathe UVs run counter-clockwise and from the outer edge inwards: mirror both so "0" reads upright at the top
  tex.flipY = false
  tex.wrapS = THREE.RepeatWrapping
  tex.repeat.x = -1
  tex.offset.x = 0.5
  return tex
}

/** the round bank-vault door with its hinge, wheel, dial and locking bolts */
export class VaultDoor {
  readonly root = new THREE.Group()
  /** rotates around the hinge */
  private readonly pivot = new THREE.Group()
  /** the door itself; slides out of the frame before it swings */
  private readonly body = new THREE.Group()
  private readonly wheel = new THREE.Group()
  private readonly dial = new THREE.Group()
  private readonly bolts: THREE.Mesh[] = []
  /** golden light escaping round the seam */
  private readonly leakMat: THREE.MeshBasicMaterial
  /** 0 closed and locked, 1 wide open */
  state: 'closed' | 'open' = 'closed'

  constructor() {
    const m = vaultMaterials()
    this.pivot.position.set(DOOR.hingeX, 0, DOOR.hingeZ)
    this.body.position.set(-DOOR.hingeX, 0, CLOSED_Z)
    this.pivot.add(this.body)
    this.root.add(this.pivot)

    // plug into the opening, the overlapping front plate and the stepped face
    this.body.add(new THREE.Mesh(disc(DOOR.plug, 1.15, -1.15), m.dark))
    this.body.add(new THREE.Mesh(disc(DOOR.face, 0.42, 0), m.face))
    this.body.add(new THREE.Mesh(new THREE.TorusGeometry(DOOR.face - 0.06, 0.09, 14, 120).translate(0, 0, 0.42), m.chrome))
    this.body.add(new THREE.Mesh(disc(4.15, 0.06, 0.42), m.dark))
    this.body.add(new THREE.Mesh(disc(3.35, 0.24, 0.42), m.face))
    this.body.add(new THREE.Mesh(new THREE.TorusGeometry(3.35, 0.06, 10, 100).translate(0, 0, 0.66), m.chrome))
    this.body.add(new THREE.Mesh(disc(2.05, 0.2, 0.66), m.face))
    this.body.add(new THREE.Mesh(new THREE.TorusGeometry(2.05, 0.05, 10, 80).translate(0, 0, 0.86), m.chrome))

    const rivets = mergeGeometries(around(40, 4.5, () => new THREE.SphereGeometry(0.085, 12, 8).scale(1, 1, 0.55).translate(0, 0, 0.44)))
    const ribs = mergeGeometries(
      around(12, 3.75, (a) => new THREE.BoxGeometry(0.85, 0.2, 0.14).rotateZ(a).translate(0, 0, 0.5), Math.PI / 12),
    )
    this.body.add(new THREE.Mesh(rivets, m.accent), new THREE.Mesh(ribs, m.body))


    // spoked wheel with ball grips
    const hub = mergeGeometries([disc(0.62, 0.36, 0.86, 48), new THREE.SphereGeometry(0.42, 24, 16).scale(1, 1, 0.5).translate(0, 0, 1.22)])
    const spokes = mergeGeometries(around(8, 1.05, (a) => new THREE.CylinderGeometry(0.075, 0.09, 1.9, 14).rotateZ(a - Math.PI / 2).translate(0, 0, 1.12)))
    const grips = mergeGeometries(around(8, 2.08, () => new THREE.SphereGeometry(0.17, 18, 12).translate(0, 0, 1.12)))
    const ring = new THREE.TorusGeometry(0.85, 0.07, 12, 60).translate(0, 0, 1.12)
    this.wheel.add(new THREE.Mesh(hub, m.chrome), new THREE.Mesh(spokes, m.chrome), new THREE.Mesh(grips, m.accent), new THREE.Mesh(ring, m.chrome))
    this.body.add(this.wheel)

    // combination lock on a clear patch of the raised plate, upper right. Built like a real safe dial:
    // a fixed bezel with a raised red index, a dial with a knurled band and a sloped skirt carrying the
    // engraved scale, and a knurled knob with a domed cap
    // between two wheel grips (at 67.5 degrees), on a boss that lifts it clear of the plate's ring
    const dialAngle = (Math.PI * 3) / 8
    const at = new THREE.Vector3(Math.cos(dialAngle) * 2.75, Math.sin(dialAngle) * 2.75, 0.74)
    const satin = new THREE.MeshStandardMaterial({ color: '#3a3e46', metalness: 0.85, roughness: 0.32, envMapIntensity: 1.2 })
    const bezelMat = new THREE.MeshStandardMaterial({ color: '#c3c8d0', metalness: 1, roughness: 0.26, envMapIntensity: 1.2 })
    const scale = dialScaleTexture()
    const skirtMat = new THREE.MeshStandardMaterial({ map: scale, bumpMap: scale, bumpScale: -3, metalness: 0.6, roughness: 0.4, envMapIntensity: 1 })

    const housing = new THREE.Group()
    housing.position.copy(at)
    // profile runs outer to inner so the lathe's faces point at the viewer
    const bezel = new THREE.LatheGeometry(
      [
        new THREE.Vector2(0.63, 0),
        new THREE.Vector2(0.625, 0.09),
        new THREE.Vector2(0.59, 0.125),
        new THREE.Vector2(0.545, 0.115),
        new THREE.Vector2(0.52, 0.08),
        new THREE.Vector2(0.52, 0),
      ],
      72,
    ).rotateX(Math.PI / 2)
    const index = new THREE.ConeGeometry(0.06, 0.12, 3).rotateZ(Math.PI).translate(0, 0.58, 0.14)
    housing.add(
      new THREE.Mesh(disc(0.66, 0.08, -0.08, 72), satin),
      new THREE.Mesh(bezel, bezelMat),
      new THREE.Mesh(index, new THREE.MeshStandardMaterial({ color: '#ff1923', metalness: 0.2, roughness: 0.45 })),
    )

    this.dial.position.copy(at)
    // knurled band round the dial's edge
    const band = disc(0.49, 0.11, 0.01, 72)
    const ridges = mergeGeometries(around(72, 0.495, (a) => new THREE.BoxGeometry(0.02, 0.026, 0.11).rotateZ(a).translate(0, 0, 0.065)))
    // sloped skirt with the scale (lathe UVs run round the dial and up the slope)
    const skirt = new THREE.LatheGeometry([new THREE.Vector2(0.49, 0.12), new THREE.Vector2(0.3, 0.25)], 96).rotateX(Math.PI / 2)
    const top = disc(0.3, 0.01, 0.24, 72)
    // knob: knurled barrel, domed cap, brass centre
    const knob = disc(0.17, 0.15, 0.25, 48)
    const knobRidges = mergeGeometries(around(24, 0.172, (a) => new THREE.BoxGeometry(0.02, 0.022, 0.14).rotateZ(a).translate(0, 0, 0.325)))
    const dome = new THREE.SphereGeometry(0.17, 32, 12, 0, Math.PI * 2, 0, Math.PI / 2).rotateX(Math.PI / 2).scale(1, 1, 0.45).translate(0, 0, 0.4)
    this.dial.add(
      new THREE.Mesh(band, satin),
      new THREE.Mesh(ridges, satin),
      new THREE.Mesh(skirt, skirtMat),
      new THREE.Mesh(top, satin),
      new THREE.Mesh(knob, satin),
      new THREE.Mesh(knobRidges, satin),
      new THREE.Mesh(dome, bezelMat),
      new THREE.Mesh(disc(0.055, 0.02, 0.47, 24), m.accent),
    )
    this.body.add(housing, this.dial)

    // locking bolts round the plug edge: hidden in the frame when locked, flush when retracted
    for (let k = 0; k < 12; k++) {
      const a = (k / 12) * Math.PI * 2 + Math.PI / 12
      const bolt = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.2, 0.9, 20), m.chrome)
      bolt.rotation.z = a - Math.PI / 2
      bolt.position.set(Math.cos(a) * (DOOR.plug + 0.3), Math.sin(a) * (DOOR.plug + 0.3), -0.6)
      bolt.userData.angle = a
      this.bolts.push(bolt)
      this.body.add(bolt)
    }

    // inner side: linkage bars from the hub to every bolt
    const linkage = mergeGeometries([
      disc(1.1, 0.25, -1.4, 48),
      ...around(12, 2.2, (a) => new THREE.BoxGeometry(3.6, 0.16, 0.12).rotateZ(a).translate(0, 0, -1.22), Math.PI / 12),
    ])
    this.body.add(new THREE.Mesh(linkage, m.body))

    // hinge: a tall pin on a bolted wall mount; forged arms carry the door on alternating knuckles
    const hx = DOOR.hingeX
    const hz = DOOR.hingeZ
    const hexBolt = () => new THREE.CylinderGeometry(0.075, 0.075, 0.07, 6).rotateX(Math.PI / 2)
    const mountX = hx - 0.95
    const mount = new RoundedBoxGeometry(1.5, 7.4, 0.2, 3, 0.06).translate(mountX, 0, 0.1)
    const mountBolts = [-3.3, -2.2, -0.7, 0.7, 2.2, 3.3].flatMap((y) => [-0.48, 0.48].map((dx) => hexBolt().translate(mountX + dx, y, 0.23)))
    const brackets = WALL_KNUCKLES.map((y) => new RoundedBoxGeometry(1.15, 0.78, hz - 0.1, 3, 0.07).translate(hx - 0.55, y, (hz + 0.2) / 2))
    const pin = mergeGeometries([
      new THREE.CylinderGeometry(0.2, 0.2, 7.2, 28).translate(hx, 0, hz),
      new THREE.SphereGeometry(0.27, 24, 12, 0, Math.PI * 2, 0, Math.PI / 2).translate(hx, 3.6, hz),
      new THREE.SphereGeometry(0.27, 24, 12, 0, Math.PI * 2, Math.PI / 2, Math.PI / 2).translate(hx, -3.6, hz),
    ])
    const wallKnuckles = WALL_KNUCKLES.map((y) => knuckle(0.86, 0.42).translate(hx, y, hz))
    this.root.add(
      new THREE.Mesh(mergeGeometries([mount, ...brackets]), m.body),
      new THREE.Mesh(mergeGeometries(mountBolts), m.accent),
      new THREE.Mesh(pin, m.chrome),
      new THREE.Mesh(mergeGeometries(wallKnuckles), m.face),
    )
    // door side, in hinge space: each arm runs from its knuckle onto the door face and is bolted there
    const armZ = VAULT.frameLip + 0.02 + 0.42 + 0.18 - hz
    const armShape = new THREE.Shape()
    armShape.absarc(0, 0, 0.2, Math.PI / 2, (Math.PI * 3) / 2, false)
    armShape.lineTo(1.7, -0.2)
    armShape.quadraticCurveTo(1.85, -0.2, 1.85, 0)
    armShape.quadraticCurveTo(1.85, 0.2, 1.7, 0.2)
    armShape.closePath()
    const arm = (y: number) =>
      new THREE.ExtrudeGeometry(armShape, { depth: 0.52, bevelEnabled: true, bevelThickness: 0.04, bevelSize: 0.04, bevelSegments: 3, curveSegments: 16 })
        .translate(0, 0, -0.26)
        .rotateX(-Math.PI / 2)
        .translate(0, y, armZ)
    const arms = DOOR_KNUCKLES.map((y) => arm(y))
    const armBolts = DOOR_KNUCKLES.flatMap((y) => [1.1, 1.5].map((x) => hexBolt().translate(x, y, armZ + 0.26)))
    const doorKnuckles = DOOR_KNUCKLES.map((y) => knuckle(0.9, 0.42).translate(0, y, 0))
    this.pivot.add(
      new THREE.Mesh(mergeGeometries(arms), m.body),
      new THREE.Mesh(mergeGeometries(armBolts), m.accent),
      new THREE.Mesh(mergeGeometries(doorKnuckles), m.face),
    )

    this.leakMat = new THREE.MeshBasicMaterial({
      map: seamGlowTexture(),
      color: new THREE.Color('#ffc66b').multiplyScalar(3),
      transparent: true,
      opacity: 0,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      toneMapped: false,
    })
    const leak = new THREE.Mesh(new THREE.RingGeometry(4.3, 5.6, 96), this.leakMat)
    // between the frame lip and the door face: only the part outside the door shows
    leak.position.z = VAULT.frameLip + 0.01
    this.root.add(leak)
  }

  /** golden light seeping round the closed door, 0..1 */
  leak(amount: number, duration = 0.6) {
    gsap.to(this.leakMat, { opacity: amount, duration, overwrite: 'auto' })
  }

  async unlock(onTick?: () => void) {
    const tl = gsap.timeline()
    tl.to(this.dial.rotation, { z: -Math.PI * 1.6, duration: 0.45, ease: 'power2.inOut', onComplete: onTick })
    tl.to(this.dial.rotation, { z: -Math.PI * 0.7, duration: 0.3, ease: 'power2.inOut', onComplete: onTick })
    tl.to(this.wheel.rotation, { z: this.wheel.rotation.z - Math.PI * 1.25, duration: 0.9, ease: 'power2.inOut' }, '-=0.15')
    this.bolts.forEach((b, k) => {
      const a = b.userData.angle as number
      tl.to(b.position, { x: Math.cos(a) * (DOOR.plug - 0.42), y: Math.sin(a) * (DOOR.plug - 0.42), duration: 0.16, ease: 'power3.in' }, k === 0 ? '-=0.35' : '<0.035')
    })
    await tl.then()
  }

  async lock() {
    const tl = gsap.timeline()
    this.bolts.forEach((b, k) => {
      const a = b.userData.angle as number
      tl.to(b.position, { x: Math.cos(a) * (DOOR.plug + 0.3), y: Math.sin(a) * (DOOR.plug + 0.3), duration: 0.14, ease: 'power3.out' }, k === 0 ? 0 : '<0.03')
    })
    tl.to(this.wheel.rotation, { z: this.wheel.rotation.z + Math.PI * 1.25, duration: 0.7, ease: 'power2.inOut' }, 0)
    tl.to(this.dial.rotation, { z: 0, duration: 0.5, ease: 'power2.inOut' }, 0.1)
    await tl.then()
  }

  /** a short jolt as the seal breaks, then the heavy swing on the hinge */
  async open(duration = 2.2) {
    await tween(this.pivot.rotation, { y: -0.02, duration: 0.18, ease: 'power2.out', yoyo: true, repeat: 1 })
    await tween(this.pivot.rotation, { y: DOOR.openAngle, duration, ease: 'power2.inOut' })
    this.state = 'open'
  }

  async close(duration = 1.4) {
    this.state = 'closed'
    await tween(this.pivot.rotation, { y: 0, duration, ease: 'power3.in' })
  }

  /** instant pose, used on start */
  setClosed() {
    gsap.killTweensOf([this.pivot.rotation, this.body.position])
    this.pivot.rotation.y = 0
    this.body.position.z = CLOSED_Z
    this.state = 'closed'
  }
}
