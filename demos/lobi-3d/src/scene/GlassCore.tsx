// The centrepiece: a glass sphere with the Clickable mark glowing red inside it.
// The mark is the vector logo mark (src/brand-extra, not yet in shared/brand).
import { brandColors } from '@brand/tokens'
import { useFrame } from '@react-three/fiber'
import { useMemo, useRef } from 'react'
import * as THREE from 'three'
import { SVGLoader } from 'three/examples/jsm/loaders/SVGLoader.js'
import markSvg from '../brand-extra/logo-mark.svg?raw'
import { params } from '../state/params'
import { CORE } from './layout'

const MARK_WIDTH = 0.95

function markGeometry(): THREE.BufferGeometry {
  const shapes = new SVGLoader().parse(markSvg).paths.flatMap((p) => p.toShapes())
  const geo = new THREE.ExtrudeGeometry(shapes, { depth: 40, bevelEnabled: true, bevelThickness: 6, bevelSize: 4, bevelSegments: 3, curveSegments: 20 })
  geo.computeBoundingBox()
  const b = geo.boundingBox!
  geo.translate(-(b.min.x + b.max.x) / 2, -(b.min.y + b.max.y) / 2, -(b.min.z + b.max.z) / 2)
  return geo
}

function glassMaterial(): THREE.MeshPhysicalMaterial {
  // real refraction costs a second render of the scene; low quality keeps the look with reflections only
  return params.quality === 'low'
    ? new THREE.MeshPhysicalMaterial({ color: '#ffffff', roughness: 0.04, transparent: true, opacity: 0.22, clearcoat: 1, envMapIntensity: 2, depthWrite: false })
    : new THREE.MeshPhysicalMaterial({ color: '#ffffff', roughness: 0.03, transmission: 1, thickness: 0.25, ior: 1.18, iridescence: 0.6, iridescenceIOR: 1.3, clearcoat: 1, envMapIntensity: 1.6 })
}

export default function GlassCore() {
  const mark = useRef<THREE.Mesh>(null)
  const geometry = useMemo(markGeometry, [])
  const scale = useMemo(() => {
    geometry.computeBoundingBox()
    const b = geometry.boundingBox!
    return MARK_WIDTH / (b.max.x - b.min.x)
  }, [geometry])
  const glass = useMemo(glassMaterial, [])
  // red-hot: brighter than the red ceramic seen through the glass, so the mark reads as light
  const glow = useMemo(() => new THREE.MeshBasicMaterial({ color: new THREE.Color('#ff4a52').multiplyScalar(3.2), toneMapped: false }), [])

  useFrame(({ clock }) => {
    const t = clock.elapsedTime
    const m = mark.current
    if (!m) return
    const pulse = 1 + Math.sin(t * 2.1) * 0.07
    // negative Y flips the SVG's downward y; three swaps the face winding for a negative scale
    m.scale.set(scale * pulse, -scale * pulse, scale * pulse)
    m.rotation.y = Math.sin(t * 0.6) * 0.55
  })

  return (
    <group position-y={CORE.y}>
      <mesh ref={mark} geometry={geometry} material={glow} />
      <mesh material={glass}>
        <sphereGeometry args={[CORE.radius, 64, 64]} />
      </mesh>
      {/* red glow spills onto the ring and cabinets from just below the sphere, not inside the glass */}
      <pointLight position-y={-1.3} color={brandColors.red} intensity={16} distance={7} />
    </group>
  )
}
