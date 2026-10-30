import { RoundedBox } from '@react-three/drei'
import { useFrame, type ThreeEvent } from '@react-three/fiber'
import { useEffect, useMemo, useRef } from 'react'
import * as THREE from 'three'
import type { Slot } from '../config/games'
import { useLobby } from '../state/store'
import CabinetScreen from './CabinetScreen'
import { CABINET, SCREEN } from './layout'
import { ceramicRed, chrome, lacquerDark, lampColor, whiteChrome } from './materials'
import { previewShouldPlay } from './previewRules'

const BASE = 0.12 // platform top
const FRONT = CABINET.d / 2
const PLINTH_H = 0.14
const CROWN_H = 0.24

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
  const phase = useLobby((s) => s.phase)

  const lamp = useMemo(() => new THREE.MeshBasicMaterial({ color: lampColor(active, 0), toneMapped: false }), []) // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => () => lamp.dispose(), [lamp])

  // a refused COMING SOON cabinet shudders and its crown lamp flashes red
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
    flash.current = shaking ? 1 : Math.max(0, flash.current - dt * 4)
    lamp.color.lerp(lampColor(active, flash.current), Math.max(k, flash.current))
  })

  const click = (e: ThreeEvent<MouseEvent>) => {
    e.stopPropagation()
    onSelect(index)
  }

  const w = CABINET.w
  const d = CABINET.d
  const bodyBottom = BASE + PLINTH_H
  const bodyTop = BASE + CABINET.h - CROWN_H
  const crownY = bodyTop + CROWN_H / 2
  const screenBottom = SCREEN.y - SCREEN.h / 2

  return (
    <group ref={lift} onClick={click} onPointerOver={() => (document.body.style.cursor = 'pointer')} onPointerOut={() => (document.body.style.cursor = '')}>
      {/* chrome plinth, red ceramic body, white enamel crown */}
      <RoundedBox args={[w + 0.1, PLINTH_H, d + 0.1]} radius={0.05} smoothness={3} position={[0, BASE + PLINTH_H / 2, 0]} material={chrome()} />
      <RoundedBox args={[w, bodyTop - bodyBottom, d]} radius={0.14} smoothness={4} position={[0, (bodyTop + bodyBottom) / 2, 0]} material={ceramicRed()} />
      <RoundedBox args={[w + 0.06, CROWN_H, d + 0.05]} radius={0.1} smoothness={4} position={[0, crownY, 0]} material={whiteChrome()} />
      <mesh position={[0, crownY, (d + 0.05) / 2 + 0.004]} material={lamp}>
        <boxGeometry args={[w - 0.3, 0.035, 0.012]} />
      </mesh>
      {/* screen in a chrome frame on a dark lacquer bezel */}
      <RoundedBox args={[SCREEN.w + 0.16, SCREEN.h + 0.16, 0.04]} radius={0.03} smoothness={3} position={[0, SCREEN.y, FRONT + 0.005]} material={lacquerDark()} />
      <RoundedBox args={[SCREEN.w + 0.07, SCREEN.h + 0.07, 0.03]} radius={0.02} smoothness={3} position={[0, SCREEN.y, FRONT + 0.02]} material={chrome()} />
      <CabinetScreen index={index} slot={slot} loading={loading} near={previewShouldPlay(distance, phase)} dim={dimFor(distance)} flash={flash} z={FRONT + 0.037} />
      {/* control deck with a glossy red button */}
      <mesh position={[0, screenBottom - 0.26, FRONT + 0.1]} rotation-x={-0.5} material={lacquerDark()}>
        <boxGeometry args={[w - 0.16, 0.06, 0.34]} />
      </mesh>
      <mesh position={[0, screenBottom - 0.22, FRONT + 0.17]} rotation-x={-0.5 + Math.PI / 2} material={whiteChrome()}>
        <cylinderGeometry args={[0.085, 0.085, 0.02, 32]} />
      </mesh>
      <mesh position={[0, screenBottom - 0.205, FRONT + 0.18]} rotation-x={-0.5 + Math.PI / 2} material={ceramicRed()}>
        <cylinderGeometry args={[0.065, 0.065, 0.04, 32]} />
      </mesh>
    </group>
  )
}
