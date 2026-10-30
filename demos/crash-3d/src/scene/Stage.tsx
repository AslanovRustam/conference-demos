import { Stats } from '@react-three/drei'
import { useFrame } from '@react-three/fiber'
import { Suspense, useRef } from 'react'
import type { Group, Mesh } from 'three'
import { markReady } from '../game/debug'
import { params } from '../platform/params'
import { CameraRig } from './camera/CameraRig'
import { FarField } from './far/FarField'
import { Effects } from './post/Effects'
import { rig } from './rig'
import { RigUpdater } from './RigUpdater'

const READY_FRAMES = 30

// frames rendered once everything above it in the Suspense boundary has loaded
function Ready() {
  const frames = useRef(0)
  useFrame(() => {
    if (++frames.current === READY_FRAMES) markReady()
  })
  return null
}

// placeholder until the rocket (task 7): a white 48 m cylinder standing on its base at rig.rocketY
function PlaceholderRocket() {
  const group = useRef<Group>(null)
  useFrame(() => {
    if (group.current) group.current.position.y = rig.rocketY
  })
  return (
    <group ref={group}>
      <mesh position-y={24}>
        <cylinderGeometry args={[2.3, 2.3, 48, 48]} />
        <meshStandardMaterial color="#f4f4f2" roughness={0.45} />
      </mesh>
    </group>
  )
}

// placeholder until the launch pad (task 9): dark ground that sinks by the near-field offset
function PlaceholderGround() {
  const mesh = useRef<Mesh>(null)
  useFrame(() => {
    if (mesh.current) mesh.current.position.y = -rig.nearOffset
  })
  return (
    <mesh ref={mesh} rotation-x={-Math.PI / 2}>
      <planeGeometry args={[20000, 20000]} />
      <meshStandardMaterial color="#0b0e13" roughness={1} />
    </mesh>
  )
}

// placeholder until the lights (task 10): faint night fill plus a cold moon key
function PlaceholderLights() {
  return (
    <>
      <hemisphereLight args={['#33415c', '#07080b', 0.6]} />
      <directionalLight color="#c4d4ff" intensity={2.2} position={[-300, 500, 400]} />
    </>
  )
}

// the whole 3d scene under the hud
export function Stage() {
  return (
    <>
      <color attach="background" args={['#020308']} />
      <RigUpdater />
      <CameraRig />
      <Suspense fallback={null}>
        <FarField>{/* sky, stars, sun, moon, earth, nebulae, warp: tasks 10, 16, 17 */}</FarField>
        <PlaceholderLights />
        <PlaceholderGround />
        <PlaceholderRocket />
        <Effects />
        <Ready />
      </Suspense>
      {params.debug && <Stats />}
    </>
  )
}
