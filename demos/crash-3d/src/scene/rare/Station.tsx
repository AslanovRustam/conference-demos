import { brandColors } from '@brand/tokens'
import { useFrame } from '@react-three/fiber'
import { useEffect, useMemo, useRef } from 'react'
import {
  BoxGeometry,
  CanvasTexture,
  Color,
  CylinderGeometry,
  Group,
  InstancedMesh,
  Matrix4,
  Mesh,
  MeshBasicMaterial,
  MeshStandardMaterial,
  Quaternion,
  SphereGeometry,
  SRGBColorSpace,
  Vector3,
  type BufferGeometry,
  type Material,
} from 'three'
import { shotFrame } from '../camera/shotFrame'
import { lightState } from '../env/lightState'
import { registerPrewarm } from '../prewarm'
import { rig } from '../rig'
import { rareShow } from './rareState'

// the flyby: beyond the rocket along the shot, the rocket climbs past it while it drifts across the frame
const BEYOND = 300 // metres past the rocket, along the shot's forward
const RISE = 260 // starts this far above the look point, ends as far below
const CROSS = 140 // and from this far to one side to as far to the other
const LOOK_Y = 20 // the chase camera's look point above the rocket's base

const TRUSS_L = 104
const TRUSS_W = 2.6
const WING_L = 30 // each array, out from the truss
const WING_W = 11
const MODULE_R = 2.1

// solar array: deep blue cells in a silver grid, gold kapton at the root
function cellTexture(): CanvasTexture {
  const c = document.createElement('canvas')
  c.width = 256
  c.height = 512
  const g = c.getContext('2d')!
  g.fillStyle = '#9aa3ad'
  g.fillRect(0, 0, c.width, c.height)
  const cols = 8
  const rows = 24
  const cw = c.width / cols
  const ch = (c.height - 24) / rows
  for (let y = 0; y < rows; y++) {
    for (let x = 0; x < cols; x++) {
      const l = 18 + ((x * 7 + y * 13) % 9)
      g.fillStyle = `hsl(222, 62%, ${l}%)`
      g.fillRect(x * cw + 1.5, 24 + y * ch + 1.5, cw - 3, ch - 3)
    }
  }
  g.fillStyle = '#c8962e'
  g.fillRect(0, 0, c.width, 22)
  const t = new CanvasTexture(c)
  t.colorSpace = SRGBColorSpace
  t.anisotropy = 8
  return t
}

// thermal blankets: off-white panels with seams
function blanketTexture(): CanvasTexture {
  const c = document.createElement('canvas')
  c.width = 256
  c.height = 256
  const g = c.getContext('2d')!
  g.fillStyle = '#e4e1d9'
  g.fillRect(0, 0, 256, 256)
  for (let i = 0; i < 40; i++) {
    g.fillStyle = `rgba(${150 + (i % 3) * 20}, ${150 + (i % 5) * 12}, 140, 0.12)`
    g.fillRect((i * 53) % 256, (i * 97) % 256, 24 + (i % 4) * 10, 18 + (i % 3) * 12)
  }
  g.strokeStyle = 'rgba(90, 90, 90, 0.5)'
  g.lineWidth = 2
  for (let x = 0; x <= 256; x += 64) g.strokeRect(x, 0, 0, 256)
  for (let y = 0; y <= 256; y += 85) g.strokeRect(0, y, 256, 0)
  const t = new CanvasTexture(c)
  t.colorSpace = SRGBColorSpace
  return t
}

interface Built {
  root: Group
  lights: { mat: MeshBasicMaterial; color: Color; blink: (t: number) => number }[]
  wings: { gimbal: Group; panel: MeshStandardMaterial }[]
  dispose(): void
}

