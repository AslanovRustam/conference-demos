import { PerformanceMonitor, Stats } from '@react-three/drei';
import { Canvas } from '@react-three/fiber';
import { useState, type ReactNode } from 'react';
import { dprRange } from '../platform/quality';
import { SimDriver } from '../sim/SimProvider';
import { useGame } from '../state/store';
import { Background } from './Background';
import { Balls } from './Balls';
import { CAMERA_FOV, CameraRig } from './CameraRig';
import { CelebrationFx } from './CelebrationFx';
import { Effects } from './Effects';
import { FloatingWins } from './FloatingWins';
import { Lighting } from './Lighting';
import { Pegs } from './Pegs';
import { Shards } from './Shards';
import { SlotFx } from './SlotFx';
import { Slots } from './Slots';
import { Trails } from './Trails';
import { WinFx } from './WinFx';

const params = new URLSearchParams(location.search);
const DEBUG = params.get('debug') === '1';
// Уровень, заданный вручную через ?quality=, не переключается автоматически
const PINNED = params.get('quality') === 'high' || params.get('quality') === 'light';

export function Stage({ children }: { children?: ReactNode }) {
  const quality = useGame((s) => s.quality);
  const setQuality = useGame((s) => s.setQuality);
  const [dprCap, setDprCap] = useState<number | null>(null);
  const [lo, hi] = dprRange(quality);
  const dpr: [number, number] = [lo, dprCap ?? hi];

  return (
    <Canvas
      style={{ position: 'absolute', inset: 0 }}
      camera={{ fov: CAMERA_FOV, near: 0.1, far: 400, position: [0, -6, 40] }}
      dpr={dpr}
      gl={{ antialias: false, powerPreference: 'high-performance' }}
    >
      {/* Проседаем — сначала облегчённые материалы, потом пониженное разрешение. После трёх переключений уровень фиксируется. */}
      {!PINNED && (
        <PerformanceMonitor
          flipflops={3}
          onDecline={() => {
            if (quality === 'high') setQuality('light');
            else setDprCap(1);
          }}
        />
      )}
      {DEBUG && <Stats />}
      <SimDriver />
      <Lighting />
      <Background />
      <CameraRig />
      <Pegs />
      <Slots />
      <SlotFx />
      <Trails />
      <Balls />
      <Shards />
      <FloatingWins />
      <WinFx />
      <CelebrationFx />
      <Effects />
      {children}
    </Canvas>
  );
}
