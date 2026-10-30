import { Canvas } from '@react-three/fiber'
import type { ReactNode } from 'react'
import { useLobby } from '../state/store'
import Effects from './Effects'
import Hall from './Hall'
import HoloLogo from './HoloLogo'
import { CAMERA_HOME, FOV_HOME } from './layout'

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
      onCreated={({ camera }) => camera.lookAt(...CAMERA_HOME.target)}
    >
      <color attach="background" args={['#000000']} />
      <fog attach="fog" args={['#050002', 8, 26]} />
      <Hall />
      <HoloLogo />
      {children}
      <Effects />
    </Canvas>
  )
}
