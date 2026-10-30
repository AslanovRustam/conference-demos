import { VoicePool, rowFrequency } from './scale';

test('row notes ascend within pentatonic', () => {
  const f = Array.from({ length: 16 }, (_, r) => rowFrequency(r));
  f.slice(1).forEach((v, i) => expect(v).toBeGreaterThan(f[i]));
  expect(f[0]).toBeCloseTo(220);
  expect(f[5]).toBeCloseTo(440);
  expect(f[15]).toBeCloseTo(1760);
});

test('voice pool steals oldest when full', () => {
  const p = new VoicePool(2);
  expect(p.acquire(0)).toEqual({ index: 0, stolen: false });
  expect(p.acquire(1)).toEqual({ index: 1, stolen: false });
  const r = p.acquire(2);
  expect(r.stolen).toBe(true);
  expect(r.index).toBe(0);
});

test('released voices are reused before stealing', () => {
  const p = new VoicePool(2);
  p.acquire(0);
  p.acquire(1);
  p.release(1);
  expect(p.acquire(2)).toEqual({ index: 1, stolen: false });
});
