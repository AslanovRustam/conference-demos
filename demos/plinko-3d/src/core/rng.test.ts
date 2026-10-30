import { createRng, seedFromSearch } from './rng';

test('same seed, same sequence', () => {
  const a = createRng(42);
  const b = createRng(42);
  expect(Array.from({ length: 5 }, () => a.next())).toEqual(Array.from({ length: 5 }, () => b.next()));
});

test('next in [0,1), int in range', () => {
  const r = createRng(1);
  for (let i = 0; i < 10000; i++) {
    const v = r.next();
    expect(v).toBeGreaterThanOrEqual(0);
    expect(v).toBeLessThan(1);
    expect(r.int(7)).toBeLessThan(7);
  }
});

test('range and chance', () => {
  const r = createRng(9);
  for (let i = 0; i < 1000; i++) {
    const v = r.range(2, 3);
    expect(v).toBeGreaterThanOrEqual(2);
    expect(v).toBeLessThan(3);
  }
  expect(r.chance(0)).toBe(false);
  expect(r.chance(1)).toBe(true);
});

test('seedFromSearch', () => {
  expect(seedFromSearch('?seed=123')).toBe(123);
  expect(seedFromSearch('?x=1')).toBeNull();
});
