import { useMemo } from 'react'
import * as THREE from 'three'
import { RADIUS } from './layout'
import RouletteRing from './RouletteRing'

export const LOUNGE_BG = '#0b0909'

/**
 * The floor is most of the frame, so its light pool is baked into a radial gradient on an unlit
 * material: lighting it live with three lights cost more than the rest of the lounge.
 */
function Floor() {
  const map = useMemo(() => {
    const c = document.createElement('canvas')
    c.width = c.height = 512
    const g = c.getContext('2d')!
    const grad = g.createRadialGradient(256, 256, 0, 256, 256, 256)
    grad.addColorStop(0, '#1a1416')
    grad.addColorStop(0.35, '#0d0a0b')
    grad.addColorStop(1, '#050405')
    g.fillStyle = grad
    g.fillRect(0, 0, 512, 512)
    const t = new THREE.CanvasTexture(c)
    t.colorSpace = THREE.SRGBColorSpace
    return t
  }, [])
  return (
    <mesh rotation-x={-Math.PI / 2}>
      <circleGeometry args={[30, 96]} />
      <meshBasicMaterial map={map} />
    </mesh>
  )
}

function Platform() {
  return (
    <group>
      <mesh position-y={0.06}>
        <cylinderGeometry args={[RADIUS + 1.32, RADIUS + 1.4, 0.12, 128]} />
        <meshStandardMaterial color="#050405" roughness={0.3} metalness={0.4} envMapIntensity={0.2} />
      </mesh>
      {/* glossy stage top (a mirror reflector was a full second scene render: too costly on integrated GPUs) */}
      <mesh position-y={0.121} rotation-x={-Math.PI / 2}>
        <circleGeometry args={[RADIUS + 0.5, 96]} />
        <meshStandardMaterial color="#050406" roughness={0.25} metalness={0.5} envMapIntensity={0.14} />
      </mesh>
      <RouletteRing inner={RADIUS + 0.55} outer={RADIUS + 1.25} y={0.124} />
    </group>
  )
}

export default function Hall() {
  return (
    <group>
      <ambientLight intensity={0.06} />
      {/* warm key light from above the front, like the landing studios */}
      <spotLight position={[3, 9, RADIUS + 6]} angle={0.55} penumbra={0.8} intensity={90} color="#fff1e0" target-position={[0, 1, 0]} />
      <Floor />
      <Platform />
    </group>
  )
}
