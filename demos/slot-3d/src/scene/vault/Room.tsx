import { brandColors, brandFonts } from '@brand/tokens'
import { Environment, Lightformer, MeshReflectorMaterial, RoundedBox } from '@react-three/drei'
import { useFrame } from '@react-three/fiber'
import gsap from 'gsap'
import { useEffect, useMemo, useRef } from 'react'
import * as THREE from 'three'
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js'
import { BONUS_LADDER, LADDER } from '../../game/config'
import { QUALITY } from '../../state/params'
import { useGame } from '../../state/store'
import { createDust } from '../fx'
import { GRID_H, GRID_W } from '../GridView'
import { logoGeometry } from './Door'
import { VAULT, vaultLight } from './layout'
import { vaultMaterials } from './materials'

// ---------------------------------------------------------------- helpers

function roundedRect<T extends THREE.Path>(path: T, x0: number, y0: number, x1: number, y1: number, r: number): T {
  path.moveTo(x0 + r, y0)
  path.lineTo(x1 - r, y0)
  path.quadraticCurveTo(x1, y0, x1, y0 + r)
  path.lineTo(x1, y1 - r)
  path.quadraticCurveTo(x1, y1, x1 - r, y1)
  path.lineTo(x0 + r, y1)
  path.quadraticCurveTo(x0, y1, x0, y1 - r)
  path.lineTo(x0, y0 + r)
  path.quadraticCurveTo(x0, y0, x0 + r, y0)
  return path
}

/** plane whose UVs run in world units, so tiled textures keep their scale */
function worldPlane(w: number, h: number) {
  const g = new THREE.PlaneGeometry(w, h)
  const uv = g.attributes.uv
  for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * w, uv.getY(i) * h)
  return g
}

