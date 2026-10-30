import { Canvas } from '@react-three/fiber'
import type { ReactNode } from 'react'
import { useLobby } from '../state/store'
import ChipOrbit from './ChipOrbit'
import Effects from './Effects'
import GlassCore from './GlassCore'
import Hall, { LOUNGE_BG } from './Hall'
import { CAMERA_HOME, FOV_HOME } from './layout'
import Precompile from './Precompile'
import Sparks from './Sparks'
import StudioEnvironment from './StudioEnvironment'

export default function LobbyCanvas({ children }: { children?: ReactNode }) {
  // the game owns the GPU while it is on screen; the last lobby frame stays under the iframe
  const playing = useLobby((s) => s.phase === 'playing')
  return (
    <Canvas
      className="canvas"
      dpr={[1, 2]}
      frameloop={playing ? 'never' : 'always'}
      gl={{ antialias: false, powerPreference: 'high-performance', stencil: false }}
      camera={{ fov: FOV_HOME, near: 0.1, far: 80, position: CAMERA_HOME.position }}
      // lets automated browser checks inspect the scene; stripped from production builds
      onCreated={(state) => void (import.meta.env.DEV && Object.assign(window, { __three: state }))}
    >
      <color attach="background" args={[LOUNGE_BG]} />
      <fogExp2 attach="fog" args={[LOUNGE_BG, 0.045]} />
      <StudioEnvironment />
      <Hall />
      <GlassCore />
      <ChipOrbit />
      <Sparks />
      {children}
      <Precompile />
      <Effects />
    </Canvas>
  )
}
