import { createRng } from '../core/rng';
import { bigCells, createBigWinCycle, pickForcedBig, pickSlot } from './outcome';
import { getPaytable } from './paytable';

test('pickSlot follows weights (100k draws)', () => {
  const t = getPaytable('high', 12);
  const rng = createRng(7);
  const n = 100_000;
  const counts = new Array(13).fill(0);
  for (let i = 0; i < n; i++) counts[pickSlot(t, rng)]++;
  counts.forEach((c, k) => expect(Math.abs(c / n - t.weights[k])).toBeLessThan(Math.max(0.003, t.weights[k] * 0.25)));
});

// Каждый 5-й бросок раньше чаще всего падал в одну и ту же ячейку (×30): теперь он обходит все крупные ячейки
const side = (slot: number, rows: number) => (slot < rows / 2 ? 'L' : 'R');

test('guaranteed big wins visit every big cell before any repeats', () => {
  const rng = createRng(5);
  const t = getPaytable('high', 16);
  const cycle = createBigWinCycle();
  const cells = bigCells(t);
  for (let round = 0; round < 3; round++) {
    const picks = cells.map(() => cycle.next(t, rng));
    expect([...picks].sort((a, b) => a - b)).toEqual(cells);
  }
});

test('guaranteed big wins on high risk, 16 rows land in 30x, 100x and 500x on both sides', () => {
  const rng = createRng(9);
  const t = getPaytable('high', 16);
  const cycle = createBigWinCycle();
  const picks = Array.from({ length: 6 }, () => cycle.next(t, rng));
  expect([...new Set(picks.map((k) => t.multipliers[k]))].sort((a, b) => a - b)).toEqual([30, 100, 500]);
  expect(new Set(picks.map((k) => side(k, 16))).size).toBe(2);
});

test('guaranteed big wins alternate sides: left, right, left…', () => {
  const rng = createRng(11);
  const t = getPaytable('medium', 16);
  const cycle = createBigWinCycle();
  const sides = Array.from({ length: 24 }, () => side(cycle.next(t, rng), 16));
  sides.slice(1).forEach((s, i) => expect(s).not.toBe(sides[i]));
});

test('a table without big cells alternates the two edge cells', () => {
  const rng = createRng(6);
  const t = getPaytable('low', 8);
  const cycle = createBigWinCycle();
  const picks = Array.from({ length: 10 }, () => cycle.next(t, rng));
  picks.forEach((k) => expect([0, 8]).toContain(k));
  picks.slice(1).forEach((k, i) => expect(k).not.toBe(picks[i]));
});

test('changing rows or risk restarts the cycle on the new table', () => {
  const rng = createRng(2);
  const cycle = createBigWinCycle();
  cycle.next(getPaytable('high', 16), rng);
  const t = getPaytable('medium', 12);
  for (let i = 0; i < 8; i++) expect(bigCells(t)).toContain(cycle.next(t, rng));
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
