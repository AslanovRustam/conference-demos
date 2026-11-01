import { BoxGeometry, BufferGeometry, CylinderGeometry, ExtrudeGeometry, LatheGeometry, Matrix4, Path, Quaternion, Shape, ShapeGeometry, Vector2, Vector3 } from 'three'
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js'
import { ROCKET_HEIGHT_M } from './refs'

// an original two-stage launcher: flared aft skirt with four swept fins and five engines,
// white tanks, a carbon interstage, an adapter fairing and a conical crew capsule with an escape tower.
// rocket space: meters, origin at the nozzle exit plane, +y up, the livery faces +z

export type ProfilePoint = [r: number, y: number]

export const DIM = {
  r: 2.3, // tank radius
  skirtBottom: 2.4,
  skirtR: 2.62, // the aft skirt flares out to this radius
  skirtTop: 7,
  stage1Top: 27.2,
  interTop: 31.4,
  stage2Top: 39.6, // the fairing group starts here
  capsuleBase: 42.2, // the capsule group starts here
  shieldY: 2.44, // engine heat shield plate
  bellLength: 3.2, // nozzle exit (y = 0) to throat
} as const

// texture v on the hull atlas: height over the whole rocket
export const hullV = (y: number) => y / ROCKET_HEIGHT_M

export interface NozzleSpec {
  x: number
  z: number
  exitR: number
  throatR: number
}

const OUTER_D = 1.62
const TAU = Math.PI * 2

// center engine, then four around it at azimuth 0, 90, 180, 270 degrees (+z, +x, -z, -x)
export const NOZZLES: NozzleSpec[] = [
  { x: 0, z: 0, exitR: 0.78, throatR: 0.3 },
  ...[0, 1, 2, 3].map((k) => ({
    x: Math.sin((k * Math.PI) / 2) * OUTER_D,
    z: Math.cos((k * Math.PI) / 2) * OUTER_D,
    exitR: 0.7,
    throatR: 0.27,
  })),
]

// fins sit between the outer engines
export const FIN_AZIMUTHS = [0.25, 0.75, 1.25, 1.75].map((k) => k * Math.PI)

// raceway (cable tunnel) azimuth: the +x side
export const RACEWAY_AZ = Math.PI / 2

// ---------- pure profile helpers ----------

// joins profile pieces bottom to top and drops repeated points
export function profile(...parts: ProfilePoint[][]): ProfilePoint[] {
  const out: ProfilePoint[] = []
  for (const part of parts) {
    for (const p of part) {
      const last = out[out.length - 1]
      if (last && Math.abs(last[0] - p[0]) < 1e-6 && Math.abs(last[1] - p[1]) < 1e-6) continue
      out.push(p)
    }
  }
  return out
}

// straight wall with shallow v-grooves (panel joints); guard points keep the groove shading
// from bleeding into the flat panels around it
export function groovedWall(r: number, y0: number, y1: number, grooves: number[], depth = 0.014, half = 0.035): ProfilePoint[] {
  const pts: ProfilePoint[] = [[r, y0]]
  for (const g of grooves) {
    if (g - half - 0.02 <= y0 || g + half + 0.02 >= y1) continue
    pts.push([r, g - half - 0.012], [r, g - half], [r - depth, g - half * 0.3], [r - depth, g + half * 0.3], [r, g + half], [r, g + half + 0.012])
  }
  pts.push([r, y1])
  return pts
}

// samples r(t) for t in 0..1 between y0 and y1
export function curve(y0: number, y1: number, steps: number, r: (t: number) => number): ProfilePoint[] {
  const pts: ProfilePoint[] = []
  for (let i = 0; i <= steps; i++) {
    const t = i / steps
    pts.push([r(t), y0 + (y1 - y0) * t])
  }
  return pts
}

// bell radius at a height above the exit plane
export function bellRadius(n: NozzleSpec, y: number): number {
  const s = Math.min(1, Math.max(0, 1 - y / DIM.bellLength)) // 0 at the throat, 1 at the exit
  return n.throatR + (n.exitR - n.throatR) * (1 - Math.pow(1 - s, 1.7))
}

