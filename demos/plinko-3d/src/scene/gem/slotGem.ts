import * as THREE from 'three';
import { brilliantCut } from './brilliant';

/** Площадка камня-ячейки чуть повёрнута к зрителю. */
export const SLOT_GEM_TILT = 0.3;

/**
 * Камень-ячейка: та же огранка «круглый бриллиант», что у камня интро, шириной в ячейку.
 * Павильон чуть мельче настоящего, чтобы ряд камней не уходил глубоко вниз к подписям.
 */
export function slotGemGeometry(): THREE.BufferGeometry {
  return brilliantCut().scale(0.47, 0.38, 0.47);
}
