// Интро «кристалл раскалывается в пирамиду»: длительности фаз в секундах после тапа
const CRACK = 0.9;
const EXPLODE = 0.55;
const ASSEMBLE = 1.5;
const GEMS = 0.7;

export const INTRO = {
  crack: CRACK,
  explode: EXPLODE,
  assemble: ASSEMBLE,
  gems: GEMS,
  total: CRACK + EXPLODE + ASSEMBLE + GEMS,
} as const;

/** Полёт одного осколка к своему кристаллу пирамиды. */
export const SHARD_FLIGHT = 0.65;
const ROW_SPREAD = 0.6; // насколько позже стартует нижний ряд, чем верхний
const JITTER_SPREAD = ASSEMBLE - SHARD_FLIGHT - ROW_SPREAD;

export type IntroPhase = 'crystal' | 'crack' | 'explode' | 'assemble' | 'gems' | 'done';

/** Фаза и прогресс внутри неё (0…1) по времени с тапа; null — тапа ещё не было. */
export function introPhase(elapsed: number | null): { phase: IntroPhase; p: number; t: number } {
  if (elapsed === null) return { phase: 'crystal', p: 0, t: 0 };
  let t = elapsed;
  const steps: [IntroPhase, number][] = [
    ['crack', CRACK],
    ['explode', EXPLODE],
    ['assemble', ASSEMBLE],
    ['gems', GEMS],
  ];
  for (const [phase, dur] of steps) {
    if (t < dur) return { phase, p: t / dur, t };
    t -= dur;
  }
  return { phase: 'done', p: 1, t };
}

const easeInOut = (x: number) => (x < 0.5 ? 4 * x * x * x : 1 - (-2 * x + 2) ** 3 / 2);

/** Прогресс полёта осколка ряда `row` (0…1) через `t` секунд от начала сборки; jitter 0…1 разносит соседей. */
export function assembleProgress(t: number, row: number, rows: number, jitter: number): number {
  const delay = (row / Math.max(1, rows - 1)) * ROW_SPREAD + jitter * JITTER_SPREAD;
  const k = Math.min(1, Math.max(0, (t - delay) / SHARD_FLIGHT));
  return easeInOut(k);
}

function easeOutBack(x: number) {
  const c = 1.7;
  return 1 + (c + 1) * (x - 1) ** 3 + c * (x - 1) ** 2;
}

/** Появление камня-ячейки: волна от центра к краям. */
export function gemReveal(t: number, slot: number, slots: number): number {
  const center = (slots - 1) / 2;
  const delay = (Math.abs(slot - center) / Math.max(1, center)) * GEMS * 0.45;
  const k = Math.min(1, Math.max(0, (t - delay) / (GEMS * 0.55)));
  return k <= 0 ? 0 : easeOutBack(k);
}