function build(): Built {
  const geos: BufferGeometry[] = []
  const mats: Material[] = []
  const texs: CanvasTexture[] = []
  const keep = <T extends BufferGeometry>(g: T) => (geos.push(g), g)
  const keepM = <T extends Material>(m: T) => (mats.push(m), m)

  const cells = cellTexture()
  const blanket = blanketTexture()
  texs.push(cells, blanket)
  const metal = keepM(new MeshStandardMaterial({ color: '#8a9099', metalness: 0.85, roughness: 0.38 }))
  const backing = keepM(new MeshStandardMaterial({ color: '#d8d2c4', metalness: 0.1, roughness: 0.6 }))
  const hull = keepM(new MeshStandardMaterial({ map: blanket, metalness: 0, roughness: 0.72 }))
  const radiator = keepM(new MeshStandardMaterial({ color: '#f2f2ef', metalness: 0.05, roughness: 0.32 }))
  const red = keepM(new MeshStandardMaterial({ color: brandColors.red, metalness: 0.1, roughness: 0.5 }))

  const root = new Group()
  root.name = 'station'

  // the main truss: four longerons and diagonal struts
  const longeron = keep(new CylinderGeometry(0.18, 0.18, TRUSS_L, 6).rotateZ(Math.PI / 2))
  for (const [y, z] of [[1, 1], [1, -1], [-1, 1], [-1, -1]]) {
    const m = new Mesh(longeron, metal)
    m.position.set(0, (y * TRUSS_W) / 2, (z * TRUSS_W) / 2)
    root.add(m)
  }
  const bays = Math.round(TRUSS_L / TRUSS_W)
  const strut = keep(new CylinderGeometry(0.1, 0.1, TRUSS_W * Math.SQRT2, 4))
  const struts = new InstancedMesh(strut, metal, bays * 2)
  const mtx = new Matrix4()
  const q = new Quaternion()
  const axis = new Vector3()
  for (let i = 0; i < bays; i++) {
    const x = -TRUSS_L / 2 + (i + 0.5) * TRUSS_W
    for (let s = 0; s < 2; s++) {
      const z = s ? TRUSS_W / 2 : -TRUSS_W / 2
      q.setFromAxisAngle(axis.set(0, 0, 1), (i % 2 ? 1 : -1) * (Math.PI / 4))
      mtx.compose(new Vector3(x, 0, z), q, new Vector3(1, 1, 1))
      struts.setMatrixAt(i * 2 + s, mtx)
    }
  }
  root.add(struts)

  // four pairs of solar wings near the ends, turning on their gimbals (the wings group)
  const wingGeo = keep(new BoxGeometry(WING_W, 0.12, WING_L))
  const mastGeo = keep(new CylinderGeometry(0.25, 0.25, WING_L * 2 + TRUSS_W, 8).rotateX(Math.PI / 2))
  const wings: Built['wings'] = []
  for (const x of [-46, -34, 34, 46]) {
    // each gimbal its own cell material: its glint flashes when its arrays mirror the sun into the camera
    const panel = keepM(new MeshStandardMaterial({ map: cells, metalness: 0.15, roughness: 0.4, envMapIntensity: 0.5, emissive: '#fff4e0', emissiveIntensity: 0 }))
    const g = new Group()
    g.position.x = x
    g.add(new Mesh(mastGeo, metal))
    for (const side of [1, -1]) {
      const w = new Mesh(wingGeo, [backing, backing, panel, backing, backing, backing])
      w.position.z = side * (TRUSS_W / 2 + WING_L / 2 + 0.6)
      g.add(w)
    }
    wings.push({ gimbal: g, panel })
    root.add(g)
  }

  // the habitable spine under the truss: modules along z joined by nodes, one wearing a red band
  const moduleGeo = keep(new CylinderGeometry(MODULE_R, MODULE_R, 12, 24).rotateX(Math.PI / 2))
  const nodeGeo = keep(new SphereGeometry(MODULE_R * 1.25, 20, 14))
  const bandGeo = keep(new CylinderGeometry(MODULE_R * 1.03, MODULE_R * 1.03, 2.2, 24, 1, true).rotateX(Math.PI / 2))
  const spineY = -4.5
  for (const z of [-19, -6, 6, 19]) {
    const m = new Mesh(moduleGeo, hull)
    m.position.set(0, spineY, z)
    root.add(m)
  }
  for (const z of [0, -12.5, 12.5]) {
    const n = new Mesh(nodeGeo, hull)
    n.position.set(0, spineY, z)
    root.add(n)
  }
  const band = new Mesh(bandGeo, red)
  band.position.set(0, spineY, 6)
  root.add(band)
  // a side lab off the central node
  const lab = new Mesh(moduleGeo, hull)
  lab.rotation.y = Math.PI / 2
  lab.position.set(8, spineY, 0)
  root.add(lab)
  const tie = new Mesh(keep(new CylinderGeometry(0.6, 0.6, 4.5, 8)), metal)
  tie.position.set(0, spineY / 2, 0)
  root.add(tie)

  // radiators hanging off the truss
  const radGeo = keep(new BoxGeometry(4, 10, 0.15))
  for (const x of [-14, 14]) {
    for (const k of [0, 1]) {
      const r = new Mesh(radGeo, radiator)
      r.position.set(x + (k ? 2.2 : -2.2), -6.5, 0)
      r.rotation.y = 0.4
      root.add(r)
    }
  }

  // navigation lights: red port, green starboard, white strobes; bright enough to bloom
  const bulbGeo = keep(new SphereGeometry(0.45, 10, 8))
  const lights: Built['lights'] = []
  const addLight = (pos: [number, number, number], color: string, blink: (t: number) => number) => {
    const mat = keepM(new MeshBasicMaterial({ toneMapped: false }))
    const b = new Mesh(bulbGeo, mat)
    b.position.set(...pos)
    root.add(b)
    lights.push({ mat, color: new Color(color), blink })
  }
  const steady = (t: number) => 0.7 + 0.3 * Math.sin(t * 2)
  const strobe = (phase: number) => (t: number) => ((t + phase) % 1.3 < 0.08 ? 1 : 0)
  addLight([-TRUSS_L / 2, 1.6, 0], '#ff2a1a', steady)
  addLight([TRUSS_L / 2, 1.6, 0], '#22ff66', steady)
  addLight([0, spineY, 25.5], '#ffffff', strobe(0))
  addLight([0, spineY, -25.5], '#ffffff', strobe(0.65))

  root.traverse((o) => {
    o.castShadow = false
    o.receiveShadow = false
  })

  return {
    root,
    lights,
    wings,
    dispose() {
      for (const g of geos) g.dispose()
      for (const m of mats) m.dispose()
      for (const t of texs) t.dispose()
      struts.dispose()
    },
  }
}

