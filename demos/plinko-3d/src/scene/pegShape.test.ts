import { BALL_RADIUS, PEG_RADIUS } from '../math/layout';
import { HIT_PULSE, PEG_VISUAL_RADIUS, PEG_VISUAL_STRETCH_Y } from './pegShape';

test('a pulsing crystal barely overlaps the ball at contact', () => {
  // Самая далёкая вершина кристалла при полной вспышке против поверхности шарика в момент касания
  const extent = PEG_VISUAL_RADIUS * PEG_VISUAL_STRETCH_Y * (1 + HIT_PULSE);
  const ballSurface = PEG_RADIUS + BALL_RADIUS - BALL_RADIUS; // = PEG_RADIUS
  expect(extent - ballSurface).toBeLessThanOrEqual(0.06);
});
