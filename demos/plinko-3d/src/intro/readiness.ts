/**
 * Когда убирать обложку загрузки. Первый кадр с новой сценой компилирует все шейдеры и замирает на секунду-две,
 * поэтому обложка держится, пока не загрузятся шрифты, не скомпилируются шейдеры и не пройдёт серия кадров без фризов.
 * Медленные, но ровные кадры слабого устройства — не фриз: ждём только пропажи длинных остановок (компиляция и т. п.).
 * Слабое устройство не ждёт бесконечно: по таймауту игра показывается как есть.
 */
export const SMOOTH_FRAMES = 15;
/** Кадр длиннее этого — фриз: компиляция шейдера, загрузка текстуры. Ровные 15–20 FPS сюда не попадают. */
export const STALL_MS = 100;
export const READY_TIMEOUT_MS = 8000;

export interface ReadyState {
  smooth: number;
  ready: boolean;
}

export interface ReadyInput {
  fontsReady: boolean;
  compiled: boolean;
  frameMs: number;
  elapsedMs: number;
}

export function stepReadiness(s: ReadyState, i: ReadyInput): ReadyState {
  if (s.ready) return s;
  if (i.elapsedMs >= READY_TIMEOUT_MS) return { smooth: s.smooth, ready: true };
  if (!i.fontsReady || !i.compiled) return { smooth: 0, ready: false };
  const smooth = i.frameMs < STALL_MS ? s.smooth + 1 : 0;
  return { smooth, ready: smooth >= SMOOTH_FRAMES };
}
