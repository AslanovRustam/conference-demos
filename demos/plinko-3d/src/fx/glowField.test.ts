import { GlowField } from './glowField';

test('glow field hit keeps max and decays to zero', () => {
  const g = new GlowField(4);
  g.hit(1, 0.6);
  g.hit(1, 0.4);
  expect(g.values[1]).toBeCloseTo(0.6);
  g.decay(0.1);
  expect(g.values[1]).toBeCloseTo(0.6 - 0.22);
  g.decay(10);
  expect(g.values[1]).toBe(0);
});

test('hit defaults to full and clear resets', () => {
  const g = new GlowField(3);
  g.hit(2);
  expect(g.values[2]).toBe(1);
  g.clear();
  expect(Array.from(g.values)).toEqual([0, 0, 0]);
});