// bell with a wall thickness: inner surface throat to exit (v 0..0.45), rounded lip (0.45..0.55),
// outer surface back up with two stiffener bands (0.55..1)
export function bellProfile(n: NozzleSpec, length: number = DIM.bellLength, wall = 0.03): { pts: ProfilePoint[]; v: number[] } {
  const k = length / DIM.bellLength
  const at = (y: number) => bellRadius(n, y / k)
  const steps = 22
  const pts: ProfilePoint[] = []
  const v: number[] = []
  const lip = wall * 0.4
  for (let i = 0; i <= steps; i++) {
    const y = length * (1 - i / steps) * (1 - lip / length) + lip
    pts.push([at(y), y])
    v.push((0.45 * i) / steps)
  }
  const e = at(0)
  pts.push([e + wall * 0.25, 0], [e + wall * 0.75, 0], [e + wall, lip])
  v.push(0.48, 0.52, 0.55)
  const bands = [0.08, 0.5].map((f) => f * length)
  for (let i = 1; i <= steps; i++) {
    const y = lip + ((length - lip) * i) / steps
    let r = at(y) + wall
    for (const b of bands) {
      const d = Math.abs(y - b) / (0.05 * k)
      if (d < 1) r += 0.022 * k * (1 - d * d)
    }
    pts.push([r, y])
    v.push(0.55 + (0.45 * i) / steps)
  }
  return { pts, v }
}

// capsule cone radius at a local capsule height
export const CAPSULE = { y0: 0.42, r0: 1.9, y1: 2.92, r1: 0.99 } as const
export function capsuleR(y: number): number {
  return CAPSULE.r0 + ((CAPSULE.r1 - CAPSULE.r0) * (y - CAPSULE.y0)) / (CAPSULE.y1 - CAPSULE.y0)
}
const CAPSULE_TILT = Math.atan((CAPSULE.r0 - CAPSULE.r1) / (CAPSULE.y1 - CAPSULE.y0))

// outer radius of whatever uses the hull atlas at a rocket height (the texture painter needs it
// to keep seams and text in proportion around the circumference)
export const TOWER_R = 0.255
export const FAIRING_TAPER = { y0: 0.5, y1: 2.57, r1: 1.985 } as const
export function hullRadiusAt(y: number): number {
  if (y < 2.52) return DIM.skirtR
  if (y < DIM.skirtTop) {
    const t = (y - 2.52) / (DIM.skirtTop - 2.52)
    return DIM.r + (DIM.skirtR - DIM.r) * (1 - t) * (1 - t)
  }
  if (y < DIM.stage2Top + FAIRING_TAPER.y0) return DIM.r
  if (y < DIM.capsuleBase) {
    const t = Math.min(1, (y - DIM.stage2Top - FAIRING_TAPER.y0) / (FAIRING_TAPER.y1 - FAIRING_TAPER.y0))
    return DIM.r - (DIM.r - FAIRING_TAPER.r1) * t * t
  }
  const c = y - DIM.capsuleBase
  if (c < 3.4) return capsuleR(Math.min(CAPSULE.y1, Math.max(CAPSULE.y0, c)))
  return TOWER_R
}

// ---------- geometry builders ----------

// lathe with a custom texture v per profile point; u runs around from +z towards +x
export function lathe(points: ProfilePoint[], segments: number, v: (p: ProfilePoint, i: number) => number): LatheGeometry {
  const geo = new LatheGeometry(points.map(([r, y]) => new Vector2(r, y)), segments)
  const uv = geo.attributes.uv
  const n = points.length
  for (let k = 0; k < uv.count; k++) uv.setY(k, v(points[k % n], k % n))
  return geo
}

// lathe on the hull atlas (v = height on the rocket)
function hullLathe(points: ProfilePoint[], yBase = 0, segments = 192): LatheGeometry {
  return lathe(points, segments, ([, y]) => hullV(y + yBase))
}

// lathe with uv in meters (u around the circumference, v up), for tiled materials
function meterLathe(points: ProfilePoint[], segments = 128): LatheGeometry {
  const geo = lathe(points, segments, ([, y]) => y)
  const rMean = points.reduce((s, [r]) => s + r, 0) / points.length
  const uv = geo.attributes.uv
  for (let k = 0; k < uv.count; k++) uv.setX(k, uv.getX(k) * TAU * rMean)
  return geo
}

// cylindrical hull uv for parts glued onto the hull
function hullUV<T extends BufferGeometry>(geo: T, yBase = 0): T {
  const pos = geo.attributes.position
  const uv = geo.attributes.uv
  for (let k = 0; k < pos.count; k++) {
    const a = Math.atan2(pos.getX(k), pos.getZ(k))
    uv.setXY(k, ((a / TAU) % 1 + 1) % 1, hullV(pos.getY(k) + yBase))
  }
  return geo
}

const m4 = new Matrix4()
const q = new Quaternion()
const UP = new Vector3(0, 1, 0)

