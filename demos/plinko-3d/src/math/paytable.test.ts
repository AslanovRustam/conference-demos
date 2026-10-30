import { RISKS, ROWS_LIST, type Rows } from '../core/types';
import { MULTIPLIERS, getPaytable, probability, rtp, weightsFor } from './paytable';
import type { Tier } from './tiers';

const all = RISKS.flatMap((risk) => ROWS_LIST.map((rows) => getPaytable(risk, rows)));

test.each(all)('$risk/$rows shape', (t) => {
  const m = t.multipliers;
  expect(m).toHaveLength(t.rows + 1);
  m.forEach((v, i) => expect(v).toBe(m[m.length - 1 - i])); // симметрия
  const c = Math.floor(t.rows / 2);
  for (let i = c; i > 0; i--) expect(m[i - 1]).toBeGreaterThanOrEqual(m[i]); // растёт к краям
  expect(t.weights.reduce((a, b) => a + b, 0)).toBeCloseTo(1, 9);
  t.weights.forEach((w) => expect(w).toBeGreaterThan(0)); // каждая ячейка достижима
  expect(m.some((v) => v < 1)).toBe(true);
});

test.each(all)('$risk/$rows rates and rtp', (t) => {
  const p = (tiers: Tier[]) => probability(t, (x) => tiers.includes(x));
  expect(rtp(t)).toBeGreaterThanOrEqual(1.05);
  expect(rtp(t)).toBeLessThanOrEqual(2.2);
  expect(p(['normal', 'large', 'big', 'mega'])).toBeGreaterThanOrEqual(0.3);
  if (t.risk === 'high') {
    expect(p(['large', 'big', 'mega'])).toBeGreaterThanOrEqual(1 / 15);
    expect(p(['large', 'big', 'mega'])).toBeLessThanOrEqual(1 / 10);
    expect(p(['big'])).toBeCloseTo(1 / 60, 3);
    expect(p(['mega'])).toBeCloseTo(1 / 200, 3);
  }
  if (t.risk === 'medium') {
    expect(p(['big'])).toBeGreaterThan(0);
    expect(p(['mega']) > 0).toBe(t.rows >= 14);
  }
  if (t.risk === 'low') {
    expect(p(['big', 'mega'])).toBe(0);
    expect(p(['large'])).toBeCloseTo(0.025, 3);
  }
});

test.each(RISKS)('%s edge multiplier grows with rows', (risk) => {
  for (let r = 9; r <= 16; r++) {
    expect(MULTIPLIERS[risk][r as Rows][0]).toBeGreaterThanOrEqual(MULTIPLIERS[risk][(r - 1) as Rows][0]);
  }
});

test('weightsFor rejects a tier with cells but no target', () => {
  expect(() => weightsFor([30, 1, 0.5, 1, 30], 4 as Rows, { normal: 0.5 })).toThrow();
});

test('weightsFor rejects a target without cells', () => {
  expect(() => weightsFor([3, 1, 0.5, 1, 3], 4 as Rows, { normal: 0.5, big: 0.01 })).toThrow();
});
