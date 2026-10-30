/** Контракт лобби C4: ?embed=1 скрывает заставку, выход сообщается родительскому окну. */
export function isEmbed(search: string): boolean {
  return new URLSearchParams(search).get('embed') === '1';
}

export function postExit(target: Pick<Window, 'postMessage'> = window.parent): void {
  target.postMessage({ type: 'clickable:exit' }, '*');
}
