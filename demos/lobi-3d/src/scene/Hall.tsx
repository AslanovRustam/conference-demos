import { MeshReflectorMaterial } from '@react-three/drei'
import { RADIUS } from './layout'

export const LOUNGE_BG = '#0b0909'

function Floor() {
  return (
    <mesh rotation-x={-Math.PI / 2}>
      <circleGeometry args={[30, 96]} />
      <meshPhysicalMaterial color="#070607" roughness={0.3} metalness={0.5} clearcoat={0.8} envMapIntensity={0.12} />
    </mesh>
  )
}

function Platform() {
  return (
    <group>
      <mesh position-y={0.06}>
        <cylinderGeometry args={[RADIUS + 1.3, RADIUS + 1.4, 0.12, 128]} />
        <meshPhysicalMaterial color="#0c0b0d" roughness={0.35} metalness={0.4} clearcoat={0.6} />
      </mesh>
      {/* glossy stage top: cabinets mirror softly in it */}
      <mesh position-y={0.121} rotation-x={-Math.PI / 2}>
        <circleGeometry args={[RADIUS + 0.5, 96]} />
        <MeshReflectorMaterial
          resolution={512}
          blur={[220, 80]}
          mixBlur={1}
          mixStrength={10}
          roughness={0.55}
          depthScale={1.1}
          minDepthThreshold={0.4}
          maxDepthThreshold={1.4}
          color="#0a090b"
          metalness={0.6}
          mirror={0.8}
        />
      </mesh>
    </group>
  )
}

export default function Hall() {
  return (
    <group>
      <ambientLight intensity={0.06} />
      {/* warm key light from above the front, like the landing studios */}
      <spotLight position={[3, 9, RADIUS + 6]} angle={0.55} penumbra={0.8} intensity={140} color="#fff1e0" target-position={[0, 1, 0]} />
      <spotLight position={[-6, 7, -4]} angle={0.6} penumbra={1} intensity={60} color="#ffd9c7" target-position={[0, 1, 0]} />
      <Floor />
      <Platform />
    </group>
  )
}
