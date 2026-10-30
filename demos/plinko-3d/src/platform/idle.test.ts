import { IdleTimer } from './idle';

test('idle timer', () => {
  let t = 0;
  const it = new IdleTimer(45000, () => t);
  t = 44999;
  expect(it.isIdle()).toBe(false);
  t = 45000;
  expect(it.isIdle()).toBe(true);
  it.poke();
  expect(it.isIdle()).toBe(false);
});
