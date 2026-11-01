import { useFrame } from '@react-three/fiber'
import { useEffect, useLayoutEffect, useMemo, useRef } from 'react'
import {
  BoxGeometry,
  Color,
  InstancedMesh,
  Matrix4,
  MeshBasicMaterial,
  MeshStandardMaterial,
  Quaternion,
  SphereGeometry,
  Vector3,
  type Group,
} from 'three'
import { useGame } from '../../game/store'
import { envLit } from '../env/envSync'
import { QUALITY } from '../quality'
import { rig } from '../rig'
import { ARM_SWING, armFrame, ARMS, GROUND_Y, TOWER } from './layout'

// the service tower: a square steel lattice (instanced beams) with swing arms to the rocket that move away
// during the countdown and back in for the next round, red obstruction beacons and warm work lights

const UP = new Vector3(0, 1, 0)
const MAST_TOP = TOWER.top + 17 // lightning mast over the roof
const ARM_W = 1.1 // half width of an arm truss
const ARM_H = 2.6

const smoothstep = (e0: number, e1: number, x: number) => {
  const t = Math.min(1, Math.max(0, (x - e0) / (e1 - e0)))
  return t * t * (3 - 2 * t)
}

// a beam of square section w x d from a to b, as a transform of the unit box
function bar(out: Matrix4[], a: Vector3, b: Vector3, w: number, d = w) {
  const dir = new Vector3().subVectors(b, a)
  const len = dir.length()
  const q = new Quaternion().setFromUnitVectors(UP, dir.divideScalar(len))
  out.push(new Matrix4().compose(new Vector3().addVectors(a, b).multiplyScalar(0.5), q, new Vector3(w, len, d)))
}

// a flat slab centered at c
function slab(out: Matrix4[], c: Vector3, sx: number, sy: number, sz: number) {
  out.push(new Matrix4().compose(c, new Quaternion(), new Vector3(sx, sy, sz)))
}

const P = (x: number, y: number, z: number) => new Vector3(x, y, z)

// the lattice in pad space
function towerBeams(): Matrix4[] {
  const out: Matrix4[] = []
  const { x: cx, z: cz, half: h, top } = TOWER
  const levels = Math.max(4, Math.round((top - GROUND_Y) / QUALITY.towerBay))
  const dy = (top - GROUND_Y) / levels
  const corners: [number, number][] = [
    [-h, -h],
    [h, -h],
    [h, h],
    [-h, h],
  ]
  for (const [x, z] of corners) bar(out, P(cx + x, GROUND_Y, cz + z), P(cx + x, top + 0.4, cz + z), 0.62)
  const armLevels = new Set(ARMS.map((a) => Math.round((a.y - GROUND_Y) / dy)))
  for (let k = 0; k < levels; k++) {
    const y0 = GROUND_Y + k * dy
    const y1 = y0 + dy
    for (let i = 0; i < 4; i++) {
      const [ax, az] = corners[i]
      const [bx, bz] = corners[(i + 1) % 4]
      bar(out, P(cx + ax, y1, cz + az), P(cx + bx, y1, cz + bz), 0.36)
      // x bracing on every face
      bar(out, P(cx + ax, y0, cz + az), P(cx + bx, y1, cz + bz), 0.2)
      bar(out, P(cx + bx, y0, cz + bz), P(cx + ax, y1, cz + az), 0.2)
    }
    // floors at the arms, every fourth level and the roof
    if (armLevels.has(k + 1) || (k + 1) % 4 === 0 || k + 1 === levels) slab(out, P(cx, y1 + 0.1, cz), 2 * h, 0.16, 2 * h)
  }
  // stair and elevator core in the back corner
  const coreH = top - GROUND_Y
  slab(out, P(cx - h + 1.7, GROUND_Y + coreH / 2, cz - h + 1.7), 2.6, coreH, 2.6)
  // a riser pipe up the face towards the rocket
  bar(out, P(cx + h + 0.45, GROUND_Y, cz - h + 0.9), P(cx + h + 0.45, top, cz - h + 0.9), 0.5)
  // lightning mast and its stays
  bar(out, P(cx, top, cz), P(cx, MAST_TOP, cz), 0.32)
  for (const [x, z] of corners) bar(out, P(cx + x * 0.9, top + 0.3, cz + z * 0.9), P(cx, top + 8, cz), 0.12)
  return out
}

