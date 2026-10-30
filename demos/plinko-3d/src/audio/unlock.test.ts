import { bindUnlock } from './unlock';

test.each(['pointerdown', 'pointerup', 'touchend', 'click', 'keydown'])('%s unlocks audio', (type) => {
  const target = new EventTarget();
  let calls = 0;
  const off = bindUnlock(target, () => calls++);
  target.dispatchEvent(new Event(type));
  expect(calls).toBe(1);
  off();
  target.dispatchEvent(new Event(type));
  expect(calls).toBe(1);
});
