import { createRng } from '../core/rng';
import type { Rows } from '../core/types';
import { buildDecisions } from './decisions';
import { BALL_RADIUS, PEG_RADIUS, boardLayout } from './layout';
import { buildTrajectory, sampleTrajectory } from './trajectory';

const make = (rows: Rows, slot: number, seed: number) => {
  const rng = createRng(seed);
  const L = boardLayout(rows);
  return { L, tr: buildTrajectory(L, buildDecisions(rows, slot, rng), rng) };
};

test('contacts follow decisions and land in slot', () => {
  const { L, tr } = make(12, 9, 5);
  expect(tr.contacts[0]).toMatchObject({ row: 0, index: 1 });
  const rows = [...new Set(tr.contacts.map((c) => c.row))];
  expect(rows).toEqual([...Array(12).keys()]);
  const s = sampleTrajectory(tr, tr.landT);
  expect(Math.abs(s.x - L.slots[9].x)).toBeLessThanOrEqual(0.1);
  expect(tr.slot).toBe(9);
});

test('continuous at segment boundaries', () => {
  const { tr } = make(14, 3, 9);
  tr.segments.slice(1).forEach((sg) => {
    const a = sampleTrajectory(tr, sg.t0 - 1e-7);
    const b = sampleTrajectory(tr, sg.t0 + 1e-7);
    expect(Math.hypot(a.x - b.x, a.y - b.y)).toBeLessThan(1e-4);
  });
});

test('no energy gain at bounces', () => {
  for (let seed = 0; seed < 200; seed++) {
    make(16, seed % 17, seed)
      .tr.contacts.slice(1)
      .filter((c) => !c.micro)
      .forEach((c) => expect(c.speedOut).toBeLessThanOrEqual(c.speedIn * 0.85 + 1e-9));
  }
});

test('never penetrates pegs', () => {
  for (let seed = 0; seed < 100; seed++) {
    const { L, tr } = make(16, seed % 17, seed);
    for (let t = 0; t <= tr.landT; t += 0.005) {
      const s = sampleTrajectory(tr, t);
      for (const p of L.pegs) {
        const d = Math.hypot(s.x - p.x, s.y - p.y);
        if (d < PEG_RADIUS + BALL_RADIUS - 0.02) throw new Error(`seed ${seed} t=${t.toFixed(3)} peg ${p.row}/${p.index} d=${d.toFixed(3)}`);
      }
    }
  }
});

test('durations', () => {
  expect(make(8, 4, 1).tr.landT).toBeGreaterThan(1.2);
  const t12 = make(12, 6, 1).tr.landT;
  expect(t12).toBeGreaterThan(2.0);
  expect(t12).toBeLessThan(4.5);
  expect(make(16, 8, 1).tr.landT).toBeLessThan(5.5);
});

test('ball settles after landing', () => {
  const { L, tr } = make(12, 2, 3);
  expect(tr.endT).toBeGreaterThan(tr.landT);
  const end = sampleTrajectory(tr, tr.endT + 1);
  expect(Math.abs(end.x - L.slots[2].x)).toBeLessThanOrEqual(0.1);
});

test('deterministic per seed', () => {
  expect(make(12, 2, 77).tr).toEqual(make(12, 2, 77).tr);
});

test('double bounce rate ~12%', () => {
  let extra = 0;
  let rows = 0;
  for (let seed = 0; seed < 2000; seed++) {
    const { tr } = make(12, seed % 13, seed);
    extra += tr.contacts.length - 12;
    rows += 11;
  }
  expect(extra / rows).toBeGreaterThan(0.09);
  expect(extra / rows).toBeLessThan(0.15);
});
