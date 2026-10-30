import type { BallKind } from '../core/types';

/** За сколько секунд до приземления камень начинает «ждать» шарик. */
export const ANTICIPATION_SECONDS = 1;

const BREATH_SPEED = 1.8;
const BREATH_PHASE = 0.55;

/** «Дыхание» камней: мягкая волна света бежит вдоль ряда, 0…1. */
export function breath(slot: number, timeSec: number): number {
  return 0.5 + 0.5 * Math.sin(timeSec * BREATH_SPEED - slot * BREATH_PHASE);
}

/** Насколько каждый камень ждёт шарик (0…1): рост в последнюю секунду перед приземлением. Дождь не в счёт. */
export function anticipation(
  balls: readonly { slot: number; t: number; kind: BallKind; traj: { landT: number } }[],
  slots: number,
): Float32Array {
  const out = new Float32Array(slots);
  for (const b of balls) {
    if (b.kind === 'rain') continue;
    const left = b.traj.landT - b.t;
    if (left < 0 || left > ANTICIPATION_SECONDS) continue;
    const k = 1 - left / ANTICIPATION_SECONDS;
    const v = k * k * (3 - 2 * k);
    if (v > out[b.slot]) out[b.slot] = v;
  }
  return out;
}
