import { ANTICIPATION_SECONDS, anticipation, breath } from './slotLife';

const ball = (slot: number, t: number, landT: number, kind: 'player' | 'rain' | 'demo' = 'player') => ({ slot, t, kind, traj: { landT } });

test('anticipation ramps up during the last second before landing', () => {
  const far = anticipation([ball(3, 1, 4)], 9);
  expect(far[3]).toBe(0);
  const mid = anticipation([ball(3, 4 - ANTICIPATION_SECONDS / 2, 4)], 9);
  expect(mid[3]).toBeGreaterThan(0.3);
  expect(mid[3]).toBeLessThan(0.8);
  const at = anticipation([ball(3, 4, 4)], 9);
  expect(at[3]).toBeCloseTo(1);
  expect(at[2]).toBe(0);
});

test('anticipation ignores rain balls and keeps the strongest ball per slot', () => {
  const a = anticipation([ball(1, 3.9, 4, 'rain'), ball(5, 3.5, 4), ball(5, 3.95, 4)], 9);
  expect(a[1]).toBe(0);
  expect(a[5]).toBeGreaterThan(0.9);
});

test('anticipation fades after landing', () => {
  expect(anticipation([ball(2, 5, 4)], 9)[2]).toBe(0);
});

test('breath is a wave travelling along the row', () => {
  for (let k = 0; k < 13; k++) {
    const v = breath(k, 0.7);
    expect(v).toBeGreaterThanOrEqual(0);
    expect(v).toBeLessThanOrEqual(1);
  }
  expect(breath(0, 1)).not.toBeCloseTo(breath(3, 1));
  expect(breath(2, 1 + (2 * 0.55) / 1.8)).toBeCloseTo(breath(0, 1), 5); // камень 2 повторяет фазу камня 0 с задержкой
});
