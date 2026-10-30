import { Stats } from '@react-three/drei'
import { useFrame, useThree } from '@react-three/fiber'
import { Suspense, useEffect, useRef } from 'react'
import { markReady } from '../game/debug'
import { params } from '../platform/params'
import { CameraRig } from './camera/CameraRig'
import { Explosion } from './crash/Explosion'
import { Eject } from './eject/Capsule'
import { Lights } from './env/Lights'
import { FarField } from './far/FarField'
import { SkyDome } from './far/SkyDome'
import { Stars } from './far/Stars'
import { Sun } from './far/Sun'
import { LaunchPad } from './pad/LaunchPad'
import { Effects } from './post/Effects'
import { isPrewarmed, prewarm } from './prewarm'
import { RigUpdater } from './RigUpdater'
import { Rocket } from './rocket/Rocket'

const READY_FRAMES = 30

// compiles the mid-round effects once the scene has loaded (scene/prewarm.ts)
function Prewarm() {
  const gl = useThree((s) => s.gl)
  const scene = useThree((s) => s.scene)
  const camera = useThree((s) => s.camera)
  useEffect(() => {
    prewarm(gl, scene, camera)
  }, [gl, scene, camera])
  return null
}

// frames rendered once everything above it in the Suspense boundary has loaded and the effects are compiled
function Ready() {
  const frames = useRef(0)
  useFrame(() => {
    if (!isPrewarmed()) return
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
        <Eject />
        <Explosion />
        <Effects />
        <Prewarm />
        <Ready />
      </Suspense>
      {params.debug && <Stats />}
    </>
  )
}
