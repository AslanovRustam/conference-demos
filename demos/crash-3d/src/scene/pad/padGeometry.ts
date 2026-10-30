import { BoxGeometry, BufferAttribute, BufferGeometry, CylinderGeometry, ExtrudeGeometry, Path, Shape, ShapeGeometry, TorusGeometry } from 'three'
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js'
import {
  CLAMP_AZ,
  CLAMP_TOP,
  DECK_HALF,
  DECK_HOLE_R,
  DECK_THICK,
  DEFLECTOR_TOP,
  GROUND_R,
  GROUND_Y,
  HARDSTAND_R,
  LEG_AT,
  LEG_HALF,
  TOWER,
  TRENCH_EXIT,
  TRENCH_FLOOR_Y,
  TRENCH_HALF_W,
  TRENCH_RAMP,
} from './layout'
import { CONCRETE_TILE_M, HARDSTAND_SPAN, SOIL_TILE_M } from './padTextures'

// static pad geometry in pad space (see layout.ts). flat parts are built in the shape xy plane and laid down with
// rotateX(-pi/2), which maps shape (x, y) to (x, -z)

const TAU = Math.PI * 2
const APRON_SEGMENTS = 192 // the apron rim and the inner edge of the ground share these vertices
const CURB_W = 1.2 // trench walls stick out of the hardstand as a curb this wide
const CURB_H = 0.3

const rimPoint = (i: number, r: number): [number, number] => {
  const a = (i / APRON_SEGMENTS) * TAU
  return [Math.cos(a) * r, Math.sin(a) * r]
}

// the round concrete apron with the trench opening cut out; uv over the whole hardstand atlas
export function hardstandGeometry(): BufferGeometry {
  const shape = new Shape()
  for (let i = 0; i < APRON_SEGMENTS; i++) {
    const [x, y] = rimPoint(i, HARDSTAND_R)
    if (i === 0) shape.moveTo(x, y)
    else shape.lineTo(x, y)
  }
  shape.closePath()
  const hx = TRENCH_HALF_W + CURB_W
  const hole = new Path()
  hole.moveTo(-hx, -TRENCH_EXIT)
  hole.lineTo(-hx, TRENCH_EXIT)
  hole.lineTo(hx, TRENCH_EXIT)
  hole.lineTo(hx, -TRENCH_EXIT)
  hole.closePath()
  shape.holes.push(hole)
  const geo = new ShapeGeometry(shape)
  const pos = geo.attributes.position
  const uv = geo.attributes.uv
  for (let i = 0; i < pos.count; i++) uv.setXY(i, pos.getX(i) / HARDSTAND_SPAN + 0.5, pos.getY(i) / HARDSTAND_SPAN + 0.5)
  geo.rotateX(-Math.PI / 2)
  geo.translate(0, GROUND_Y, 0)
  return geo
}

// the land around the apron out to the horizon: rings spaced wider with distance, darkening with it
// (vertex color), soil tile uv in meters
export function groundGeometry(): BufferGeometry {
  const rings = 48
  const verts: number[] = []
  const uvs: number[] = []
  const colors: number[] = []
  const index: number[] = []
  for (let j = 0; j <= rings; j++) {
    const r = HARDSTAND_R * Math.pow(GROUND_R / HARDSTAND_R, j / rings)
    // lit by the pad near it, black at the horizon
    const k = 1 / (1 + Math.pow((r - HARDSTAND_R) / 900, 2))
    for (let i = 0; i < APRON_SEGMENTS; i++) {
      const [x, y] = rimPoint(i, r)
      verts.push(x, GROUND_Y, -y)
      uvs.push(x / SOIL_TILE_M, y / SOIL_TILE_M)
      colors.push(k, k, k)
    }
  }
  for (let j = 0; j < rings; j++) {
    for (let i = 0; i < APRON_SEGMENTS; i++) {
      const a = j * APRON_SEGMENTS + i
      const b = j * APRON_SEGMENTS + ((i + 1) % APRON_SEGMENTS)
      const c = a + APRON_SEGMENTS
      const d = b + APRON_SEGMENTS
      index.push(a, c, b, b, c, d)
    }
  }
  const geo = new BufferGeometry()
  geo.setAttribute('position', new BufferAttribute(new Float32Array(verts), 3))
  geo.setAttribute('uv', new BufferAttribute(new Float32Array(uvs), 2))
  geo.setAttribute('color', new BufferAttribute(new Float32Array(colors), 3))
  geo.setIndex(index)
  geo.computeVertexNormals()
  return geo
}

