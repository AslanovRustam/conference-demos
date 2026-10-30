import logoSvg from '@brand/logo/clickable-logo-red.svg?raw'
import { brandColors } from '@brand/tokens'
import { useFrame } from '@react-three/fiber'
import { useMemo, useRef } from 'react'
import * as THREE from 'three'
import { SVGLoader } from 'three/examples/jsm/loaders/SVGLoader.js'
import { LOGO } from './layout'

function logoGeometry(): THREE.BufferGeometry {
  const shapes = new SVGLoader().parse(logoSvg).paths.flatMap((p) => p.toShapes())
  const geo = new THREE.ExtrudeGeometry(shapes, { depth: 5, bevelEnabled: true, bevelThickness: 0.8, bevelSize: 0.5, bevelSegments: 2, curveSegments: 10 })
  geo.computeBoundingBox()
  const box = geo.boundingBox!
  const width = box.max.x - box.min.x
  geo.translate(-(box.min.x + box.max.x) / 2, -(box.min.y + box.max.y) / 2, -(box.min.z + box.max.z) / 2)
  // SVG y points down; flip it and scale the wordmark to its width in metres
  const s = LOGO.width / width
  geo.scale(s, -s, s)
  return geo
}

export default function HoloLogo() {
  const ref = useRef<THREE.Group>(null)
  const geometry = useMemo(logoGeometry, [])
  const material = useMemo(
    () => new THREE.MeshBasicMaterial({ color: new THREE.Color(brandColors.red).multiplyScalar(1.8), toneMapped: false, transparent: true, opacity: 0.95 }),
    [],
  )
  useFrame(({ clock }) => {
    const t = clock.elapsedTime
    if (!ref.current) return
    // a sway rather than a full turn keeps the wordmark readable from the front
    ref.current.rotation.y = Math.sin(t * 0.35) * 0.44
    ref.current.position.y = LOGO.y + Math.sin(t * 0.8) * 0.06
  })
  return (
    <group ref={ref} position-y={LOGO.y}>
      <mesh geometry={geometry} material={material} />
    </group>
  )
}