// an original orbital station drifting past the rocket: truss, solar wings with sun glints, white modules, blinking
// navigation lights (near field, sunlit by the key light)
export function Station() {
  const built = useMemo(build, [])
  const tmp = useMemo(() => ({ fwd: new Vector3(), side: new Vector3(), n: new Vector3(), r: new Vector3(), eye: new Vector3(), at: new Vector3(), q: new Quaternion() }), [])
  useEffect(() => {
    const off = registerPrewarm(built.root)
    return () => {
      off()
      built.dispose()
    }
  }, [built])
  const holder = useRef<Group>(null)

  useFrame(({ camera }) => {
    const on = rareShow.active && rareShow.kind === 'station'
    const g = holder.current
    if (g) g.visible = on
    if (!g || !on) return
    const p = rareShow.p
    // placed in the live shot's frame: within a shot it glides, a cut re-stages it like another camera would
    const f = shotFrame.forward
    tmp.fwd.set(f.x, 0, f.z).normalize()
    tmp.side.set(-tmp.fwd.z, 0, tmp.fwd.x)
    g.position
      .set(0, rig.rocketY + LOOK_Y + RISE * (1 - 2 * p), 0)
      .addScaledVector(tmp.fwd, BEYOND)
      .addScaledVector(tmp.side, CROSS * (2 * p - 1))
    // tilted towards the camera so the arrays show their faces, turning slowly; the wings track on their gimbals
    g.rotation.set(0.45, Math.atan2(tmp.fwd.x, tmp.fwd.z) + 0.5 + p * 0.5, 0.15)
    for (const w of built.wings) w.gimbal.rotation.x = 0.2 + p * 1.4
    g.updateMatrixWorld()
    // sun glints: how closely each array mirrors the sun into the lens
    const sun = lightState.sunDir
    for (const w of built.wings) {
      w.gimbal.getWorldQuaternion(tmp.q)
      tmp.n.set(0, 1, 0).applyQuaternion(tmp.q)
      if (tmp.n.dot(sun) < 0) tmp.n.negate()
      tmp.r.copy(tmp.n).multiplyScalar(2 * tmp.n.dot(sun)).sub(sun)
      w.gimbal.getWorldPosition(tmp.at)
      tmp.eye.copy(camera.position).sub(tmp.at).normalize()
      w.panel.emissiveIntensity = Math.max(0, tmp.r.dot(tmp.eye)) ** 60 * 6
    }
    const t = rig.vtime
    for (const l of built.lights) l.mat.color.copy(l.color).multiplyScalar(4 + 18 * l.blink(t))
  })

  return (
    <group ref={holder} visible={false}>
      <primitive object={built.root} />
    </group>
  )
}