// the launch mount table: material group 0 is the deck (top and bottom, uv over the deck atlas),
// group 1 the sides and the opening (concrete tile uv)
export function tableGeometry(): BufferGeometry {
  const shape = new Shape()
  shape.moveTo(-DECK_HALF, -DECK_HALF)
  shape.lineTo(DECK_HALF, -DECK_HALF)
  shape.lineTo(DECK_HALF, DECK_HALF)
  shape.lineTo(-DECK_HALF, DECK_HALF)
  shape.closePath()
  const hole = new Path()
  hole.absarc(0, 0, DECK_HOLE_R, 0, TAU, true)
  shape.holes.push(hole)
  const geo = new ExtrudeGeometry(shape, { depth: DECK_THICK, bevelEnabled: false, curveSegments: 64 })
  const uv = geo.attributes.uv
  const caps = geo.groups[0]
  for (let i = 0; i < uv.count; i++) {
    const inCaps = i >= caps.start && i < caps.start + caps.count
    if (inCaps) uv.setXY(i, (uv.getX(i) + DECK_HALF) / (2 * DECK_HALF), (uv.getY(i) + DECK_HALF) / (2 * DECK_HALF))
    else uv.setXY(i, uv.getX(i) / CONCRETE_TILE_M, uv.getY(i) / CONCRETE_TILE_M)
  }
  geo.rotateX(-Math.PI / 2)
  geo.translate(0, -DECK_THICK, 0)
  return geo
}

// box with concrete uv in meters on every face
function concreteBox(w: number, h: number, d: number, x: number, y: number, z: number): BufferGeometry {
  const geo = new BoxGeometry(w, h, d)
  const uv = geo.attributes.uv
  const n = geo.attributes.normal
  for (let i = 0; i < uv.count; i++) {
    const ax = Math.abs(n.getX(i))
    const ay = Math.abs(n.getY(i))
    const su = ax > 0.5 ? d : w
    const sv = ay > 0.5 ? d : h
    uv.setXY(i, (uv.getX(i) * su) / CONCRETE_TILE_M, (uv.getY(i) * sv) / CONCRETE_TILE_M)
  }
  return geo.translate(x, y, z)
}

// legs of the mount, the trench walls with their curbs, the tower foundation
export function concreteGeometry(): BufferGeometry {
  const parts: BufferGeometry[] = []
  const legTop = -DECK_THICK
  const legH = legTop - GROUND_Y
  for (const sx of [-1, 1]) {
    for (const sz of [-1, 1]) parts.push(concreteBox(2 * LEG_HALF, legH, 2 * LEG_HALF, sx * LEG_AT, GROUND_Y + legH / 2, sz * LEG_AT))
  }
  // tower foundation
  const fh = 1.2
  parts.push(concreteBox(2 * TOWER.half + 3, fh, 2 * TOWER.half + 3, TOWER.x, GROUND_Y + fh / 2 - 0.4, TOWER.z))
  const geo = mergeGeometries(parts)!
  for (const p of parts) p.dispose()
  return geo
}

