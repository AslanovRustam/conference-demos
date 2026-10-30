import { gemColor, pegHue } from './palette';

test('gem colors by multiplier', () => {
  expect(gemColor(100)).toBe('#e0115f');
  expect(gemColor(30)).toBe('#9b30ff');
  expect(gemColor(8)).toBe('#2d6bff');
  expect(gemColor(3)).toBe('#00c2a8');
  expect(gemColor(1.2)).toBe('#7a5cff');
  expect(gemColor(0.3)).toBe('#c7c3ff');
});

test('peg hue stays in [0,1)', () => {
  for (let i = 0; i < 200; i++) {
    const h = pegHue(i, i * 0.37);
    expect(h).toBeGreaterThanOrEqual(0);
    expect(h).toBeLessThan(1);
  }
});
