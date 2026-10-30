import type { Rows } from '../core/types';

// Мировые единицы: шаг между кристаллами в ряду равен 1
export const SPACING = 1;
export const ROW_HEIGHT = 0.92;
export const PEG_RADIUS = 0.15;
export const BALL_RADIUS = 0.2;
export const SLOT_DROP = 0.95;
export const GEM_TOP = 0.18;
export const SPAWN_HEIGHT = 1.6;

const GEM_HALF_WIDTH = 0.45;
const GEM_HEIGHT = 0.32;
/** Нижняя точка камня-ячейки относительно его центра (огранка с наклоном к зрителю). */
export const SLOT_GEM_BOTTOM = -0.27;
/** Центр подписи множителя относительно центра ячейки и половина высоты подписи. */
export const SLOT_LABEL_Y = -0.43;
export const SLOT_LABEL_HALF = 0.15;

export interface Peg {
  row: number;
  index: number;
  flat: number;
  x: number;
  y: number;
}

export interface SlotPos {
  index: number;
  x: number;
  y: number;
}

export interface BoardLayout {
  rows: Rows;
  pegs: Peg[];
  slots: SlotPos[];
  spawn: { x: number; y: number };
  bounds: { minX: number; maxX: number; minY: number; maxY: number };
}

export function pegFlatIndex(row: number, index: number): number {
  return (row * (row + 5)) / 2 + index;
}

export function pegCount(rows: Rows): number {
  return (rows * (rows + 5)) / 2;
}

const cache = new Map<Rows, BoardLayout>();

export function boardLayout(rows: Rows): BoardLayout {
  const cached = cache.get(rows);
  if (cached) return cached;

  const pegs: Peg[] = [];
  for (let row = 0; row < rows; row++) {
    for (let index = 0; index < row + 3; index++) {
      pegs.push({ row, index, flat: pegFlatIndex(row, index), x: (index - (row + 2) / 2) * SPACING, y: -row * ROW_HEIGHT });
    }
  }
  const slotY = -(rows - 1) * ROW_HEIGHT - SLOT_DROP;
  const slots: SlotPos[] = Array.from({ length: rows + 1 }, (_, index) => ({ index, x: (index - rows / 2) * SPACING, y: slotY }));
  const spawn = { x: 0, y: SPAWN_HEIGHT };

  const halfWidth = Math.max((rows + 1) / 2 * SPACING + PEG_RADIUS, (rows / 2) * SPACING + GEM_HALF_WIDTH);
  const layout: BoardLayout = {
    rows,
    pegs,
    slots,
    spawn,
    // Снизу кадр доходит до подписей множителей под камнями
    bounds: { minX: -halfWidth, maxX: halfWidth, minY: slotY + Math.min(-GEM_HEIGHT / 2, SLOT_LABEL_Y - SLOT_LABEL_HALF), maxY: SPAWN_HEIGHT + BALL_RADIUS },
  };
  cache.set(rows, layout);
  return layout;
}
