import type { Rows } from '../core/types';
import { computeFraming } from '../math/framing';
import { boardLayout } from '../math/layout';
import { hudInsets, orientationOf, readSafeArea } from '../ui/layoutMetrics';

export const CAMERA_FOV = 35;

/** Кадр камеры: пирамида вписана в область экрана, свободную от интерфейса. */
export function boardFraming(rows: Rows, viewport: { width: number; height: number }) {
  // На вертикальном телефоне каждая доля ширины на счету: поля кадра меньше
  const margin = orientationOf(viewport) === 'portrait' ? 0.25 : 0.6;
  return computeFraming(boardLayout(rows).bounds, viewport, hudInsets(viewport, readSafeArea()), CAMERA_FOV, margin);
}
