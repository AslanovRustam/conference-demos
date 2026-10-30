import { dprRange, initialQuality } from './quality';

test('initial quality', () => {
  expect(initialQuality({ coarsePointer: true, maxTouchPoints: 5 })).toBe('light');
  expect(initialQuality({ coarsePointer: false, maxTouchPoints: 0, renderer: 'ANGLE (Intel Iris Xe)' })).toBe('high');
  expect(initialQuality({ coarsePointer: false, maxTouchPoints: 0, renderer: 'Google SwiftShader' })).toBe('light');
  expect(initialQuality({ coarsePointer: true, maxTouchPoints: 5, override: 'high' })).toBe('high');
  expect(initialQuality({ coarsePointer: false, maxTouchPoints: 0, override: 'light' })).toBe('light');
  expect(initialQuality({ coarsePointer: false, maxTouchPoints: 0, override: 'bogus' })).toBe('high');
});

test('dpr ranges', () => {
  expect(dprRange('high')).toEqual([1, 2]);
  expect(dprRange('light')).toEqual([1, 1.5]);
});
