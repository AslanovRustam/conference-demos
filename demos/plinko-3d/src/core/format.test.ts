import { formatCredits, formatMultiplier } from './format';

test('credits', () => {
  expect(formatCredits(10000)).toBe('10,000');
  expect(formatCredits(1234567)).toBe('1,234,567');
  expect(formatCredits(0)).toBe('0');
});

test('multipliers', () => {
  expect(formatMultiplier(0.3)).toBe('0.3x');
  expect(formatMultiplier(29)).toBe('29x');
  expect(formatMultiplier(1.5)).toBe('1.5x');
  expect(formatMultiplier(1000)).toBe('1000x');
});
