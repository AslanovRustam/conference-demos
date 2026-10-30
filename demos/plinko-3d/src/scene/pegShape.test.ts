import { BALL_RADIUS, PEG_RADIUS } from '../math/layout';
import { Euler } from 'three';
import { HIT_PULSE, PEG_VISUAL_RADIUS, PEG_VISUAL_STRETCH_Y, pegEuler } from './pegShape';

test('a pulsing crystal barely overlaps the ball at contact', () => {
  // Самая далёкая вершина кристалла при полной вспышке против поверхности шарика в момент касания
  const extent = PEG_VISUAL_RADIUS * PEG_VISUAL_STRETCH_Y * (1 + HIT_PULSE);
  const ballSurface = PEG_RADIUS + BALL_RADIUS - BALL_RADIUS; // = PEG_RADIUS
  expect(extent - ballSurface).toBeLessThanOrEqual(0.06);
});

test('shared peg rotation: same crystal, same time, same pose', () => {
  const a = pegEuler(5, 1.25, new Euler());
  const b = pegEuler(5, 1.25, new Euler());
  expect(a.equals(b)).toBe(true);
  expect(pegEuler(6, 1.25, new Euler()).equals(a)).toBe(false);
  expect(pegEuler(5, 2.25, new Euler()).y - a.y).toBeCloseTo(0.15);
});
