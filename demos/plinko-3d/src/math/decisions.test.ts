import { createRng } from '../core/rng';
import { alternativeSlot, buildDecisions, columnsOf, pegIndexAt } from './decisions';

test.each([0, 3, 6, 12])('decisions reach slot %i', (slot) => {
  const steps = buildDecisions(12, slot, createRng(slot));
  expect(steps).toHaveLength(12);
  expect(steps.filter((s) => s === 1)).toHaveLength(slot);
  const cols = columnsOf(steps);
  expect(cols[0]).toBe(0);
  cols.forEach((c, r) => {
    const i = pegIndexAt(r, c);
    expect(i).toBeGreaterThanOrEqual(0);
    expect(i).toBeLessThan(r + 3);
  });
});

test('lastStep honoured when feasible, alternative slot', () => {
  const s = buildDecisions(12, 5, createRng(1), -1);
  expect(s[11]).toBe(-1);
  expect(alternativeSlot(5, s)).toBe(6);
  expect(buildDecisions(12, 0, createRng(1), 1)[11]).toBe(-1); // нет ни одного +1: lastStep игнорируется
});

test('decisions are shuffled, not sorted', () => {
  const seen = new Set<string>();
  for (let seed = 0; seed < 20; seed++) seen.add(buildDecisions(12, 6, createRng(seed)).join(','));
  expect(seen.size).toBeGreaterThan(10);
});
