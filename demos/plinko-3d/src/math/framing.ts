import type { BoardLayout } from './layout';

export interface Insets {
  top: number;
  right: number;
  bottom: number;
  left: number;
}

export interface Framing {
  x: number;
  y: number;
  z: number;
  targetX: number;
  targetY: number;
}

/** Камера смотрит прямо на плоскость z = 0; пирамида вписывается в область без интерфейса. */
export function computeFraming(
  bounds: BoardLayout['bounds'],
  viewport: { width: number; height: number },
  insets: Insets,
  fovDeg: number,
  margin = 0.6,
): Framing {
  const freeW = Math.max(1, viewport.width - insets.left - insets.right);
  const freeH = Math.max(1, viewport.height - insets.top - insets.bottom);
  const boardW = bounds.maxX - bounds.minX + 2 * margin;
  const boardH = bounds.maxY - bounds.minY + 2 * margin;
  const pxPerUnit = Math.min(freeW / boardW, freeH / boardH);
  const z = viewport.height / pxPerUnit / (2 * Math.tan((fovDeg * Math.PI) / 360));

  const cx = (bounds.minX + bounds.maxX) / 2;
  const cy = (bounds.minY + bounds.maxY) / 2;
  const dx = insets.left + freeW / 2 - viewport.width / 2;
  const dy = insets.top + freeH / 2 - viewport.height / 2;
  const x = cx - dx / pxPerUnit;
  const y = cy + dy / pxPerUnit;
  return { x, y, z, targetX: x, targetY: y };
}
