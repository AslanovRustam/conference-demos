import { Stats } from '@react-three/drei'
import { useFrame } from '@react-three/fiber'
import { Suspense, useRef } from 'react'
import type { Mesh } from 'three'
import { markReady } from '../game/debug'
import { params } from '../platform/params'
import { CameraRig } from './camera/CameraRig'
import { FarField } from './far/FarField'
import { Effects } from './post/Effects'
import { rig } from './rig'
import { RigUpdater } from './RigUpdater'
import { Rocket } from './rocket/Rocket'

const READY_FRAMES = 30

// frames rendered once everything above it in the Suspense boundary has loaded
function Ready() {
  const frames = useRef(0)
  useFrame(() => {
    if (++frames.current === READY_FRAMES) markReady()
  })
  return null
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

// placeholder until the lights (task 10 replaces all of this): a faint night fill, a warm floodlight key
// from the front-left (it lights the livery) and a cold moon rim from behind; tuned in task 7 to judge
// the rocket materials. reflections come from the rocket's own environment maps
function PlaceholderLights() {
  return (
    <>
      <hemisphereLight args={['#33415c', '#07080b', 0.2]} />
      <directionalLight color="#ffe3c4" intensity={5} position={[-95, 120, 370]} />
      <directionalLight color="#a9bcff" intensity={2.6} position={[205, 255, -225]} />
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
        <Rocket />
        <Effects />
        <Ready />
      </Suspense>
      {params.debug && <Stats />}
    </>
  )
}
