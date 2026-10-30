import { boardFraming } from '../boardFraming';
import { crystalFrame } from './crystalFrame';

// Во время интро интерфейса нет, а кадр доски сдвинут под панели HUD. Камень должен стоять в центре экрана:
// камера смотрит прямо на плоскость z = 0, значит центр экрана — это (framing.x, framing.y).
test('desktop: the gem is centred on screen, not on the board shifted for the side panels', () => {
  const viewport = { width: 1905, height: 960 };
  const framing = boardFraming(16, viewport);
  expect(Math.abs(framing.x)).toBeGreaterThan(0.5); // доска действительно сдвинута
  expect(crystalFrame(16, viewport).cx).toBeCloseTo(framing.x, 6);
});

test('portrait phone: the gem sits near the screen centre, not up where the board is pushed by the bottom HUD', () => {
  const viewport = { width: 390, height: 844 };
  const framing = boardFraming(12, viewport);
  const frame = crystalFrame(12, viewport);
  expect(frame.cx).toBeCloseTo(framing.x, 6);
  expect(Math.abs(frame.cy - framing.y)).toBeLessThan(frame.scale * 0.3);
});
