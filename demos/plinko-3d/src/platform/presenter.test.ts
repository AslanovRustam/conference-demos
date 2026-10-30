import { presenterAction } from './presenter';

const k = (code: string, o: Partial<KeyboardEvent> = {}) => ({
  code,
  shiftKey: false,
  ctrlKey: false,
  altKey: false,
  metaKey: false,
  repeat: false,
  ...o,
});

test('presenter keys', () => {
  expect(presenterAction(k('KeyB', { shiftKey: true }))).toBe('forceBig');
  expect(presenterAction(k('KeyR', { shiftKey: true }))).toBe('freeRain');
  expect(presenterAction(k('KeyB'))).toBeNull();
  expect(presenterAction(k('KeyR', { shiftKey: true, ctrlKey: true }))).toBeNull();
  expect(presenterAction(k('KeyB', { shiftKey: true, repeat: true }))).toBeNull();
  expect(presenterAction(k('Space', { shiftKey: true }))).toBeNull();
});
