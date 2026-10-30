import { useFrame } from '@react-three/fiber'
import { useEffect, useMemo, useRef } from 'react'
import {
  BufferAttribute,
  BufferGeometry,
  CanvasTexture,
  DoubleSide,
  Group,
  LineBasicMaterial,
  LineSegments,
  MeshStandardMaterial,
  SphereGeometry,
  SRGBColorSpace,
} from 'three'
import { brandColors } from '@brand/tokens'
import { drogueOpen, mainOpen, type EjectState } from './motion'

const GORES = 12
const MAIN_R = 7.5
const MAIN_UP = 15 // canopy apex above the capsule base
const DROGUE_R = 1.6
const DROGUE_UP = 9
const CAP = 1.1 // canopy polar angle: a shallow dome
const HARNESS_Y = 3.3 // where the lines meet, on top of the capsule

// red and white gores around the canopy (u runs around it)
function goreTexture(): CanvasTexture {
  const c = document.createElement('canvas')
  c.width = 512
  c.height = 8
  const g = c.getContext('2d')!
  for (let i = 0; i < GORES; i++) {
    g.fillStyle = i % 2 ? '#f4f1ec' : brandColors.red
    g.fillRect((i * c.width) / GORES, 0, c.width / GORES + 1, c.height)
  }
  const t = new CanvasTexture(c)
  t.colorSpace = SRGBColorSpace
  return t
}

// rim points of a canopy of radius r with its apex at height up
function rimLines(r: number, up: number, count: number): BufferGeometry {
  const pos = new Float32Array(count * 6)
  const rimY = up - r + r * Math.cos(CAP)
  const rimR = r * Math.sin(CAP)
  for (let i = 0; i < count; i++) {
    const a = (i / count) * Math.PI * 2
    pos.set([Math.cos(a) * rimR, rimY, Math.sin(a) * rimR, 0, HARNESS_Y, 0], i * 6)
  }
  const g = new BufferGeometry()
  g.setAttribute('position', new BufferAttribute(pos, 3))
  return g
}

// drogue then main canopy over the capsule; it hangs upright from the capsule's position (the parent group),
// whatever the capsule's own tumble
export function Parachute({ state }: { state: { current: EjectState | null } }) {
  const tex = useMemo(goreTexture, [])
  const assets = useMemo(() => {
    const dome = (r: number) => {
      const g = new SphereGeometry(r, 48, 10, 0, Math.PI * 2, 0, CAP)
      g.translate(0, -r, 0) // apex at the origin
      return g
    }
    const cloth = new MeshStandardMaterial({ map: tex, side: DoubleSide, roughness: 0.85, metalness: 0 })
    const lines = new LineBasicMaterial({ color: 0xd8d4cc, transparent: true, opacity: 0.7 })
    return { main: dome(MAIN_R), drogue: dome(DROGUE_R), cloth, lines, mainLines: rimLines(MAIN_R, MAIN_UP, 24), drogueLines: rimLines(DROGUE_R, DROGUE_UP, 8) }
  }, [tex])
  const main = useRef<Group>(null)
  const drogue = useRef<Group>(null)
  const mainRig = useMemo(() => new LineSegments(assets.mainLines, assets.lines), [assets])
  const drogueRig = useMemo(() => new LineSegments(assets.drogueLines, assets.lines), [assets])

  useEffect(
    () => () => {
      tex.dispose()
      assets.main.dispose()
      assets.drogue.dispose()
      assets.cloth.dispose()
      assets.lines.dispose()
      assets.mainLines.dispose()
      assets.drogueLines.dispose()
    },
    [tex, assets],
  )

  useFrame(() => {
    const s = state.current
    const chute = s !== null && s.kind === 'chute'
    const m = chute ? mainOpen(s.t) : 0
    // the drogue pulls the main out and is let go once the main bites
    const d = chute ? drogueOpen(s.t) * (1 - Math.min(1, m * 2)) : 0
    if (main.current) {
      main.current.visible = m > 0.001
      // inflates sideways faster than it climbs to full height
      main.current.scale.set(Math.max(0.001, m), Math.max(0.001, 0.4 + 0.6 * Math.min(1, m)), Math.max(0.001, m))
    }
    if (drogue.current) {
      drogue.current.visible = d > 0.001
      drogue.current.scale.setScalar(Math.max(0.001, d))
    }
  })

  return (
    <>
      <group ref={drogue} visible={false}>
        <mesh geometry={assets.drogue} material={assets.cloth} position-y={DROGUE_UP} castShadow />
        <primitive object={drogueRig} />
      </group>
      <group ref={main} visible={false}>
        <mesh geometry={assets.main} material={assets.cloth} position-y={MAIN_UP} castShadow />
        <primitive object={mainRig} />
      </group>
    </>
  )
}
