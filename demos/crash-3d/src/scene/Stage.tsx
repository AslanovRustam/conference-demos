import { Stats } from '@react-three/drei'
import { useFrame } from '@react-three/fiber'
import { Suspense, useRef } from 'react'
import { markReady } from '../game/debug'
import { params } from '../platform/params'
import { CameraRig } from './camera/CameraRig'
import { Lights } from './env/Lights'
import { FarField } from './far/FarField'
import { SkyDome } from './far/SkyDome'
import { Stars } from './far/Stars'
import { Sun } from './far/Sun'
import { LaunchPad } from './pad/LaunchPad'
import { Effects } from './post/Effects'
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

// the whole 3d scene under the hud
export function Stage() {
  return (
    <>
      <color attach="background" args={['#020308']} />
      <RigUpdater />
      <CameraRig />
      <Suspense fallback={null}>
        <Lights />
        <FarField>
          <SkyDome />
          <Stars />
          <Sun />
          {/* moon, earth, nebulae, warp: tasks 16, 17 */}
        </FarField>
        <LaunchPad />
        <Rocket />
        <Effects />
        <Ready />
      </Suspense>
      {params.debug && <Stats />}
    </>
  )
}
