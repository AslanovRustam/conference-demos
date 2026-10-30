import { useFrame } from '@react-three/fiber'
import { useMemo, useRef } from 'react'
import * as THREE from 'three'
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js'
import { chrome } from './materials'
import { ROULETTE_SEGMENTS, segmentColor } from './roulette'

const COLORS = { red: '#e0101a', black: '#15161c', green: '#0b8f62' } as const
const SPIN = 0.05 // rad/s

/** The platform's outer band: roulette sectors between two chrome rims, slowly turning. */
export default function RouletteRing({ inner, outer, y }: { inner: number; outer: number; y: number }) {
  const ref = useRef<THREE.Group>(null)

  // one merged mesh per colour instead of 37 draw calls
  const bands = useMemo(() => {
    const step = (Math.PI * 2) / ROULETTE_SEGMENTS
    const parts: Record<keyof typeof COLORS, THREE.BufferGeometry[]> = { red: [], black: [], green: [] }
    for (let i = 0; i < ROULETTE_SEGMENTS; i++) parts[segmentColor(i)].push(new THREE.RingGeometry(inner, outer, 6, 1, i * step, step * 0.96))
    return (Object.keys(parts) as (keyof typeof COLORS)[]).map((c) => ({
      color: c,
      geometry: mergeGeometries(parts[c]),
      material: new THREE.MeshPhysicalMaterial({ color: COLORS[c], roughness: 0.4, clearcoat: 0.6, envMapIntensity: 0.7 }),
    }))
  }, [inner, outer])

  useFrame((_, dt) => {
    if (ref.current) ref.current.rotation.y += dt * SPIN
  })

  return (
    <group position-y={y}>
      <group ref={ref}>
        {bands.map((b) => (
          <mesh key={b.color} geometry={b.geometry} material={b.material} rotation-x={-Math.PI / 2} />
        ))}
      </group>
      {[inner - 0.03, outer + 0.03].map((r) => (
        <mesh key={r} rotation-x={Math.PI / 2} material={chrome()}>
          <torusGeometry args={[r, 0.045, 16, 192]} />
        </mesh>
      ))}
    </group>
  )
}
