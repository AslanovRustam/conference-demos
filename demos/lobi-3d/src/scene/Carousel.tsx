import { useFrame, useThree } from '@react-three/fiber'
import { useEffect, useMemo, useRef } from 'react'
import * as THREE from 'three'
import { carouselRotation, ringDistance, ringSlot } from '../carousel/math'
import { lobbyStore, useLobby } from '../state/store'
import Cabinet from './Cabinet'
import { portraitBlend } from './cameraMath'
import { PORTRAIT_SQUASH, RADIUS, TURN_TO_VIEWER } from './layout'

export default function Carousel({ onSelect }: { onSelect: (index: number) => void }) {
  // the ring turns as a whole, but each cabinet is placed on it every frame: upright screens
  // squash the ring into an ellipse, which a rotating group cannot do
  const rotation = useRef(0)
  const places = useRef<(THREE.Group | null)[]>([])
  const turns = useRef<(THREE.Group | null)[]>([])
  const size = useThree((s) => s.size)
  const squash = THREE.MathUtils.lerp(1, PORTRAIT_SQUASH, portraitBlend(size.width / size.height))
  const slots = useLobby((s) => s.slots)
  const activeIndex = useLobby((s) => s.activeIndex)
  const snapToken = useLobby((s) => s.snapToken)
  const n = slots.length
  // three aims a spotlight via target.matrixWorld, which only updates for objects in the scene
  const spotTarget = useMemo(() => {
    const o = new THREE.Object3D()
    o.position.set(0, 1.2, RADIUS)
    return o
  }, [])

  // presenter jumps (openGame) land instantly instead of spinning through the ring
  useEffect(() => {
    if (n) rotation.current = carouselRotation(lobbyStore.getState().carouselTarget, n)
  }, [snapToken, n])

  useFrame((_, dt) => {
    if (!n) return
    const target = carouselRotation(lobbyStore.getState().carouselTarget, n)
    rotation.current = THREE.MathUtils.damp(rotation.current, target, 8, dt)
    for (let i = 0; i < n; i++) {
      const place = places.current[i]
      const turn = turns.current[i]
      if (!place || !turn) continue
      const { position, angle } = ringSlot(i, n, rotation.current, RADIUS, squash)
      place.position.set(...position)
      place.rotation.y = angle
      // cabinets beside the front one turn partly toward the camera, like a showroom display
      turn.rotation.y = -angle * TURN_TO_VIEWER
    }
  })

  return (
    <>
      {/* the front position is always the active cabinet: one spotlight picks it out */}
      <primitive object={spotTarget} />
      <spotLight name="front-spot" position={[0, 6.2, RADIUS + 1.6]} angle={0.32} penumbra={0.55} intensity={42} color="#fff1e0" target={spotTarget} />
      {slots.map((slot, i) => (
        <group key={slot.key} ref={(g) => void (places.current[i] = g)}>
          <group ref={(g) => void (turns.current[i] = g)}>
            <Cabinet index={i} slot={slot} active={i === activeIndex} distance={ringDistance(i, activeIndex, n)} onSelect={onSelect} />
          </group>
        </group>
      ))}
    </>
  )
}
