// Casino chips and dice drifting around the glass core.
import { useFrame } from '@react-three/fiber'
import { useMemo, useRef } from 'react'
import * as THREE from 'three'
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js'
import { CORE } from './layout'
import { orbitPosition } from './orbit'

const COUNT = 10
const RADIUS = 1.7
const TILT = 0.35
const CHIP_COLORS = ['#e0101a', '#e6e7ec', '#15161c'] as const

function canvasTexture(draw: (g: CanvasRenderingContext2D, size: number) => void, size = 256): THREE.CanvasTexture {
  const c = document.createElement('canvas')
  c.width = c.height = size
  draw(c.getContext('2d')!, size)
  const t = new THREE.CanvasTexture(c)
  t.colorSpace = THREE.SRGBColorSpace
  t.anisotropy = 4
  return t
}

/** chip face: base colour, a ring of edge spots and an inner line, like a real casino chip */
function chipMaterials(color: string): THREE.MeshStandardMaterial[] {
  const spot = color === '#e6e7ec' ? '#e0101a' : '#f4f5f8'
  const face = canvasTexture((g, s) => {
    g.fillStyle = color
    g.fillRect(0, 0, s, s)
    g.fillStyle = spot
    for (let i = 0; i < 8; i++) {
      g.save()
      g.translate(s / 2, s / 2)
      g.rotate((i / 8) * Math.PI * 2)
      g.fillRect(-s * 0.05, -s * 0.5, s * 0.1, s * 0.14)
      g.restore()
    }
    g.strokeStyle = spot
    g.lineWidth = s * 0.02
    g.beginPath()
    g.arc(s / 2, s / 2, s * 0.3, 0, Math.PI * 2)
    g.stroke()
  })
  const edge = canvasTexture((g, s) => {
    g.fillStyle = color
    g.fillRect(0, 0, s, s)
    g.fillStyle = spot
    for (let i = 0; i < 8; i++) g.fillRect((i / 8) * s, 0, s / 20, s)
  })
  const mat = (map: THREE.Texture) => new THREE.MeshStandardMaterial({ map, roughness: 0.22 })
  return [mat(edge), mat(face), mat(face)]
}

/** die faces 1–6 as pips on white enamel */
function dieMaterials(): THREE.MeshStandardMaterial[] {
  const pips: Record<number, [number, number][]> = {
    1: [[0.5, 0.5]],
    2: [[0.27, 0.27], [0.73, 0.73]],
    3: [[0.25, 0.25], [0.5, 0.5], [0.75, 0.75]],
    4: [[0.27, 0.27], [0.73, 0.27], [0.27, 0.73], [0.73, 0.73]],
    5: [[0.25, 0.25], [0.75, 0.25], [0.5, 0.5], [0.25, 0.75], [0.75, 0.75]],
    6: [[0.27, 0.22], [0.73, 0.22], [0.27, 0.5], [0.73, 0.5], [0.27, 0.78], [0.73, 0.78]],
  }
  return [1, 6, 2, 5, 3, 4].map((n) => {
    const map = canvasTexture((g, s) => {
      g.fillStyle = '#f4f5f8'
      g.fillRect(0, 0, s, s)
      g.fillStyle = n === 1 ? '#e0101a' : '#15161c'
      for (const [x, y] of pips[n]) {
        g.beginPath()
        g.arc(x * s, y * s, s * (n === 1 ? 0.12 : 0.085), 0, Math.PI * 2)
        g.fill()
      }
    })
    return new THREE.MeshStandardMaterial({ map, roughness: 0.2 })
  })
}

export default function ChipOrbit() {
  const items = useRef<(THREE.Mesh | null)[]>([])
  const { chipGeo, dieGeo, chipMats, dieMats, spins } = useMemo(
    () => ({
      chipGeo: new THREE.CylinderGeometry(0.2, 0.2, 0.05, 48),
      dieGeo: new RoundedBoxGeometry(0.26, 0.26, 0.26, 4, 0.05),
      chipMats: CHIP_COLORS.map(chipMaterials),
      dieMats: dieMaterials(),
      // each piece tumbles at its own pace
      spins: Array.from({ length: COUNT }, (_, i) => [0.4 + (i % 4) * 0.15, 0.5 + (i % 3) * 0.2] as const),
    }),
    [],
  )

  useFrame(({ clock }, dt) => {
    const t = clock.elapsedTime
    items.current.forEach((m, i) => {
      if (!m) return
      m.position.set(...orbitPosition(i, COUNT, t, RADIUS, TILT))
      m.rotation.x += dt * spins[i][0]
      m.rotation.y += dt * spins[i][1]
    })
  })

  return (
    <group position-y={CORE.y}>
      {Array.from({ length: COUNT }, (_, i) => {
        const die = i % 3 === 2
        return (
          <mesh
            key={i}
            ref={(m) => void (items.current[i] = m)}
            geometry={die ? dieGeo : chipGeo}
            material={die ? dieMats : chipMats[i % CHIP_COLORS.length]}
            rotation={[i * 0.7, i * 1.3, 0]}
          />
        )
      })}
    </group>
  )
}
