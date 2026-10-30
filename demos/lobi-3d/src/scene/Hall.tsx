import { brandColors } from '@brand/tokens'
import { useFrame } from '@react-three/fiber'
import { useMemo } from 'react'
import * as THREE from 'three'
import { RADIUS } from './layout'

const RED = new THREE.Color(brandColors.red)

// neon grid drawn in world space, so cells stay square and lines stay crisp at any distance
const gridVertex = /* glsl */ `
  varying vec3 vWorld;
  void main() {
    vec4 w = modelMatrix * vec4(position, 1.0);
    vWorld = w.xyz;
    gl_Position = projectionMatrix * viewMatrix * w;
  }
`
const gridFragment = /* glsl */ `
  uniform vec3 uColor;
  uniform float uCell;
  uniform float uTime;
  varying vec3 vWorld;
  void main() {
    vec2 c = vWorld.xz / uCell;
    vec2 g = abs(fract(c - 0.5) - 0.5) / fwidth(c);
    float line = 1.0 - min(min(g.x, g.y), 1.0);
    float r = length(vWorld.xz);
    float fade = 1.0 - smoothstep(5.0, 20.0, r);
    float pulse = 0.8 + 0.2 * sin(r * 1.3 - uTime * 1.4);
    vec3 col = uColor * line * fade * pulse * 1.3 + vec3(0.02, 0.0, 0.004) * fade;
    gl_FragColor = vec4(col, 1.0);
  }
`

function Floor() {
  const material = useMemo(
    () =>
      new THREE.ShaderMaterial({
        vertexShader: gridVertex,
        fragmentShader: gridFragment,
        uniforms: { uColor: { value: RED.clone() }, uCell: { value: 0.75 }, uTime: { value: 0 } },
        toneMapped: false,
      }),
    [],
  )
  useFrame((_, dt) => {
    material.uniforms.uTime.value += dt
  })
  return (
    <mesh rotation-x={-Math.PI / 2} material={material}>
      <planeGeometry args={[60, 60]} />
    </mesh>
  )
}

function Platform() {
  const neon = useMemo(() => new THREE.MeshBasicMaterial({ color: RED.clone().multiplyScalar(3), toneMapped: false }), [])
  return (
    <group>
      <mesh position-y={0.06}>
        <cylinderGeometry args={[RADIUS + 0.9, RADIUS + 1.0, 0.12, 96]} />
        <meshStandardMaterial color="#0a0a0c" metalness={0.8} roughness={0.35} />
      </mesh>
      <mesh position-y={0.125} rotation-x={-Math.PI / 2} material={neon}>
        <torusGeometry args={[RADIUS + 0.9, 0.025, 8, 160]} />
      </mesh>
      <mesh position-y={0.125} rotation-x={-Math.PI / 2} material={neon}>
        <torusGeometry args={[RADIUS - 0.9, 0.018, 8, 128]} />
      </mesh>
    </group>
  )
}

export default function Hall() {
  return (
    <group>
      <ambientLight intensity={0.18} />
      <pointLight position={[0, 1.2, RADIUS + 2]} color={brandColors.red} intensity={6} distance={9} />
      <pointLight position={[-4, 1.5, -2]} color={brandColors.red} intensity={4} distance={10} />
      <pointLight position={[4, 1.5, -2]} color={brandColors.red} intensity={4} distance={10} />
      <spotLight position={[0, 7, RADIUS + 2.5]} angle={0.45} penumbra={0.6} intensity={40} color="#ffffff" target-position={[0, 1, RADIUS]} />
      <Floor />
      <Platform />
    </group>
  )
}
