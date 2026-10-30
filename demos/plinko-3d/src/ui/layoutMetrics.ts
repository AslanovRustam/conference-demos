import type { Insets } from '../math/framing';

export type Orientation = 'portrait' | 'landscape';

export function orientationOf(v: { width: number; height: number }): Orientation {
  return v.height > v.width ? 'portrait' : 'landscape';
}

const clamp = (x: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, x));

/** Пиксели, занятые интерфейсом по краям. Те же числа HUD кладёт в CSS-переменные. */
export function hudInsets(v: { width: number; height: number }): Insets {
  if (orientationOf(v) === 'portrait') return { top: 72, right: 8, bottom: 232, left: 8 };
  return { top: 24, right: clamp(0.13 * v.width, 160, 280), bottom: 24, left: clamp(0.2 * v.width, 240, 420) };
}
