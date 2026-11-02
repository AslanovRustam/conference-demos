import { PerformanceMonitor } from '@react-three/drei'
import { Canvas } from '@react-three/fiber'
import { useState, type ReactNode } from 'react'
import { useLobby } from '../state/store'
import ChipOrbit from './ChipOrbit'
import Effects from './Effects'
import GlassCore from './GlassCore'
import Backdrop from './Backdrop'
import Hall, { LOUNGE_BG } from './Hall'
import { CAMERA_HOME, FOV_HOME } from './layout'
import Precompile from './Precompile'
import { maxDpr } from './renderScale'
import Sparks from './Sparks'
import StudioEnvironment from './StudioEnvironment'

export default function LobbyCanvas({ children }: { children?: ReactNode }) {
  // the game owns the GPU while it is on screen; the last lobby frame stays under the iframe
  const playing = useLobby((s) => s.phase === 'playing')
  const [dpr, setDpr] = useState(() => maxDpr(innerWidth, innerHeight, devicePixelRatio))
  const [smaa, setSmaa] = useState(true)
  // a device that cannot hold the frame rate gives up edge smoothing first, then sharpness (never below 1×)
  const decline = () => {
    if (smaa) setSmaa(false)
    else setDpr((d) => Math.max(1, Math.round(d * 0.75 * 100) / 100))
  }
  return (
    <Canvas
      className="canvas"
      dpr={dpr}
      frameloop={playing ? 'never' : 'always'}
      gl={{ antialias: false, powerPreference: 'high-performance', stencil: false }}
      camera={{ fov: FOV_HOME, near: 0.1, far: 80, position: CAMERA_HOME.position }}
      // lets automated browser checks inspect the scene; stripped from production builds
      onCreated={(state) => void (import.meta.env.DEV && Object.assign(window, { __three: state }))}
    >
      <PerformanceMonitor flipflops={4} onDecline={decline} />
      <color attach="background" args={[LOUNGE_BG]} />
      <fogExp2 attach="fog" args={[LOUNGE_BG, 0.045]} />
      <StudioEnvironment />
      <Hall />
      <Backdrop />
      <GlassCore />
      <ChipOrbit />
      <Sparks />
      {children}
      <Precompile />
      <Effects smaa={smaa} />
    </Canvas>
  )
}
