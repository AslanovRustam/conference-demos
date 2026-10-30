import { ROWS_LIST, type Risk, type Rows } from '../core/types';
import { tierOf, type Tier } from './tiers';

export interface Paytable {
  risk: Risk;
  rows: Rows;
  multipliers: readonly number[];
  weights: readonly number[];
}

// Половины таблиц от края к центру. Таблицы симметричны, вторая половина зеркальная.
// Подобраны под щедрый демо-режим (спека, раздел 6): RTP 105–220%, ячейки ≥1x не реже 30% бросков.
const HALVES: Record<Risk, Record<Rows, number[]>> = {
  high: {
    8: [100, 25, 5, 1.5, 0.3],
    9: [100, 26, 6, 1.5, 0.3],
    10: [110, 28, 7, 1.5, 0.5, 0.2],
    11: [120, 26, 6, 1.5, 0.5, 0.2],
    12: [200, 100, 25, 6, 1.5, 0.4, 0.2],
    13: [250, 100, 26, 6, 1.5, 0.5, 0.2],
    14: [300, 100, 26, 7, 2, 1.1, 0.4, 0.2],
    15: [400, 100, 26, 7, 2, 1.1, 0.4, 0.2],
    16: [500, 100, 30, 10, 5, 2, 1, 0.4, 0.2],
  },
  medium: {
    8: [25, 6, 2, 1.1, 0.5],
    9: [25, 6, 1.8, 1, 0.5],
    10: [26, 8, 3, 1.3, 0.7, 0.4],
    11: [28, 10, 3, 1.5, 0.8, 0.5],
    12: [30, 12, 5, 2, 1.1, 0.6, 0.4],
    13: [40, 15, 6, 2.5, 1.3, 0.7, 0.4],
    14: [120, 30, 8, 3, 1.5, 1, 0.5, 0.3],
    15: [150, 35, 10, 4, 2, 1.1, 0.6, 0.3],
    16: [200, 40, 12, 5, 3, 1.4, 1, 0.5, 0.3],
  },
  low: {
    8: [6, 3, 1.4, 1.1, 0.5],
    9: [7, 3, 1.6, 1.1, 0.7],
    10: [8, 3, 2, 1.3, 1.1, 0.5],
    11: [8.5, 3.5, 2, 1.3, 1, 0.6],
    12: [10, 4, 2, 1.4, 1.1, 1, 0.5],
    13: [11, 5, 3, 2, 1.4, 1.1, 0.7],
    14: [12, 5, 3, 2, 1.5, 1.2, 1.1, 0.7],
    15: [14, 6, 3.5, 2.2, 1.6, 1.3, 1.1, 0.7],
    16: [16, 8, 4, 2.5, 1.8, 1.4, 1.2, 1.1, 0.7],
  },
};

function mirror(half: readonly number[], rows: Rows): number[] {
  return Array.from({ length: rows + 1 }, (_, k) => half[Math.min(k, rows - k)]);
}

export const MULTIPLIERS = Object.fromEntries(
  Object.entries(HALVES).map(([risk, byRows]) => [
    risk,
    Object.fromEntries(ROWS_LIST.map((rows) => [rows, mirror(byRows[rows], rows)])),
  ]),
) as unknown as Record<Risk, Record<Rows, readonly number[]>>;

export function tierTargets(risk: Risk, rows: Rows): Partial<Record<Tier, number>> {
  if (risk === 'high') return { mega: 0.005, big: 0.0167, large: 0.058, normal: 0.25 };
  if (risk === 'medium') {
    return rows >= 14
      ? { mega: 0.0017, big: 0.0067, large: 0.043, normal: 0.32 }
      : { big: 0.0067, large: 0.043, normal: 0.32 };
  }
  return { large: 0.025, normal: 0.5 };
}

function binomial(n: number, k: number): number {
  let r = 1;
  for (let i = 1; i <= k; i++) r = (r * (n - k + i)) / i;
  return r;
}

// Внутри уровня сохраняется биномиальная форма, а суммарная частота уровня задаётся целью.
// sub получает остаток до 1.
export function weightsFor(multipliers: readonly number[], rows: Rows, targets: Partial<Record<Tier, number>>): number[] {
  const goal: Partial<Record<Tier, number>> = { ...targets };
  goal.sub = 1 - Object.values(targets).reduce((a, b) => a + (b ?? 0), 0);

  const groups = new Map<Tier, number[]>();
  multipliers.forEach((m, k) => {
    const tier = tierOf(m);
    groups.set(tier, [...(groups.get(tier) ?? []), k]);
  });

  for (const [tier, p] of Object.entries(goal) as [Tier, number][]) {
    if (p > 0 && !groups.has(tier)) throw new Error(`target for ${tier} but no cells`);
  }

  const base = multipliers.map((_, k) => binomial(rows, k));
  const weights = new Array<number>(multipliers.length).fill(0);
  for (const [tier, cells] of groups) {
    const p = goal[tier];
    if (!p || p <= 0) throw new Error(`cells of tier ${tier} but no target`);
    const sum = cells.reduce((a, k) => a + base[k], 0);
    for (const k of cells) weights[k] = (p * base[k]) / sum;
  }
  return weights;
}

const cache = new Map<string, Paytable>();

export function getPaytable(risk: Risk, rows: Rows): Paytable {
  const key = `${risk}/${rows}`;
  let t = cache.get(key);
  if (!t) {
    const multipliers = MULTIPLIERS[risk][rows];
    t = { risk, rows, multipliers, weights: weightsFor(multipliers, rows, tierTargets(risk, rows)) };
    cache.set(key, t);
  }
  return t;
}

export function rtp(t: Paytable): number {
  return t.multipliers.reduce((a, m, k) => a + m * t.weights[k], 0);
}

export function probability(t: Paytable, pred: (tier: Tier) => boolean): number {
  return t.multipliers.reduce((a, m, k) => a + (pred(tierOf(m)) ? t.weights[k] : 0), 0);
}
