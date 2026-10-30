import { createRng } from '../core/rng';
import { bigCells, pickForcedBig, pickSlot } from './outcome';
import { getPaytable } from './paytable';

test('pickSlot follows weights (100k draws)', () => {
  const t = getPaytable('high', 12);
  const rng = createRng(7);
  const n = 100_000;
  const counts = new Array(13).fill(0);
  for (let i = 0; i < n; i++) counts[pickSlot(t, rng)]++;
  counts.forEach((c, k) => expect(Math.abs(c / n - t.weights[k])).toBeLessThan(Math.max(0.003, t.weights[k] * 0.25)));
});

test('forced big picks only >=25x cells, null when none', () => {
  const rng = createRng(3);
  const hi = getPaytable('high', 8);
  for (let i = 0; i < 200; i++) expect(hi.multipliers[pickForcedBig(hi, rng)!]).toBeGreaterThanOrEqual(25);
  expect(pickForcedBig(getPaytable('low', 8), rng)).toBeNull();
  expect(bigCells(getPaytable('low', 16))).toEqual([]);
});