// an arm truss in arm space: along +x from the hinge, floor at y = 0, width along z
function armBeams(len: number): Matrix4[] {
  const out: Matrix4[] = []
  const w = ARM_W
  for (const y of [0, ARM_H]) for (const z of [-w, w]) bar(out, P(0, y, z), P(len, y, z), 0.24)
  const stations = Math.max(2, Math.round(len / 1.8))
  for (let i = 0; i <= stations; i++) {
    const x = (len * i) / stations
    for (const z of [-w, w]) bar(out, P(x, 0, z), P(x, ARM_H, z), 0.16)
    bar(out, P(x, ARM_H, -w), P(x, ARM_H, w), 0.14)
    bar(out, P(x, 0, -w), P(x, 0, w), 0.14)
    if (i < stations) {
      const x1 = (len * (i + 1)) / stations
      for (const z of [-w, w]) bar(out, P(x, i % 2 ? 0 : ARM_H, z), P(x1, i % 2 ? ARM_H : 0, z), 0.12)
    }
  }
  return out
}

interface ArmBuild {
  hinge: Vector3
  yaw: number // pointing at the rocket
  away: number // swung away
  len: number
  beams: Matrix4[]
  crew: boolean
}

function buildArms(): ArmBuild[] {
  return ARMS.map((a) => {
    const { hinge, yaw, away, len } = armFrame(a)
    return { hinge, yaw, away, len, beams: armBeams(len), crew: a.kind === 'crew' }
  })
}

const BEACON_RED = new Color(1, 0.06, 0.03)
const BEACON_I = 26 // hdr at the flash peak
const WORK_LIGHT = new Color(1, 0.78, 0.52).multiplyScalar(7)

function instanced(geo: BoxGeometry | SphereGeometry, mat: MeshStandardMaterial | MeshBasicMaterial, mats: Matrix4[], shadows: boolean) {
  const mesh = new InstancedMesh(geo, mat, mats.length)
  mats.forEach((m, i) => mesh.setMatrixAt(i, m))
  mesh.instanceMatrix.needsUpdate = true
  mesh.castShadow = shadows
  mesh.receiveShadow = shadows
  mesh.computeBoundingSphere()
  return mesh
}

