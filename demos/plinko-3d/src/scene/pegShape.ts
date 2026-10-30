import { PEG_RADIUS } from '../math/layout';

/** Визуальный кристалл близок к физическому радиусу касания, чтобы шарик не «проваливался» в него. */
export const PEG_VISUAL_RADIUS = PEG_RADIUS * 1.1;
export const PEG_VISUAL_STRETCH_Y = 1.1;
/** Лёгкая пульсация при касании (спека: «лёгкая пульсация масштаба»). */
export const HIT_PULSE = 0.12;
