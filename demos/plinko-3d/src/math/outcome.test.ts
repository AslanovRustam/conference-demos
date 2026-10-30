import { createRng } from '../core/rng';
import { bigCells, pickForcedBig, pickGuaranteedBig, pickSlot } from './outcome';
import { getPaytable } from './paytable';

test('pickSlot follows weights (100k draws)', () => {
  const t = getPaytable('high', 12);
  const rng = createRng(7);
  const n = 100_000;
  const counts = new Array(13).fill(0);
  for (let i = 0; i < n; i++) counts[pickSlot(t, rng)]++;
  counts.forEach((c, k) => expect(Math.abs(c / n - t.weights[k])).toBeLessThan(Math.max(0.003, t.weights[k] * 0.25)));
});

test('guaranteed big win: BIG or MEGA cells when the table has them', () => {
  const rng = createRng(5);
  const t = getPaytable('high', 12);
  const ms = Array.from({ length: 300 }, () => t.multipliers[pickGuaranteedBig(t, rng)]);
  ms.forEach((m) => expect(m).toBeGreaterThanOrEqual(25));
  expect(ms.some((m) => m >= 100)).toBe(true); // MEGA
  expect(ms.some((m) => m < 100)).toBe(true); // BIG
});

test('guaranteed big win on a table without BIG cells takes the top cell', () => {
  const rng = createRng(6);
  const t = getPaytable('low', 8);
  for (let i = 0; i < 50; i++) expect([0, 8]).toContain(pickGuaranteedBig(t, rng));
});

test('forced big goes to an edge cell (spec §6)', () => {
  const rng = createRng(4);
  const t = getPaytable('high', 12);
  const seen = new Set<number>();
  for (let i = 0; i < 200; i++) seen.add(pickForcedBig(t, rng)!);
  expect([...seen].sort((a, b) => a - b)).toEqual([0, 12]);
});

test('forced big picks only >=25x cells, null when none', () => {
  const rng = createRng(3);
  const hi = getPaytable('high', 8);
  for (let i = 0; i < 200; i++) expect(hi.multipliers[pickForcedBig(hi, rng)!]).toBeGreaterThanOrEqual(25);
  expect(pickForcedBig(getPaytable('low', 8), rng)).toBeNull();
  expect(bigCells(getPaytable('low', 16))).toEqual([]);
});
