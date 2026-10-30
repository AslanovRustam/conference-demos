import { boardLayout, pegCount } from '../math/layout';
import { GlowField } from './glowField';
import { WaveField, waveIntensity } from './wave';

test('wave ring travels outward', () => {
  expect(waveIntensity(1.4, 0.1)).toBeCloseTo(1); // радиус 1.4
  expect(waveIntensity(1.4 + 0.35, 0.1)).toBeCloseTo(0.5);
  expect(waveIntensity(3, 0.1)).toBe(0);
  expect(waveIntensity(1, 5)).toBe(0);
});

test('wave field lights pegs on the ring and expires', () => {
  const L = boardLayout(8);
  const g = new GlowField(pegCount(16));
  const w = new WaveField();
  w.add(L.slots[0].x, L.slots[0].y, 1);
  w.update(0.2);
  w.apply(L.pegs, g);
  expect(Math.max(...g.values)).toBeGreaterThan(0.5);
  w.update(5);
  expect(w.active).toBe(0);
});

test('wave intensity scales glow', () => {
  const L = boardLayout(8);
  const g = new GlowField(pegCount(16));
  const w = new WaveField();
  w.add(L.slots[4].x, L.slots[4].y, 0.6);
  w.update(0.2);
  w.apply(L.pegs, g);
  expect(Math.max(...g.values)).toBeLessThanOrEqual(0.6 + 1e-6);
});