export function Tower() {
  const built = useMemo(() => {
    const unit = new BoxGeometry(1, 1, 1)
    const steel = new MeshStandardMaterial({ color: new Color(0.17, 0.17, 0.175), roughness: 0.62, metalness: 0.3, envMapIntensity: 0.3 })
    const panel = new MeshStandardMaterial({ color: new Color(0.42, 0.42, 0.41), roughness: 0.5, metalness: 0.1, envMapIntensity: 0.3 })
    const lit = new MeshBasicMaterial({ color: WORK_LIGHT })
    const beacon = new MeshBasicMaterial({ color: BEACON_RED.clone().multiplyScalar(BEACON_I) })
    const lattice = instanced(unit, steel, towerBeams(), true)
    const arms = buildArms().map((a) => {
      const truss = instanced(unit, steel, a.beams, true)
      // the crew arm is an enclosed walkway with a white room at its end; umbilical arms carry hoses
      const extras: Matrix4[] = []
      const windows: Matrix4[] = []
      if (a.crew) {
        slab(extras, P(a.len / 2 - 0.6, ARM_H / 2, 0), a.len - 2.6, ARM_H - 0.3, 2 * ARM_W - 0.3)
        slab(extras, P(a.len - 1.3, ARM_H / 2 + 0.2, 0), 2.4, ARM_H + 0.9, 2 * ARM_W + 0.7)
        for (let x = 1.2; x < a.len - 2.8; x += 1.6) for (const z of [-1, 1]) slab(windows, P(x, ARM_H * 0.62, z * (ARM_W - 0.12)), 0.9, 0.34, 0.06)
      } else {
        for (const z of [-0.45, 0.1, 0.55]) bar(extras, P(a.len - 0.2, 0.2, z), P(a.len + 0.12, -2.2, z * 0.6), 0.22)
        slab(extras, P(a.len - 0.1, -0.2, 0), 0.4, 1.2, 1.6)
      }
      return {
        ...a,
        truss,
        panels: extras.length ? instanced(unit, panel, extras, true) : null,
        windows: windows.length ? instanced(unit, lit, windows, false) : null,
      }
    })
    // beacons: roof corners, the lightning mast and half way up; work lights on the floors facing the pad
    const { x: cx, z: cz, half: h, top } = TOWER
    const beacons: Matrix4[] = []
    const ball = (x: number, y: number, z: number, s: number) => slab(beacons, P(x, y, z), s, s, s)
    for (const [x, z] of [[-h, -h], [h, -h], [h, h], [-h, h]]) {
      ball(cx + x, top + 0.8, cz + z, 0.55)
      ball(cx + x, GROUND_Y + (top - GROUND_Y) * 0.55, cz + z, 0.45)
    }
    ball(cx, MAST_TOP + 0.3, cz, 0.7)
    const work: Matrix4[] = []
    for (let y = GROUND_Y + 8; y < top; y += 8) {
      for (const z of [-h + 1.2, h - 1.2]) slab(work, P(cx + h + 0.15, y + 2.2, cz + z), 0.12, 0.4, 0.9)
      slab(work, P(cx + h - 2, y + 2.2, cz + h + 0.15), 0.9, 0.4, 0.12)
    }
    const sphere = new SphereGeometry(0.5, 12, 8)
    return {
      unit,
      sphere,
      materials: [steel, panel, lit, beacon],
      beacon,
      lattice,
      arms,
      beacons: instanced(sphere, beacon, beacons, false),
      work: instanced(unit, lit, work, false),
    }
  }, [])

  useEffect(() => {
    const lit = [built.materials[0], built.materials[1]] as MeshStandardMaterial[]
    for (const m of lit) envLit.add(m)
    return () => {
      for (const m of lit) envLit.delete(m)
      built.unit.dispose()
      built.sphere.dispose()
      for (const m of built.materials) m.dispose()
    }
  }, [built])

  const pivots = useRef<(Group | null)[]>([])
  const swing = useRef({ away: [0, 0, 0], seenRound: false })

  useLayoutEffect(() => {
    built.arms.forEach((a, i) => {
      const g = pivots.current[i]
      if (g) g.rotation.y = a.yaw
    })
  }, [built])

  useFrame((_, delta) => {
    const snap = useGame.getState().snap
    const s = swing.current
    const t = rig.vtime
    // aviation flash: short and bright about once a second
    const flash = Math.pow(Math.max(0, Math.sin(t * Math.PI * 0.9)), 10)
    built.beacon.color.copy(BEACON_RED).multiplyScalar(0.25 + BEACON_I * flash)
    if (snap.phase !== 'betting') s.seenRound = true
    built.arms.forEach((a, i) => {
      let u: number
      if (snap.phase === 'countdown') u = smoothstep(ARMS[i].start, ARMS[i].start + ARM_SWING, snap.phaseAge)
      else if (snap.phase === 'betting') u = s.seenRound ? Math.min(s.away[i], 1 - smoothstep(0.8, 3.2, snap.phaseAge)) : 0
      else u = 1
      // a cut between rounds can skip frames: never jump more than a swing per frame
      const max = Math.min(1, delta * 3)
      s.away[i] += Math.max(-max, Math.min(max, u - s.away[i]))
      if (snap.phase === 'countdown') s.away[i] = u
      const g = pivots.current[i]
      if (g) g.rotation.y = a.yaw + (a.away - a.yaw) * s.away[i]
    })
  })

  return (
    <group name="tower">
      <primitive object={built.lattice} />
      <primitive object={built.beacons} />
      <primitive object={built.work} />
      {built.arms.map((a, i) => (
        <group
          key={i}
          position={a.hinge}
          ref={(g) => {
            pivots.current[i] = g
          }}
        >
          <primitive object={a.truss} />
          {a.panels && <primitive object={a.panels} />}
          {a.windows && <primitive object={a.windows} />}
        </group>
      ))}
    </group>
  )
}
