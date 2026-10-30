// iOS Safari разблокирует звук только на «настоящих» жестах (touchend, click), Chrome на Android по
// pointerup: слушаем все сразу, сама разблокировка идемпотентна.
export const UNLOCK_EVENTS = ['pointerdown', 'pointerup', 'touchend', 'click', 'keydown'] as const;

export function bindUnlock(target: Pick<EventTarget, 'addEventListener' | 'removeEventListener'>, unlock: () => void): () => void {
  for (const type of UNLOCK_EVENTS) target.addEventListener(type, unlock, { capture: true });
  return () => {
    for (const type of UNLOCK_EVENTS) target.removeEventListener(type, unlock, { capture: true });
  };
}
