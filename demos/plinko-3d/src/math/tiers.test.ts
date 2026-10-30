import { TIER_RANK, tierOf } from './tiers';

test('tier thresholds', () => {
  expect(tierOf(0.99)).toBe('sub');
  expect(tierOf(1)).toBe('normal');
  expect(tierOf(4.9)).toBe('normal');
  expect(tierOf(5)).toBe('large');
  expect(tierOf(24.9)).toBe('large');
  expect(tierOf(25)).toBe('big');
  expect(tierOf(99)).toBe('big');
  expect(tierOf(100)).toBe('mega');
});

test('tier ranks ascend', () => {
  expect(TIER_RANK.sub).toBeLessThan(TIER_RANK.normal);
  expect(TIER_RANK.normal).toBeLessThan(TIER_RANK.large);
  expect(TIER_RANK.large).toBeLessThan(TIER_RANK.big);
  expect(TIER_RANK.big).toBeLessThan(TIER_RANK.mega);
});
