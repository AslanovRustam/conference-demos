import { brandColors } from '@brand/tokens'
import { RoundedBox } from '@react-three/drei'
import { useFrame, type ThreeEvent } from '@react-three/fiber'
import { useEffect, useMemo, useRef } from 'react'
import * as THREE from 'three'
import type { Slot } from '../config/games'
import { useLobby } from '../state/store'
import CabinetScreen from './CabinetScreen'
import { CABINET, SCREEN } from './layout'

const RED = new THREE.Color(brandColors.red)
const WHITE = new THREE.Color(brandColors.white)
const BASE = 0.12 // platform top
const FRONT = CABINET.d / 2
const STRIP = 0.035

interface Props {
  index: number
  slot: Slot
  active: boolean
  /** 0 for the active cabinet, 1 for its neighbours, … */
  distance: number
  onSelect: (index: number) => void
}

function dimFor(distance: number): number {
  return [1, 0.72, 0.48][distance] ?? 0.32
}

export default function Cabinet({ index, slot, active, distance, onSelect }: Props) {
  const lift = useRef<THREE.Group>(null)
  const flash = useRef(0)
  const shakeUntil = useRef(0)
  const loading = useLobby((s) => s.phase === 'entering' && s.openSlot === index)
  const deniedToken = useLobby((s) => s.deniedToken)

  const neon = useMemo(() => new THREE.MeshBasicMaterial({ color: RED.clone().multiplyScalar(2.2), toneMapped: false }), [])
  useEffect(() => () => neon.dispose(), [neon])

  // a refused COMING SOON cabinet shudders and its neon blinks
  useEffect(() => {
    if (!active || deniedToken === 0) return
    shakeUntil.current = performance.now() + 320
  }, [deniedToken]) // eslint-disable-line react-hooks/exhaustive-deps

  useFrame(({ clock }, dt) => {
    const g = lift.current
    if (!g) return
    const k = Math.min(1, dt * 7)
    g.position.z += ((active ? 0.35 : 0) - g.position.z) * k
    const s = active ? 1.06 : 1
    g.scale.setScalar(g.scale.x + (s - g.scale.x) * k)

    const shaking = performance.now() < shakeUntil.current
    g.position.x = shaking ? Math.sin(clock.elapsedTime * 70) * 0.03 : 0
    flash.current = shaking ? 0.6 : Math.max(0, flash.current - dt * 4)

    const dim = dimFor(distance)
    const target = (active ? WHITE : RED).clone().multiplyScalar((active ? 1.5 : 2.2) * dim + flash.current * 2)
    neon.color.lerp(target, k)
  })

  const click = (e: ThreeEvent<MouseEvent>) => {
    e.stopPropagation()
    onSelect(index)
  }

  const h = CABINET.h
  const w = CABINET.w
  const screenBottom = SCREEN.y - SCREEN.h / 2

  return (
    <group ref={lift} onClick={click} onPointerOver={() => (document.body.style.cursor = 'pointer')} onPointerOut={() => (document.body.style.cursor = '')}>
      {/* body */}
      <RoundedBox args={[w, h, CABINET.d]} radius={0.06} smoothness={3} position={[0, BASE + h / 2, 0]}>
        <meshStandardMaterial color="#0c0c0f" metalness={0.75} roughness={0.38} />
      </RoundedBox>
      {/* recessed screen bezel */}
      <mesh position={[0, SCREEN.y, FRONT + 0.005]}>
        <boxGeometry args={[SCREEN.w + 0.12, SCREEN.h + 0.12, 0.02]} />
        <meshStandardMaterial color="#050506" metalness={0.4} roughness={0.6} />
      </mesh>
      <CabinetScreen slot={slot} loading={loading} dim={dimFor(distance)} flash={flash} z={FRONT + 0.017} />
      {/* vertical edge strips */}
      {[-1, 1].map((side) => (
        <mesh key={side} position={[(side * w) / 2, BASE + h / 2, FRONT]} material={neon}>
          <boxGeometry args={[STRIP, h - 0.08, STRIP]} />
        </mesh>
      ))}
      {/* marquee */}
      <mesh position={[0, BASE + h - 0.2, FRONT + 0.02]} material={neon}>
        <boxGeometry args={[w - 0.3, 0.07, STRIP]} />
      </mesh>
      {/* control deck with a glowing button */}
      <mesh position={[0, screenBottom - 0.28, FRONT + 0.1]} rotation-x={-0.5}>
        <boxGeometry args={[w - 0.16, 0.06, 0.34]} />
        <meshStandardMaterial color="#111114" metalness={0.6} roughness={0.4} />
      </mesh>
      <mesh position={[0, screenBottom - 0.24, FRONT + 0.16]} rotation-x={-0.5 + Math.PI / 2} material={neon}>
        <cylinderGeometry args={[0.07, 0.07, 0.03, 24]} />
      </mesh>
      {/* base kick strip */}
      <mesh position={[0, BASE + 0.06, FRONT + 0.005]} material={neon}>
        <boxGeometry args={[w - 0.1, STRIP, STRIP]} />
      </mesh>
    </group>
  )
}