// a rod between two points
function rod(a: Vector3, b: Vector3, r: number): CylinderGeometry {
  const d = new Vector3().subVectors(b, a)
  const geo = new CylinderGeometry(r, r, d.length(), 10, 1)
  q.setFromUnitVectors(UP, d.clone().normalize())
  geo.applyMatrix4(m4.compose(new Vector3().addVectors(a, b).multiplyScalar(0.5), q, new Vector3(1, 1, 1)))
  return geo
}

// places a part on the capsule cone: local +z becomes the surface normal at (azimuth, height)
function onCone(geo: BufferGeometry, az: number, y: number, lift: number): BufferGeometry {
  const r = capsuleR(y) + lift
  const tilt = new Matrix4().makeRotationX(-CAPSULE_TILT)
  const spin = new Matrix4().makeRotationY(az)
  geo.applyMatrix4(tilt).applyMatrix4(spin).translate(Math.sin(az) * r, y, Math.cos(az) * r)
  return geo
}

function roundedRect(w: number, h: number, c: number): Shape {
  const s = new Shape()
  const x = -w / 2
  const y = -h / 2
  s.moveTo(x + c, y)
  s.lineTo(x + w - c, y)
  s.quadraticCurveTo(x + w, y, x + w, y + c)
  s.lineTo(x + w, y + h - c)
  s.quadraticCurveTo(x + w, y + h, x + w - c, y + h)
  s.lineTo(x + c, y + h)
  s.quadraticCurveTo(x, y + h, x, y + h - c)
  s.lineTo(x, y + c)
  s.quadraticCurveTo(x, y, x + c, y)
  return s
}

// a metal joint ring standing proud of the hull
function jointRing(y: number, r = DIM.r, h = 0.16, out = 0.028): ProfilePoint[] {
  return [
    [r - 0.01, y - h / 2],
    [r + out * 0.6, y - h / 2],
    [r + out, y - h / 2 + 0.02],
    [r + out, y + h / 2 - 0.02],
    [r + out * 0.6, y + h / 2],
    [r - 0.01, y + h / 2],
  ]
}

function raceway(y0: number, y1: number): BufferGeometry {
  // cross-section: x tangential, y radial; extruded along the hull
  const s = new Shape()
  s.moveTo(-0.17, -0.04)
  s.lineTo(0.17, -0.04)
  s.lineTo(0.17, 0.05)
  s.quadraticCurveTo(0.16, 0.13, 0, 0.135)
  s.quadraticCurveTo(-0.16, 0.13, -0.17, 0.05)
  s.closePath()
  const geo = new ExtrudeGeometry(s, { depth: y1 - y0, bevelEnabled: false, curveSegments: 6 })
  geo.rotateX(-Math.PI / 2) // extrusion along +y, radial along -z
  geo.rotateY(RACEWAY_AZ + Math.PI) // radial towards the raceway azimuth
  const r = DIM.r - 0.01
  geo.translate(Math.sin(RACEWAY_AZ) * r, y0, Math.cos(RACEWAY_AZ) * r)
  return hullUV(geo)
}

function fin(): BufferGeometry {
  // planform: x out from the root, y up; swept leading edge, raked tip
  const s = new Shape()
  s.moveTo(0, 2.5)
  s.lineTo(0, 10.4)
  s.lineTo(2.15, 4.3)
  s.lineTo(2.28, 1.35)
  s.lineTo(1.1, 1.9)
  s.closePath()
  const depth = 0.08
  const geo = new ExtrudeGeometry(s, { depth, bevelEnabled: true, bevelThickness: 0.05, bevelSize: 0.045, bevelSegments: 3, curveSegments: 1 })
  geo.translate(0, 0, -depth / 2)
  return geo
}

export interface RocketGeometry {
  hull: BufferGeometry // skirt, stage 1, stage 2 (hull atlas)
  raceways: BufferGeometry // cable tunnels (hull atlas)
  interstage: BufferGeometry // carbon, meter uv
  fins: BufferGeometry // carbon, meter uv
  rings: BufferGeometry // metal joint rings
  baseShield: BufferGeometry // engine heat shield plate with five holes
  boots: BufferGeometry // gimbal boots around the bells
  bells: BufferGeometry // all five nozzle bells (nozzle uv)
  fairing: BufferGeometry // adapter shell, local to the fairing group (hull atlas)
  capsule: {
    shield: BufferGeometry
    body: BufferGeometry // hull atlas
    tower: BufferGeometry // escape motor and nose (hull atlas)
    struts: BufferGeometry // metal
    abortBells: BufferGeometry // nozzle uv
    windows: BufferGeometry
    frames: BufferGeometry
    pods: BufferGeometry // rcs thruster pods, carbon
    decal: BufferGeometry // logo patch on the cone, plain 0..1 uv
  }
}

