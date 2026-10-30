import { Stats } from '@react-three/drei'
import { useFrame } from '@react-three/fiber'
import { Suspense, useRef } from 'react'
import type { DirectionalLight } from 'three'
import { markReady } from '../game/debug'
import { params } from '../platform/params'
import { CameraRig } from './camera/CameraRig'
import { FarField } from './far/FarField'
import { LaunchPad } from './pad/LaunchPad'
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

// placeholder until the lights (task 10 replaces all of this): a faint night fill, a warm floodlight key
// from the front-left (it lights the livery) and a cold moon rim from behind; tuned in task 7 to judge
// the rocket materials. reflections come from the rocket's own environment maps.
// on the pad the floodlights (task 9) light the rocket, and these two would wash the night ground grey:
// they fade in as the rocket climbs out of the floodlight
const KEY_I = 5
const RIM_I = 2.6
function PlaceholderLights() {
  const key = useRef<DirectionalLight>(null)
  const rim = useRef<DirectionalLight>(null)
  useFrame(() => {
    const t = Math.min(1, Math.max(0, (rig.altM - 40) / 220))
    const k = t * t * (3 - 2 * t)
    if (key.current) key.current.intensity = KEY_I * k
    if (rim.current) rim.current.intensity = RIM_I * k
  })
  return (
    <>
      <hemisphereLight args={['#33415c', '#07080b', 0.2]} />
      <directionalLight ref={key} color="#ffe3c4" intensity={0} position={[-95, 120, 370]} />
      <directionalLight ref={rim} color="#a9bcff" intensity={0} position={[205, 255, -225]} />
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
        <LaunchPad />
        <Rocket />
        <Effects />
        <Ready />
      </Suspense>
      {params.debug && <Stats />}
    </>
  )
}
