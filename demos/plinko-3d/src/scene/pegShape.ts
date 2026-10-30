import type * as THREE from 'three';
import { createRng } from '../core/rng';
import { PEG_RADIUS, pegCount } from '../math/layout';

/** Визуальный кристалл близок к физическому радиусу касания, чтобы шарик не «проваливался» в него. */
export const PEG_VISUAL_RADIUS = PEG_RADIUS * 1.1;
export const PEG_VISUAL_STRETCH_Y = 1.1;
/** Лёгкая пульсация при касании (спека: «лёгкая пульсация масштаба»). */
export const HIT_PULSE = 0.12;

const SPIN_SPEED = 0.15;

// Каждый кристалл чуть повёрнут по-своему, чтобы грани ловили свет по-разному
const spins = (() => {
  const rng = createRng(1);
  return Array.from({ length: pegCount(16) }, () => ({ y: rng.range(0, Math.PI), x: rng.range(-0.25, 0.25) }));
})();

/** Поворот кристалла пирамиды в момент t: общий для пирамиды и осколков интро, чтобы подмена была незаметна. */
export function pegEuler(flat: number, t: number, out: THREE.Euler): THREE.Euler {
  const s = spins[flat];
  return out.set(s.x, s.y + t * SPIN_SPEED, 0);
}