// the capsule logo patch: height in meters, logo aspect (width / height)
export const DECAL = { y: 1.18, h: 0.26, aspect: 7.6 } as const

export function buildRocketGeometry(): RocketGeometry {
  const { r } = DIM

  // aft skirt: rolled lip, then a concave flare into the tank wall
  const skirt = profile(
    [
      [2.56, 2.47],
      [2.6, 2.41],
      [2.625, 2.45],
    ],
    curve(2.52, DIM.skirtTop, 14, (t) => r + (DIM.skirtR - r) * (1 - t) * (1 - t)),
  )
  const stage1 = groovedWall(r, DIM.skirtTop, DIM.stage1Top, [12.05, 17.1, 22.15])
  const stage2 = groovedWall(r, DIM.interTop, DIM.stage2Top, [35.5])
  const hull = mergeGeometries([hullLathe(profile(skirt, stage1)), hullLathe(stage2)])!

  const raceways = mergeGeometries([raceway(7.5, 26.9), raceway(31.75, 39.3)])!

  const interstage = meterLathe([
    [r - 0.02, DIM.stage1Top],
    [r + 0.012, DIM.stage1Top + 0.02],
    [r + 0.012, DIM.interTop - 0.02],
    [r - 0.02, DIM.interTop],
  ])

  const rings = mergeGeometries(
    [DIM.skirtTop, DIM.stage1Top, DIM.interTop, DIM.stage2Top].map((y) => lathe(jointRing(y), 128, ([, py]) => py)),
  )!

  const finGeo = fin()
  const fins = mergeGeometries(
    FIN_AZIMUTHS.map((az) => finGeo.clone().translate(r - 0.1, 0, 0).rotateY(az - Math.PI / 2)),
  )!

  // heat shield plate under the skirt with a hole per engine
  const plate = new Shape()
  plate.absarc(0, 0, DIM.skirtR - 0.03, 0, TAU, false)
  for (const n of NOZZLES) {
    const hole = new Path()
    hole.absarc(n.x, n.z, bellRadius(n, DIM.shieldY) + 0.02, 0, TAU, true)
    plate.holes.push(hole)
  }
  const baseShield = new ShapeGeometry(plate, 48)
  baseShield.rotateX(Math.PI / 2) // normal faces down, shape y becomes world z
  baseShield.translate(0, DIM.shieldY, 0)

  // flexible boots where the bells disappear into the plate
  const boots = mergeGeometries(
    NOZZLES.map((n) =>
      lathe(
        [
          [bellRadius(n, 2.18) + 0.03, 2.18],
          [bellRadius(n, 2.24) + 0.055, 2.24],
          [bellRadius(n, 2.33) + 0.045, 2.33],
          [bellRadius(n, DIM.shieldY) + 0.04, DIM.shieldY + 0.01],
        ],
        48,
        ([, y]) => y,
      ).translate(n.x, 0, n.z),
    ),
  )!

  const bells = mergeGeometries(
    NOZZLES.map((n) => {
      const { pts, v } = bellProfile(n)
      return lathe(pts, 72, (_, i) => v[i]).translate(n.x, 0, n.z)
    }),
  )!

  // adapter fairing, local to its group at stage2Top: cylinder with a pyro groove, then an ogive taper
  const fairingTop = DIM.capsuleBase - DIM.stage2Top
  const fairing = hullLathe(
    profile(
      groovedWall(r, 0, 0.5, [0.24]),
      curve(FAIRING_TAPER.y0, FAIRING_TAPER.y1, 12, (t) => r - (r - FAIRING_TAPER.r1) * t * t),
      [
        [1.97, fairingTop],
        [1.6, fairingTop],
      ],
    ),
    DIM.stage2Top,
  )

  return { hull, raceways, interstage, fins, rings, baseShield, boots, bells, fairing, capsule: buildCapsule() }
}

