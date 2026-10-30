import type { Rows } from '../../core/types';
import { boardLayout } from '../../math/layout';
import { boardFraming } from '../boardFraming';

/**
 * Центр и масштаб камня интро. Интерфейса во время интро нет, а кадр доски сдвинут под панели HUD,
 * поэтому камень ставится в центр экрана (камера смотрит прямо на z = 0, центр экрана — это framing.x/y).
 * Размер — по меньшей стороне доски: на телефоне это ширина.
 */
export function crystalFrame(rows: Rows, viewport: { width: number; height: number }) {
  const { bounds } = boardLayout(rows);
  const height = bounds.maxY - bounds.minY;
  const width = bounds.maxX - bounds.minX;
  const framing = boardFraming(rows, viewport);
  return { cx: framing.x, cy: framing.y + height * 0.04, scale: Math.min(height, width) * 0.3 };
}
