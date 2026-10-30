import { useFrame } from '@react-three/fiber';
import { useEffect, useMemo } from 'react';
import { formatCredits } from '../core/format';
import type { GameEvents } from '../core/events';
import { WaveField } from '../fx/wave';
import { boardLayout } from '../math/layout';
import { useSim } from '../sim/SimProvider';
import { useGame } from '../state/store';
import { fxHooks, pegGlow } from './fxStore';

/** Реакция сцены на приземление шарика по уровню выигрыша (план, задача 11). */
export function WinFx() {
  const { bus, store } = useSim();
  const rows = useGame((s) => s.rows);
  const waves = useMemo(() => new WaveField(), []);

  useEffect(() => {
    fxHooks.wave = (x, y, intensity) => waves.add(x, y, intensity);
    const off = bus.on('ball:land', (e: GameEvents['ball:land']) => {
      const slot = boardLayout(store.getState().rows).slots[e.slot];
      if (!slot) return;
      const x = slot.x;
      const y = slot.y + 0.2;
      const rain = e.kind === 'rain';
      const text = (e.kind === 'demo' ? '' : '+') + formatCredits(e.win);
      const big = e.tier === 'large' || e.tier === 'big' || e.tier === 'mega';

      if (e.tier === 'sub') {
        fxHooks.flashSlot?.(e.slot, rain ? 0.2 : 0.3);
        if (!rain) fxHooks.floatText?.(e.slot, text, true);
      } else if (e.tier === 'normal') {
        fxHooks.flashSlot?.(e.slot, rain ? 0.6 : 1);
        fxHooks.burst?.(x, y, rain ? 3 : 12, 0.8);
        if (!rain) fxHooks.floatText?.(e.slot, text, false);
      } else if (big) {
        fxHooks.flashSlot?.(e.slot, 1);
        fxHooks.burst?.(x, y, rain ? 10 : 60, rain ? 0.9 : 1.2);
        waves.add(x, y, rain ? 0.6 : 1);
        if (!rain) fxHooks.floatText?.(e.slot, text, false);
      }
    });
    return () => {
      off();
      fxHooks.wave = undefined;
    };
  }, [bus, store, waves]);

  useFrame((_, dt) => {
    waves.update(dt);
    waves.apply(boardLayout(rows).pegs, pegGlow);
  });

  return null;
}
