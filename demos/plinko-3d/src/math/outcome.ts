import type { Rng } from '../core/rng';
import type { Paytable } from './paytable';

export function pickSlot(t: Paytable, rng: Rng): number {
  let r = rng.next();
  for (let k = 0; k < t.weights.length; k++) {
    r -= t.weights[k];
    if (r < 0) return k;
  }
  return t.weights.length - 1;
}

export function bigCells(t: Paytable): number[] {
  return t.multipliers.flatMap((m, k) => (m >= 25 ? [k] : []));
}

/** Ведущий: шарик в крайнюю ячейку (спека, раздел 6); null, если на краю нет множителя ≥ 25x. */
export function pickForcedBig(t: Paytable, rng: Rng): number | null {
  const last = t.multipliers.length - 1;
  if (t.multipliers[0] < 25) return null;
  return rng.chance(0.5) ? 0 : last;
}
