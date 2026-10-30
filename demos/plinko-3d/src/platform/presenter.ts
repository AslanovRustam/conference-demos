export type PresenterAction = 'forceBig' | 'freeRain';

type KeyLike = Pick<KeyboardEvent, 'code' | 'shiftKey' | 'ctrlKey' | 'altKey' | 'metaKey' | 'repeat'>;

/** Горячие клавиши ведущего. Смотрим на code, а не key: работает в любой раскладке. */
export function presenterAction(e: KeyLike): PresenterAction | null {
  if (!e.shiftKey || e.ctrlKey || e.altKey || e.metaKey || e.repeat) return null;
  if (e.code === 'KeyB') return 'forceBig';
  if (e.code === 'KeyR') return 'freeRain';
  return null;
}
