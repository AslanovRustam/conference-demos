/** Контракт лобби C4: ?embed=1 скрывает заставку, выход сообщается родительскому окну. */
export function isEmbed(search: string): boolean {
  return new URLSearchParams(search).get('embed') === '1';
}

export function postExit(target: Pick<Window, 'postMessage'> = window.parent): void {
  target.postMessage({ type: 'clickable:exit' }, '*');
}

/** Сцена загружена и первый кадр отрисован: лобби может показывать игру. */
export function postReady(target: Pick<Window, 'postMessage'> = window.parent): void {
  target.postMessage({ type: 'clickable:ready' }, '*');
}

export type LobbyMessage = { type: 'visible' } | { type: 'mute'; muted: boolean };

/** Сообщения лобби принимаются только от родительского окна того же origin (протокол C4, раздел 13). */
export function parseLobbyMessage(
  e: { data: unknown; origin: string; source: unknown },
  expectedOrigin: string,
  expectedSource: unknown,
): LobbyMessage | null {
  if (e.origin !== expectedOrigin || e.source !== expectedSource) return null;
  const data = e.data as { type?: unknown; muted?: unknown } | null;
  if (typeof data !== 'object' || data === null) return null;
  if (data.type === 'clickable:visible') return { type: 'visible' };
  if (data.type === 'clickable:mute' && typeof data.muted === 'boolean') return { type: 'mute', muted: data.muted };
  return null;
}
