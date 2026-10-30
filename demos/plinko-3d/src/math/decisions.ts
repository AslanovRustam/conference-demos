import type { Rng } from '../core/rng';
import type { Rows } from '../core/types';

export type Step = -1 | 1;

// Ровно `slot` шагов вправо в случайном порядке: так шарик гарантированно приходит в нужную ячейку.
export function buildDecisions(rows: Rows, slot: number, rng: Rng, lastStep?: Step): Step[] {
  const steps: Step[] = Array.from({ length: rows }, (_, i) => (i < slot ? 1 : -1));
  for (let i = steps.length - 1; i > 0; i--) {
    const j = rng.int(i + 1);
    [steps[i], steps[j]] = [steps[j], steps[i]];
  }
  if (lastStep !== undefined && steps[rows - 1] !== lastStep) {
    const swap = steps.indexOf(lastStep);
    if (swap !== -1) [steps[swap], steps[rows - 1]] = [steps[rows - 1], steps[swap]];
  }
  return steps;
}

/** Смещение кристалла (в шагах SPACING), которого шарик касается в каждом ряду. */
export function columnsOf(steps: Step[]): number[] {
  const cols: number[] = [];
  let c = 0;
  for (const s of steps) {
    cols.push(c);
    c += s / 2;
  }
  return cols;
}

export function pegIndexAt(row: number, column: number): number {
  return column + (row + 2) / 2;
}

/** Ячейка, куда шарик попал бы при обратном последнем шаге. */
export function alternativeSlot(slot: number, steps: Step[]): number {
  return slot - steps[steps.length - 1];
}