// floor of the flame trench: a wedge deflector under the engines, flat runs and ramps up to both exits.
// profile in the shape plane as (z, y), extruded across the trench along x
export function trenchGeometry(): BufferGeometry {
  const s = new Shape()
  const run = TRENCH_EXIT - TRENCH_RAMP
  s.moveTo(-TRENCH_EXIT, GROUND_Y)
  s.lineTo(-run, TRENCH_FLOOR_Y)
  s.lineTo(-7, TRENCH_FLOOR_Y)
  s.lineTo(0, DEFLECTOR_TOP)
  s.lineTo(7, TRENCH_FLOOR_Y)
  s.lineTo(run, TRENCH_FLOOR_Y)
  s.lineTo(TRENCH_EXIT, GROUND_Y)
  s.lineTo(TRENCH_EXIT, TRENCH_FLOOR_Y - 2)
  s.lineTo(-TRENCH_EXIT, TRENCH_FLOOR_Y - 2)
  s.closePath()
  const floor = new ExtrudeGeometry(s, { depth: 2 * TRENCH_HALF_W, bevelEnabled: false })
  const uv = floor.attributes.uv
  for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) / CONCRETE_TILE_M, uv.getY(i) / CONCRETE_TILE_M)
  // shape (z, y, x) -> pad (x, y, z)
  floor.rotateY(Math.PI / 2)
  floor.translate(-TRENCH_HALF_W, 0, 0)
  floor.clearGroups()
  // the walls rise a little above the apron as a curb
  const wallBottom = TRENCH_FLOOR_Y - 2
  const wallH = GROUND_Y + CURB_H - wallBottom
  const parts: BufferGeometry[] = [floor]
  for (const side of [-1, 1]) {
    parts.push(concreteBox(CURB_W, wallH, 2 * TRENCH_EXIT, side * (TRENCH_HALF_W + CURB_W / 2), wallBottom + wallH / 2, 0).toNonIndexed())
  }
  const geo = mergeGeometries(parts)!
  floor.dispose()
  return geo
}

// steel on the deck: hold-down clamps between the fins, the water deluge ring around the opening with its
// sprinkler heads, and pipe runs over to the tower
export function steelGeometry(): BufferGeometry {
  const parts: BufferGeometry[] = []
  for (const az of CLAMP_AZ) {
    const post = new BoxGeometry(1.5, CLAMP_TOP + 0.3, 1.2).translate(0, (CLAMP_TOP + 0.3) / 2, 6.1)
    const armLen = 6.6 - 2.42
    const arm = new BoxGeometry(0.72, 0.62, armLen).translate(0, CLAMP_TOP - 0.31, 2.42 + armLen / 2)
    const brace = new BoxGeometry(0.4, 1.9, 0.4).rotateX(0.62).translate(0, 1.1, 5.3)
    for (const g of [post, arm, brace]) parts.push(g.rotateY(az))
  }
  parts.push(new TorusGeometry(DECK_HOLE_R + 0.7, 0.2, 8, 96).rotateX(Math.PI / 2).translate(0, 0.22, 0))
  for (let i = 0; i < 12; i++) {
    const a = ((i + 0.5) / 12) * TAU
    const r = DECK_HOLE_R + 0.7
    parts.push(new CylinderGeometry(0.12, 0.16, 0.7, 8).translate(Math.cos(a) * r, 0.55, Math.sin(a) * r))
  }
  // a handrail around the deck edge
  const e = DECK_HALF - 0.2
  for (const s of [-1, 1]) {
    for (const h of [0.55, 1.1]) {
      parts.push(new BoxGeometry(2 * e, 0.06, 0.06).translate(0, h, s * e))
      parts.push(new BoxGeometry(0.06, 0.06, 2 * e).translate(s * e, h, 0))
    }
    for (let k = -e; k <= e + 1e-6; k += (2 * e) / 10) {
      parts.push(new BoxGeometry(0.08, 1.1, 0.08).translate(k, 0.55, s * e))
      parts.push(new BoxGeometry(0.08, 1.1, 0.08).translate(s * e, 0.55, k))
    }
  }
  // pipes from the deck edge over to the tower foundation
  const x0 = -DECK_HALF + 0.5
  const x1 = TOWER.x
  for (const [z, r] of [[-1.4, 0.32], [-0.6, 0.22], [0.2, 0.26]] as const) {
    parts.push(new CylinderGeometry(r, r, x0 - x1, 10).rotateZ(Math.PI / 2).translate((x0 + x1) / 2, -0.6, z))
  }
  const geo = mergeGeometries(parts.map((p) => p.toNonIndexed()))!
  for (const p of parts) p.dispose()
  return geo
}
