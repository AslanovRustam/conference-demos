import { useFrame } from '@react-three/fiber'
import { useEffect, useRef } from 'react'
import * as THREE from 'three'
import { carouselRotation, ringDistance, slotTransform } from '../carousel/math'
import { lobbyStore, useLobby } from '../state/store'
import Cabinet from './Cabinet'
import { RADIUS, TURN_TO_VIEWER } from './layout'

const TAU = Math.PI * 2

/** angle in (-π, π] */
function wrapAngle(a: number): number {
  return a - TAU * Math.round(a / TAU)
}

export default function Carousel({ onSelect }: { onSelect: (index: number) => void }) {
  const ref = useRef<THREE.Group>(null)
  const turns = useRef<(THREE.Group | null)[]>([])
  const slots = useLobby((s) => s.slots)
  const activeIndex = useLobby((s) => s.activeIndex)
  const snapToken = useLobby((s) => s.snapToken)
  const n = slots.length

  // presenter jumps (openGame) land instantly instead of spinning through the ring
  useEffect(() => {
    if (ref.current && n) ref.current.rotation.y = carouselRotation(lobbyStore.getState().carouselTarget, n)
  }, [snapToken, n])

  useFrame((_, dt) => {
    const group = ref.current
    if (!group || !n) return
    const target = carouselRotation(lobbyStore.getState().carouselTarget, n)
    group.rotation.y = THREE.MathUtils.damp(group.rotation.y, target, 8, dt)
    // cabinets beside the front one turn partly toward the camera, like a showroom display
    turns.current.forEach((turn, i) => {
      if (turn) turn.rotation.y = -wrapAngle((i * TAU) / n + group.rotation.y) * TURN_TO_VIEWER
    })
  })

  return (
    <>
      {/* the front position is always the active cabinet: one spotlight picks it out */}
      <spotLight position={[0, 6.2, RADIUS + 1.6]} angle={0.32} penumbra={0.55} intensity={42} color="#fff1e0" target-position={[0, 1.2, RADIUS]} />
    <group ref={ref}>
      {slots.map((slot, i) => {
        const t = slotTransform(i, n, RADIUS)
        return (
          <group key={slot.key} position={t.position} rotation-y={t.rotationY}>
            <group ref={(g) => void (turns.current[i] = g)}>
              <Cabinet index={i} slot={slot} active={i === activeIndex} distance={ringDistance(i, activeIndex, n)} onSelect={onSelect} />
            </group>
          </group>
        )
      })}
    </group>
    </>
  )
}
