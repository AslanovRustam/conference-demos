import { BETS, DEFAULT_BET, START_BALANCE, DEFAULT_ROWS, DEFAULT_RISK } from './config';

test('defaults match spec', () => {
  expect(START_BALANCE).toBe(10000);
  expect(BETS).toContain(DEFAULT_BET);
  expect(DEFAULT_ROWS).toBe(12);
  expect(DEFAULT_RISK).toBe('high');
});
