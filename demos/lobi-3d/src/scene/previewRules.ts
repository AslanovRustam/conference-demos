import type { Phase } from '../state/store'

/** Preview video decodes only on the front cabinet, and never while a game is opening or open. */
export function previewShouldPlay(distance: number, phase: Phase): boolean {
  return distance === 0 && phase === 'lobby'
}
