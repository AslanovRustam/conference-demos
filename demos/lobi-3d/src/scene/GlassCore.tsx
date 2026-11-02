// The centrepiece: a glass sphere with the Clickable mark glowing red inside it.
// The mark is the vector logo mark (src/brand-extra, not yet in shared/brand).
import { brandColors } from '@brand/tokens'
import { useFrame } from '@react-three/fiber'
import { useMemo, useRef } from 'react'
import * as THREE from 'three'
import { SVGLoader } from 'three/examples/jsm/loaders/SVGLoader.js'
import markSvg from '../brand-extra/logo-mark.svg?raw'
import { CORE } from './layout'
import { CORE_GLOW } from './materials'

const MARK_WIDTH = 0.95

function markGeometry(): THREE.BufferGeometry {
  const shapes = new SVGLoader().parse(markSvg).paths.flatMap((p) => p.toShapes())
  const geo = new THREE.ExtrudeGeometry(shapes, { depth: 40, bevelEnabled: true, bevelThickness: 6, bevelSize: 4, bevelSegments: 3, curveSegments: 20 })
  geo.computeBoundingBox()
  const b = geo.boundingBox!
  geo.translate(-(b.min.x + b.max.x) / 2, -(b.min.y + b.max.y) / 2, -(b.min.z + b.max.z) / 2)
  return geo
}

/**
 * The sphere is drawn in three passes so it reads as a solid glass ball, not a decal: the far wall
 * (smoked, darkening whatever orbits behind the ball), then the glowing mark, then the near wall
 * (clear in the middle, mirror-like at the rim). Chips passing in front are opaque and win the depth
 * test against both walls; chips behind get the far wall's tint and the near wall's reflections.
 *
 * Real refraction (transmission) re-renders the whole lounge behind the glass and held only ~35 FPS
 * on an integrated GPU, so there is none: the passes fake the depth cue instead.
 */
const ORDER = { back: 1, mark: 2, front: 3 } as const

function backWallMaterial(): THREE.MeshStandardMaterial {
  return new THREE.MeshStandardMaterial({
    color: '#1a0d10',
    roughness: 0.08,
    metalness: 0.2,
    side: THREE.BackSide,
    transparent: true,
    opacity: 0.72,
    depthWrite: false,
    envMapIntensity: 0.5,
  })
}

function frontWallMaterial(): THREE.MeshPhysicalMaterial {
  const m = new THREE.MeshPhysicalMaterial({
    color: '#ffffff',
    roughness: 0.04,
    transparent: true,
    opacity: 0.06,
    depthWrite: false,
    iridescence: 0.6,
    iridescenceIOR: 1.3,
    clearcoat: 1,
    envMapIntensity: 2,
  })
  // Fresnel: glass is nearly invisible face-on and turns into a mirror at grazing angles,
  // which is what draws the ball's outline
  m.onBeforeCompile = (shader) => {
    shader.fragmentShader = shader.fragmentShader.replace(
      '#include <opaque_fragment>',
      `float rim = pow(1.0 - saturate(dot(geometryNormal, geometryViewDir)), 3.0);
      diffuseColor.a = mix(diffuseColor.a, 0.9, rim);
      #include <opaque_fragment>`,
    )
  }
  m.customProgramCacheKey = () => 'glass-front-fresnel'
  return m
}

export default function GlassCore() {
  const mark = useRef<THREE.Mesh>(null)
  const geometry = useMemo(markGeometry, [])
  const scale = useMemo(() => {
    geometry.computeBoundingBox()
    const b = geometry.boundingBox!
    return MARK_WIDTH / (b.max.x - b.min.x)
  }, [geometry])
  const back = useMemo(backWallMaterial, [])
  const front = useMemo(frontWallMaterial, [])
  // red-hot, bright enough to bloom, so the mark reads as light rather than red paint; transparent
  // only to be drawn between the two walls of the glass
  const glow = useMemo(() => new THREE.MeshBasicMaterial({ color: CORE_GLOW.clone(), toneMapped: false, transparent: true }), [])
  const sphere = useMemo(() => new THREE.SphereGeometry(CORE.radius, 96, 64), [])

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
      <mesh geometry={sphere} material={back} renderOrder={ORDER.back} />
      <mesh ref={mark} geometry={geometry} material={glow} renderOrder={ORDER.mark} />
      <mesh geometry={sphere} material={front} renderOrder={ORDER.front} />
      {/* red glow spills onto the ring and cabinets from just below the sphere, not inside the glass */}
      <pointLight position-y={-1.3} color={brandColors.red} intensity={16} distance={7} />
    </group>
  )
}
