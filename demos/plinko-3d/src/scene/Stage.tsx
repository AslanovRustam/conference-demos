import { Canvas } from '@react-three/fiber';
import type { ReactNode } from 'react';
import { SimDriver } from '../sim/SimProvider';
import { Background } from './Background';
import { CAMERA_FOV, CameraRig } from './CameraRig';
import { Lighting } from './Lighting';
import { Balls } from './Balls';
import { FloatingWins } from './FloatingWins';
import { Pegs } from './Pegs';
import { Shards } from './Shards';
import { Slots } from './Slots';
import { Trails } from './Trails';
import { WinFx } from './WinFx';

export function Stage({ children }: { children?: ReactNode }) {
  return (
    <Canvas
      style={{ position: 'absolute', inset: 0 }}
      camera={{ fov: CAMERA_FOV, near: 0.1, far: 400, position: [0, -6, 40] }}
      dpr={[1, 2]}
      gl={{ antialias: false, powerPreference: 'high-performance' }}
    >
      <SimDriver />
      <Lighting />
      <Background />
      <CameraRig />
      <Pegs />
      <Slots />
      <Trails />
      <Balls />
      <Shards />
      <FloatingWins />
      <WinFx />
      {children}
    </Canvas>
  );
}
