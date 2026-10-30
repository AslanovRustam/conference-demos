import { useFrame } from '@react-three/fiber';
import { useEffect, useRef } from 'react';
import type { CelebrateKind } from '../core/types';
import { boardLayout } from '../math/layout';
import { useSim } from '../sim/SimProvider';
import { fxHooks, pegGlow } from './fxStore';

interface Show {
  kind: CelebrateKind;
  slot: number | null;
  t: number;
  fountainLeft: number;
  fountainRate: number;
  waveTimer: number;
}

const SETUP: Record<CelebrateKind, { shake: [number, number]; pulse: [number, number, number]; fountain: number; seconds: number }> = {
  big: { shake: [0.15, 1.2], pulse: [0.8, 0.004, 1.5], fountain: 300, seconds: 1.5 },
  mega: { shake: [0.3, 2.0], pulse: [1.4, 0.008, 2.5], fountain: 600, seconds: 2.5 },
  total: { shake: [0.1, 0.8], pulse: [0.6, 0.003, 1.2], fountain: 0, seconds: 0 },
};

/** 3D-часть празднования Big/Mega Win и финала дождя (план, задача 14). */
export function CelebrationFx() {
  const { bus, store } = useSim();
  const show = useRef<Show | null>(null);

  useEffect(() => {
    const offStart = bus.on('celebrate:start', (e) => {
      const s = SETUP[e.kind];
      fxHooks.shake?.(...s.shake);
      fxHooks.pulse?.(...s.pulse);
      show.current = { kind: e.kind, slot: e.slot, t: 0, fountainLeft: s.fountain, fountainRate: s.seconds ? s.fountain / s.seconds : 0, waveTimer: 0 };
      if (e.kind === 'total') {
        const { slots } = boardLayout(store.getState().rows);
        for (const slot of slots) {
          fxHooks.burst?.(slot.x, slot.y + 0.2, 20, 1);
          fxHooks.wave?.(slot.x, slot.y, 0.8);
        }
      }
    });
    const offEnd = bus.on('celebrate:end', () => {
      show.current = null;
    });
    return () => {
      offStart();
      offEnd();
    };
  }, [bus, store]);

  useFrame((_, dt) => {
    const s = show.current;
    if (!s || s.kind === 'total' || s.slot === null) return;
    const { slots, pegs } = boardLayout(store.getState().rows);
    const slot = slots[s.slot];
    if (!slot) return;
    s.t += dt;

    // Фонтан осколков из камня
    if (s.fountainLeft > 0) {
      const n = Math.min(s.fountainLeft, Math.ceil(s.fountainRate * dt));
      s.fountainLeft -= n;
      fxHooks.burst?.(slot.x, slot.y + 0.2, n, 1.5);
    }

    // Волны от камня, пока идёт сцена
    s.waveTimer -= dt;
    if (s.waveTimer <= 0) {
      s.waveTimer = 0.4;
      fxHooks.wave?.(slot.x, slot.y, 1);
    }

    // Mega: вся пирамида горит
    if (s.kind === 'mega') for (const p of pegs) pegGlow.hit(p.flat, 0.7);
  });

  return null;
}
