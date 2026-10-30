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

export interface BigWinCycle {
  next(t: Paytable, rng: Rng): number;
}

/**
 * Гарантированный крупный выигрыш (каждый 5-й бросок) обходит по кругу все ячейки от 25x в случайном порядке:
 * ни одна не повторяется, пока не выпали остальные, а стороны чередуются — слева, справа, слева…
 * На high/16 за шесть таких бросков выпадают 500x, 100x и 30x с обеих сторон. Без ячеек от 25x — крайние по очереди.
 * Смена рядов или риска начинает круг заново на новой таблице.
 */
export function createBigWinCycle(): BigWinCycle {
  let table = '';
  let bag: number[] = [];
  let lastSide = 0;
  return {
    next(t, rng) {
      const last = t.multipliers.length - 1;
      const key = t.multipliers.join(',');
      if (key !== table) {
        table = key;
        bag = [];
      }
      if (!bag.length) {
        const cells = bigCells(t);
        bag = cells.length ? cells : [0, last];
        for (let i = bag.length - 1; i > 0; i--) {
          const j = rng.int(i + 1);
          [bag[i], bag[j]] = [bag[j], bag[i]];
        }
      }
      const sideOf = (slot: number) => (slot < last / 2 ? -1 : 1);
      const i = Math.max(0, bag.findIndex((slot) => sideOf(slot) !== lastSide));
      const [slot] = bag.splice(i, 1);
      lastSide = sideOf(slot);
      return slot;
    },
  };
}
