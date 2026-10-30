import { useEffect, useRef, useState } from 'react';
import type { Rows } from '../core/types';

// Старые ряды гаснут снизу вверх, новые вырастают сверху вниз (шаг на ряд, а не на кристалл,
// иначе на 16 рядах анимация тянулась бы несколько секунд)
const OUT_STEP = 0.03;
const OUT_DUR = 0.25;
const IN_STEP = 0.035;
const IN_DUR = 0.35;

const clamp01 = (x: number) => Math.min(1, Math.max(0, x));
const easeIn = (x: number) => x * x;
function easeOutBack(x: number) {
  const c = 1.7;
  return 1 + (c + 1) * (x - 1) ** 3 + c * (x - 1) ** 2;
}

export interface RowsTransition {
  /** Сколько рядов сейчас нарисовано (во время исчезновения ещё старое число). */
  shown: Rows;
  /** Масштаб появления/исчезновения для ряда `row` нарисованной пирамиды; для ячеек row = rows. */
  scaleFor(row: number, nowSec: number): number;
}

export function useRowsTransition(rows: Rows): RowsTransition {
  const [shown, setShown] = useState(rows);
  const state = useRef({ phase: 'idle' as 'idle' | 'out' | 'in', t0: 0, shown: rows });

  useEffect(() => {
    const s = state.current;
    if (rows === s.shown && s.phase === 'idle') return;
    const now = performance.now() / 1000;
    s.phase = 'out';
    s.t0 = now;
    const outTotal = OUT_STEP * s.shown + OUT_DUR;
    const timer = setTimeout(() => {
      s.phase = 'in';
      s.t0 = performance.now() / 1000;
      s.shown = rows;
      setShown(rows);
    }, outTotal * 1000);
    return () => clearTimeout(timer);
  }, [rows]);

  return {
    shown,
    scaleFor(row, nowSec) {
      const s = state.current;
      const t = nowSec - s.t0;
      if (s.phase === 'out') return 1 - easeIn(clamp01((t - (s.shown - row) * OUT_STEP) / OUT_DUR));
      if (s.phase === 'in') {
        const k = clamp01((t - row * IN_STEP) / IN_DUR);
        if (row >= s.shown && k >= 1) s.phase = 'idle';
        return Math.max(0, easeOutBack(k));
      }
      return 1;
    },
  };
}