function buildCapsule(): RocketGeometry['capsule'] {
  const base = DIM.capsuleBase

  // ablative heat shield: shallow dome underneath, rounded rim
  const shield = lathe(
    [
      [0, 0],
      [1.2, 0.03],
      [1.7, 0.07],
      [1.92, 0.12],
      [1.995, 0.19],
      [2.0, 0.24],
      [1.98, 0.3],
      [1.93, 0.34],
      [1.88, 0.35],
    ],
    128,
    ([rr]) => rr / 2,
  )

  const body = hullLathe(
    profile(
      [
        [1.9, 0.33],
        [CAPSULE.r0, CAPSULE.y0],
      ],
      curve(CAPSULE.y0, CAPSULE.y1, 8, (t) => CAPSULE.r0 + (CAPSULE.r1 - CAPSULE.r0) * t),
      [
        [0.955, 3.0],
        [0.89, 3.07],
        [0.78, 3.11],
        [0.6, 3.13],
        [0, 3.135],
      ],
    ),
    base,
    160,
  )

  // escape tower: motor with a nose ogive and a pitot spike, on four struts
  const tower = hullLathe(
    profile(
      [
        [0, 3.86],
        [0.19, 3.87],
        [0.25, 3.92],
      ],
      groovedWall(TOWER_R, 3.95, 4.95, [4.42], 0.008, 0.02),
      curve(4.95, 5.6, 10, (t) => TOWER_R * Math.cos(t * Math.PI * 0.5) + 0.02 * t),
      [[0, 5.62]],
    ),
    base,
    64,
  )
  const strutParts: BufferGeometry[] = []
  for (let k = 0; k < 4; k++) {
    const az = (k + 0.5) * (Math.PI / 2)
    const dir = new Vector3(Math.sin(az), 0, Math.cos(az))
    strutParts.push(rod(dir.clone().multiplyScalar(0.5).setY(3.1), dir.clone().multiplyScalar(0.15).setY(3.92), 0.035))
  }
  strutParts.push(rod(new Vector3(0, 5.55, 0), new Vector3(0, 5.8, 0), 0.016))
  const struts = mergeGeometries(strutParts)!

  // abort motor nozzles: four small bells canted out of the top of the motor, under the nose
  const small: NozzleSpec = { x: 0, z: 0, exitR: 0.075, throatR: 0.035 }
  const { pts, v } = bellProfile(small, 0.2, 0.008)
  const abortParts: BufferGeometry[] = []
  for (let k = 0; k < 4; k++) {
    const az = k * (Math.PI / 2)
    const g = lathe(pts, 24, (_, i) => v[i])
    g.translate(0, -0.2, 0) // throat at the origin
    g.rotateZ(0.5) // cant the exhaust outwards (towards +x)
    g.rotateY(az - Math.PI / 2)
    g.translate(Math.sin(az) * 0.18, 4.88, Math.cos(az) * 0.18)
    abortParts.push(g)
  }
  const abortBells = mergeGeometries(abortParts)!

  // two windows on the front: glass sunk under a ring frame
  const winShape = roundedRect(0.36, 0.46, 0.1)
  const frameShape = roundedRect(0.46, 0.56, 0.14)
  frameShape.holes.push(roundedRect(0.32, 0.42, 0.08))
  const winParts: BufferGeometry[] = []
  const frameParts: BufferGeometry[] = []
  for (const az of [-0.27, 0.27]) {
    const w = new ExtrudeGeometry(winShape, { depth: 0.005, bevelEnabled: true, bevelThickness: 0.004, bevelSize: 0.004, bevelSegments: 1, curveSegments: 6 })
    winParts.push(onCone(w, az, 1.95, 0.002))
    const f = new ExtrudeGeometry(frameShape, { depth: 0.012, bevelEnabled: true, bevelThickness: 0.012, bevelSize: 0.01, bevelSegments: 2, curveSegments: 6 })
    frameParts.push(onCone(f, az, 1.95, -0.008))
  }
  const windows = mergeGeometries(winParts)!
  const frames = mergeGeometries(frameParts)!

  const pods = mergeGeometries(
    [0.25, 0.75, 1.25, 1.75].map((k) => onCone(new BoxGeometry(0.2, 0.26, 0.11), k * Math.PI, 2.5, 0.02)),
  )!

  // logo patch: a slice of the cone just above the surface, facing +z
  const yb = DECAL.y - DECAL.h / 2
  const yt = DECAL.y + DECAL.h / 2
  const arc = (DECAL.h * DECAL.aspect) / capsuleR(DECAL.y)
  const decal = new CylinderGeometry(capsuleR(yt) + 0.004, capsuleR(yb) + 0.004, DECAL.h, 64, 1, true, -arc / 2, arc)
  decal.translate(0, DECAL.y, 0)

  return { shield, body, tower, struts, abortBells, windows, frames, pods, decal }
}

// height of the highest point (capsule spike tip) in rocket space
export function rocketTop(geo: RocketGeometry): number {
  geo.capsule.struts.computeBoundingBox()
  return DIM.capsuleBase + geo.capsule.struts.boundingBox!.max.y
}
