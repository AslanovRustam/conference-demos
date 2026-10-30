import { createBus } from './events';

test('on/emit/unsubscribe', () => {
  const bus = createBus<{ a: number }>();
  const got: number[] = [];
  const off = bus.on('a', (v) => got.push(v));
  bus.emit('a', 1);
  off();
  bus.emit('a', 2);
  expect(got).toEqual([1]);
});

test('listener added during emit does not run for that emit', () => {
  const bus = createBus<{ a: number }>();
  const got: string[] = [];
  bus.on('a', () => {
    got.push('first');
    bus.on('a', () => got.push('late'));
  });
  bus.emit('a', 1);
  expect(got).toEqual(['first']);
});