function ingot() {
  const bar = new THREE.BoxGeometry(0.62, 0.24, 0.32)
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

const labels = new Map<string, THREE.CanvasTexture>()

/** lamp caption drawn by the browser, so WOFF2 brand fonts and the × fallback just work */
function labelTexture(text: string) {
  let tex = labels.get(text)
  if (tex) return tex
  const canvas = document.createElement('canvas')
  canvas.width = 160
  canvas.height = 80
  const ctx = canvas.getContext('2d')!
  tex = new THREE.CanvasTexture(canvas)
  tex.colorSpace = THREE.SRGBColorSpace
  tex.anisotropy = 4
  const draw = () => {
    ctx.clearRect(0, 0, canvas.width, canvas.height)
    ctx.font = `700 60px ${brandFonts.body}`
    ctx.fillStyle = '#ffffff'
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.fillText(text, canvas.width / 2, canvas.height / 2 + 3)
    tex!.needsUpdate = true
  }
  draw()
  // brand fonts use font-display: block, so redraw once they are really available
  void document.fonts.load(`700 60px ${brandFonts.body}`, text).then(draw)
  labels.set(text, tex)
  return tex
}

/** warm, softly lit reel slots behind the symbols */
/** `edge`: where the window's edge falls on the panel, as a fraction of its half-height */
function slotsTexture(edge: number) {
  const c = document.createElement('canvas')
  c.width = 768
  c.height = 640
  const ctx = c.getContext('2d')!
  const w = c.width / 6
  for (let i = 0; i < 6; i++) {
    const g = ctx.createLinearGradient(i * w, 0, (i + 1) * w, 0)
    g.addColorStop(0, '#0b0806')
    g.addColorStop(0.5, '#3a2a17')
    g.addColorStop(1, '#0b0806')
    ctx.fillStyle = g
    ctx.fillRect(i * w, 0, w, c.height)
    // the strips darken towards the window's edge and sink into shadow behind the bezel
    const v = ctx.createLinearGradient(0, 0, 0, c.height)
    v.addColorStop(0, 'rgba(0,0,0,0.92)')
    v.addColorStop((1 - edge) / 2, 'rgba(0,0,0,0.65)')
    v.addColorStop(0.5, 'rgba(0,0,0,0)')
    v.addColorStop((1 + edge) / 2, 'rgba(0,0,0,0.65)')
    v.addColorStop(1, 'rgba(0,0,0,0.92)')
    ctx.fillStyle = v
    ctx.fillRect(i * w, 0, w, c.height)
  }
  const tex = new THREE.CanvasTexture(c)
  tex.colorSpace = THREE.SRGBColorSpace
  return tex
}

// ---------------------------------------------------------------- wall, frame, steps

function Wall() {
  const m = vaultMaterials()
  const geo = useMemo(() => {
    const shape = new THREE.Shape()
    shape.moveTo(-45, VAULT.floorY)
    shape.lineTo(45, VAULT.floorY)
    shape.lineTo(45, VAULT.floorY + 40)
    shape.lineTo(-45, VAULT.floorY + 40)
    shape.closePath()
    shape.holes.push(new THREE.Path().absarc(0, 0, VAULT.frameOuter - 0.05, 0, Math.PI * 2, true))
    return new THREE.ShapeGeometry(shape, 96)
  }, [])
  return <mesh geometry={geo} material={m.wall} />
}

function Frame() {
  const m = vaultMaterials()
  const geo = useMemo(() => {
    const ring = new THREE.Shape().absarc(0, 0, VAULT.frameOuter, 0, Math.PI * 2, false)
    ring.holes.push(new THREE.Path().absarc(0, 0, VAULT.opening, 0, Math.PI * 2, true))
    const lip = new THREE.ExtrudeGeometry(ring, { depth: VAULT.frameLip - 0.05, bevelEnabled: true, bevelThickness: 0.05, bevelSize: 0.05, bevelSegments: 3, curveSegments: 96 })
    const tunnel = new THREE.CylinderGeometry(VAULT.opening, VAULT.opening, VAULT.tunnel, 96, 1, true).rotateX(Math.PI / 2).translate(0, 0, -VAULT.tunnel / 2)
    const r = (VAULT.opening + VAULT.frameOuter) / 2
    const rivets = mergeGeometries(
      Array.from({ length: 48 }, (_, i) => {
        const a = (i / 48) * Math.PI * 2
        return new THREE.SphereGeometry(0.08, 12, 8).scale(1, 1, 0.55).translate(Math.cos(a) * r, Math.sin(a) * r, VAULT.frameLip + 0.02)
      }),
    )
    // three steel steps up to the sill, like the stairs in front of real vault doors
    const steps = mergeGeometries(
      [0, 1, 2].map((i) => new THREE.BoxGeometry(3.8 - i * 0.2, 0.34, 2.1 - i * 0.6).translate(0, VAULT.floorY + 0.17 + i * 0.34, 1.65 - i * 0.3)),
    )
    return { lip, tunnel, rivets, steps }
  }, [])
  const tunnelMat = useMemo(() => {
    const t = m.dark.clone()
    t.side = THREE.BackSide
    return t
  }, [m])
  return (
    <group>
      <mesh geometry={geo.lip} material={m.body} />
      <mesh geometry={geo.tunnel} material={tunnelMat} />
      <mesh geometry={geo.rivets} material={m.accent} />
      <mesh geometry={geo.steps} material={m.body} />
    </group>
  )
}

function LogoPlate() {
  const m = vaultMaterials()
  const geo = useMemo(() => logoGeometry(5.2, 0.12), [])
  const y = VAULT.frameOuter + 1.25
  return (
    <group position={[0, y, 0]}>
      <RoundedBox args={[6.6, 1.35, 0.16]} radius={0.06} material={m.dark} position={[0, 0, 0.08]} />
      <mesh geometry={geo} position={[0, 0, 0.24]}>
        <meshStandardMaterial color={brandColors.red} metalness={0.3} roughness={0.35} emissive={brandColors.red} emissiveIntensity={0.35} />
      </mesh>
    </group>
  )
}

// ---------------------------------------------------------------- inside the vault

function GoldShelves({ treasury }: { treasury: boolean }) {
  const m = vaultMaterials()
  const { shelves, bars, piles } = useMemo(() => {
    const boards: THREE.BufferGeometry[] = []
    const mats: THREE.Matrix4[] = []
    const pileMats: THREE.Matrix4[] = []
    const q = new THREE.Quaternion()
    const one = new THREE.Vector3(1, 1, 1)
    const put = (list: THREE.Matrix4[], x: number, y: number, z: number, turn = 0) =>
      list.push(new THREE.Matrix4().compose(new THREE.Vector3(x, y, z), q.setFromAxisAngle(new THREE.Vector3(0, 1, 0), turn), one))
    for (const side of [-1, 1]) {
      const cx = side * 5.3
      for (const y of [-3.9, -1.9, 0.1, 2.1]) {
        boards.push(new THREE.BoxGeometry(2.8, 0.12, 2.4).translate(cx, y, -4.9))
        for (let layer = 0; layer < 2; layer++) {
          for (let ix = 0; ix < 4; ix++) {
            for (let iz = 0; iz < 3; iz++) {
              put(mats, cx + (ix - 1.5) * 0.66, y + 0.18 + layer * 0.24, -4.2 - iz * 0.7, layer % 2 ? 0.03 : 0)
            }
          }
        }
      }
      // posts holding the shelves
      for (const dz of [-3.8, -6.0]) boards.push(new THREE.BoxGeometry(0.12, 8.6, 0.12).translate(cx + side * 1.35, -0.5, dz))
    }
    // treasury: pyramids of bars on the floor either side of the reels
    for (const cx of [-3.7, 3.7]) {
      for (let layer = 0; layer < 5; layer++) {
        const n = 5 - layer
        for (let ix = 0; ix < n; ix++) {
          for (let iz = 0; iz < 2; iz++) put(pileMats, cx + (ix - (n - 1) / 2) * 0.66, -VAULT.opening + 0.12 + layer * 0.24, -3.6 - iz * 0.7)
        }
      }
    }
    const inst = (list: THREE.Matrix4[]) => {
      const mesh = new THREE.InstancedMesh(ingot(), m.gold, list.length)
      list.forEach((mat, i) => mesh.setMatrixAt(i, mat))
      return mesh
    }
    return { shelves: mergeGeometries(boards), bars: inst(mats), piles: inst(pileMats) }
  }, [m])
  return (
    <group>
      <mesh geometry={shelves} material={m.dark} />
      <primitive object={bars} />
      <primitive object={piles} visible={treasury} />
    </group>
  )
}

function Interior({ treasury }: { treasury: boolean }) {
  const m = vaultMaterials()
  const { roomW: w, roomDepth: d, roomHeight: h, tunnel } = VAULT
  const zMid = -tunnel - d / 2
  const floorY = -VAULT.opening
  const geo = useMemo(() => ({ side: worldPlane(d, h), back: worldPlane(w, h), top: worldPlane(w, d) }), [w, d, h])
  const floorMat = useMemo(() => new THREE.MeshStandardMaterial({ color: '#3b3226', metalness: 0.7, roughness: 0.32, envMapIntensity: 0.8 }), [])
  useEffect(() => {
    floorMat.color.set(treasury ? '#5a4220' : '#3b3226')
    m.wallInside.color.set(treasury ? '#b08a50' : '#8a7a62')
  }, [treasury, floorMat, m])
  return (
    <group>
      <mesh geometry={geo.top} material={floorMat} rotation-x={-Math.PI / 2} position={[0, floorY, zMid]} />
      <mesh geometry={geo.top} material={m.wallInside} rotation-x={Math.PI / 2} position={[0, floorY + h, zMid]} />
      <mesh geometry={geo.back} material={m.wallInside} position={[0, floorY + h / 2, -tunnel - d]} />
      <mesh geometry={geo.side} material={m.wallInside} rotation-y={Math.PI / 2} position={[-w / 2, floorY + h / 2, zMid]} />
      <mesh geometry={geo.side} material={m.wallInside} rotation-y={-Math.PI / 2} position={[w / 2, floorY + h / 2, zMid]} />
      <GoldShelves treasury={treasury} />
    </group>
  )
}

/**
 * The reel strips sit just behind the symbols and run on well past the window, hidden by the bezel.
 * The camera looks down into the window, so a shallower or shorter box shows its lit floor as a
 * strip under the reels, and spinning symbols visibly slide over it before ducking under the bezel.
 */
const REEL_BACK_Z = -0.6
const REEL_HALF_H = GRID_H / 2 + 0.52

/** steel bezel round the reels, the lit slots behind them and the multiplier plaque above */
function ReelBezel({ treasury }: { treasury: boolean }) {
  const m = vaultMaterials()
  const geo = useMemo(() => {
    const hw = VAULT.bezelW / 2
    const hh = VAULT.bezelH / 2
    const iw = GRID_W / 2 + 0.11
    const ih = GRID_H / 2 + 0.11
    const outer = roundedRect(new THREE.Shape(), -hw, -hh, hw, hh, 0.3)
    outer.holes.push(roundedRect(new THREE.Path(), -iw, -ih, iw, ih, 0.12))
    const bezel = new THREE.ExtrudeGeometry(outer, { depth: 0.26, bevelEnabled: true, bevelThickness: 0.05, bevelSize: 0.05, bevelSegments: 3, curveSegments: 12 })
    const liner = roundedRect(new THREE.Shape(), -iw - 0.02, -REEL_HALF_H - 0.02, iw + 0.02, REEL_HALF_H + 0.02, 0.12)
    liner.holes.push(roundedRect(new THREE.Path(), -iw, -REEL_HALF_H, iw, REEL_HALF_H, 0.12))
    const linerGeo = new THREE.ExtrudeGeometry(liner, { depth: 0.67 - REEL_BACK_Z, bevelEnabled: false, curveSegments: 12 }).translate(0, 0, REEL_BACK_Z - 0.02)
    const rivets: THREE.BufferGeometry[] = []
    const rivet = (x: number, y: number) => rivets.push(new THREE.SphereGeometry(0.065, 10, 8).scale(1, 1, 0.5).translate(x, y, 0.34))
    for (let i = 0; i <= 10; i++) {
      const x = -hw + 0.22 + (i * (2 * hw - 0.44)) / 10
      rivet(x, hh - 0.22)
      rivet(x, -hh + 0.22)
    }
    for (let i = 1; i < 8; i++) {
      const y = -hh + 0.22 + (i * (2 * hh - 0.44)) / 8
      rivet(-hw + 0.22, y)
      rivet(hw - 0.22, y)
    }
    return { bezel, linerGeo, rivets: mergeGeometries(rivets) }
  }, [])
  const slots = useMemo(() => {
    const tex = slotsTexture((GRID_H / 2 + 0.2) / REEL_HALF_H)
    return new THREE.MeshStandardMaterial({ map: tex, emissiveMap: tex, emissive: '#ffb347', emissiveIntensity: 0.55, metalness: 0.2, roughness: 0.8 })
  }, [])
  const liner = useMemo(() => new THREE.MeshStandardMaterial({ color: '#0d0b09', metalness: 0.3, roughness: 0.9 }), [])
  useEffect(() => {
    slots.emissiveIntensity = treasury ? 0.9 : 0.55
  }, [treasury, slots])
  return (
    <group position={[0, VAULT.gridY, VAULT.gridZ]}>
      <group position={[0, 0, 0.62]}>
        <mesh geometry={geo.bezel} material={m.body} />
        <mesh geometry={geo.rivets} material={m.accent} />
      </group>
      <mesh geometry={geo.linerGeo} material={liner} />
      <mesh material={slots} position={[0, 0, REEL_BACK_Z]}>
        <planeGeometry args={[GRID_W + 0.3, REEL_HALF_H * 2 + 0.04]} />
      </mesh>
      <group position={[0, VAULT.bezelH / 2 + 0.42, 0.72]}>
        <RoundedBox args={[5.9, 0.6, 0.12]} radius={0.05} material={m.dark} />
        <MultiplierTrack width={5.5} />
      </group>
    </group>
  )
}

function MultiplierTrack({ width }: { width: number }) {
  const multiplier = useGame((s) => s.multiplier)
  const bonus = useGame((s) => s.freeSpins !== null)
  const ladder = bonus ? BONUS_LADDER : LADDER
  const current = Math.max(0, ladder.findIndex((x) => x === multiplier))
  const step = width / ladder.length
  const lampW = Math.min(0.55, step * 0.84)
  const group = useRef<THREE.Group>(null)
  const lampMats = useMemo(
    () => Array.from({ length: BONUS_LADDER.length }, () => new THREE.MeshStandardMaterial({ color: '#15171c', metalness: 0.6, roughness: 0.3, emissive: '#000000', toneMapped: false })),
    [],
  )
  const labelMats = useMemo(() => Array.from({ length: BONUS_LADDER.length }, () => new THREE.MeshBasicMaterial({ transparent: true, depthWrite: false })), [])
  const lit = bonus ? '#ffd76a' : '#ff3b42'

  useEffect(() => {
    lampMats.forEach((m, i) => {
      const passed = i < current
      const active = i === current
      m.emissive.set(active || passed ? lit : '#ffffff')
      m.emissiveIntensity = active ? 2.4 : passed ? 0.8 : 0.03
      labelMats[i].map = labelTexture(`×${ladder[i] ?? ''}`)
      labelMats[i].color.set(active || passed ? brandColors.dark : '#7a808c')
      labelMats[i].needsUpdate = true
    })
    const lamp = group.current?.children[current]
    if (lamp) gsap.fromTo(lamp.scale, { x: 1.5, y: 1.5, z: 1.5 }, { x: 1.15, y: 1.15, z: 1.15, duration: 0.5, ease: 'back.out(3)' })
    group.current?.children.forEach((c, i) => i !== current && c.scale.setScalar(1))
  }, [current, lit, lampMats, labelMats, ladder])

  useFrame(({ clock }) => {
    const m = lampMats[current]
    if (m) m.emissiveIntensity = 2.2 + Math.sin(clock.elapsedTime * 6) * 0.6
  })

  return (
    <group ref={group} position={[0, 0, 0.08]}>
      {ladder.map((_, i) => (
        <group key={`${bonus}-${i}`} position={[-width / 2 + step * (i + 0.5), 0, 0]}>
          <RoundedBox args={[lampW, 0.34, 0.07]} radius={0.05} material={lampMats[i]} />
          <mesh position={[0, 0, 0.045]} material={labelMats[i]} scale={Math.min(1, lampW / 0.6)}>
            <planeGeometry args={[0.56, 0.28]} />
          </mesh>
        </group>
      ))}
    </group>
  )
}

// ---------------------------------------------------------------- floor, light, air

function Floor() {
  const quality = useGame((s) => s.quality)
  const m = vaultMaterials()
  return (
    <mesh rotation-x={-Math.PI / 2} position={[0, VAULT.floorY, 0]}>
      <planeGeometry args={[120, 120]} />
      {quality === 'high' ? (
        <MeshReflectorMaterial
          map={m.floor}
          resolution={256}
          mirror={0.35}
          mixBlur={1}
          mixStrength={1.4}
          blur={[300, 90]}
          roughness={0.55}
          depthScale={0.6}
          minDepthThreshold={0.3}
          maxDepthThreshold={1.4}
          color="#c6cbd2"
          metalness={0.3}
          envMapIntensity={0.25}
        />
      ) : (
        <meshStandardMaterial map={m.floor} color="#c6cbd2" metalness={0.25} roughness={0.5} envMapIntensity={0.3} />
      )}
    </mesh>
  )
}

/** spotlights on the door outside, warm light inside that follows how far the door is open */
function Lights({ treasury }: { treasury: boolean }) {
  const inside = useRef<(THREE.PointLight | null)[]>([])
  // the third light spills through the doorway; kept low so it does not wash out the stones on the reels
  const base = treasury ? [70, 45, 12] : [45, 28, 7]
  useFrame(() => {
    const k = vaultLight.interior
    inside.current.forEach((l, i) => l && (l.intensity = base[i] * k))
  })
  return (
    <group>
      <hemisphereLight args={['#dfe6f0', '#16181c', 0.55]} />
      <directionalLight position={[-6, 12, 14]} intensity={1.6} color="#f4f6ff" />
      <spotLight position={[-8, 12, 10]} angle={0.42} penumbra={0.75} intensity={420} distance={45} decay={1.6} color="#eef3ff" />
      <spotLight position={[8, 12, 10]} angle={0.42} penumbra={0.75} intensity={420} distance={45} decay={1.6} color="#eef3ff" />
      <pointLight ref={(l) => void (inside.current[0] = l)} position={[0, 2.8, -5.5]} color="#ffb04a" distance={18} decay={1.5} intensity={0} />
      <pointLight ref={(l) => void (inside.current[1] = l)} position={[0, -2.6, -4.2]} color="#ffc56b" distance={14} decay={1.5} intensity={0} />
      {/* warm spill through the doorway onto the floor and the steps */}
      <pointLight ref={(l) => void (inside.current[2] = l)} position={[0, -1.5, 0.6]} color="#ffbf66" distance={12} decay={1.6} intensity={0} />
    </group>
  )
}

function Dust() {
  const quality = useGame((s) => s.quality)
  const points = useMemo(() => {
    const p = createDust(Math.round(QUALITY[quality].dust / 3), new THREE.Vector3(12, 10, 10), '#ffd9a0')
    ;(p.material as THREE.PointsMaterial).size = 0.05
    ;(p.material as THREE.PointsMaterial).opacity = 0.5
    return p
  }, [quality])
  useFrame((_, dt) => {
    points.rotation.y += dt * 0.02
    ;(points.material as THREE.PointsMaterial).opacity = 0.15 + 0.4 * vaultLight.interior
  })
  return <primitive object={points} position={[0, 0, -1]} />
}

export function VaultRoom() {
  const world = useGame((s) => s.world)
  const treasury = world === 'treasury'
  return (
    <group>
      <color attach="background" args={['#0e1014']} />
      <fogExp2 attach="fog" args={['#0e1014', 0.012]} />
      <Lights treasury={treasury} />
      <Wall />
      <Frame />
      <LogoPlate />
      <Interior treasury={treasury} />
      <ReelBezel treasury={treasury} />
      <Floor />
      <Dust />
    </group>
  )
}

/** studio-style reflections for polished steel; warmer in the treasury */
export function VaultEnvironment({ world }: { world: 'vault' | 'treasury' }) {
  const gold = world === 'treasury'
  return (
    <Environment key={world} resolution={256} frames={1}>
      <color attach="background" args={['#15171b']} />
      <Lightformer form="rect" intensity={2.4} color="#ffffff" position={[0, 9, 6]} scale={[16, 5, 1]} target={[0, 0, 0]} />
      <Lightformer form="rect" intensity={1.6} color="#e9eef8" position={[-10, 3, 5]} scale={[4, 10, 1]} target={[0, 0, 0]} />
      <Lightformer form="rect" intensity={1.6} color="#e9eef8" position={[10, 3, 5]} scale={[4, 10, 1]} target={[0, 0, 0]} />
      <Lightformer form="rect" intensity={1} color="#ffffff" position={[0, 0, 12]} scale={[14, 4, 1]} target={[0, 0, 0]} />
      <Lightformer form="rect" intensity={gold ? 3.5 : 2.2} color={gold ? '#ffb347' : '#ffc77a'} position={[0, 0, -9]} scale={[10, 8, 1]} target={[0, 0, 0]} />
    </Environment>
  )
}
