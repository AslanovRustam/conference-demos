import { MeshReflectorMaterial } from '@react-three/drei'
import { RADIUS } from './layout'
import RouletteRing from './RouletteRing'

export const LOUNGE_BG = '#0b0909'

function Floor() {
  return (
    <mesh rotation-x={-Math.PI / 2}>
      <circleGeometry args={[30, 96]} />
      <meshPhysicalMaterial color="#060506" roughness={0.65} metalness={0.2} clearcoat={0.25} clearcoatRoughness={0.4} envMapIntensity={0.08} />
    </mesh>
  )
}

function Platform() {
  return (
    <group>
      <mesh position-y={0.06}>
        <cylinderGeometry args={[RADIUS + 1.32, RADIUS + 1.4, 0.12, 128]} />
        <meshPhysicalMaterial color="#050405" roughness={0.3} metalness={0.4} clearcoat={0.6} envMapIntensity={0.2} />
      </mesh>
      {/* glossy stage top: cabinets mirror softly in it */}
      <mesh position-y={0.121} rotation-x={-Math.PI / 2}>
        <circleGeometry args={[RADIUS + 0.5, 96]} />
        <MeshReflectorMaterial
          resolution={512}
          blur={[220, 80]}
          mixBlur={1}
          mixStrength={6}
          roughness={0.85}
          depthScale={1.1}
          minDepthThreshold={0.4}
          maxDepthThreshold={1.4}
          color="#050406"
          metalness={0.2}
          mirror={0.8}
        />
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
      <spotLight position={[-6, 7, -4]} angle={0.6} penumbra={1} intensity={35} color="#ffd9c7" target-position={[0, 1, 0]} />
      <Floor />
      <Platform />
    </group>
  )
}
