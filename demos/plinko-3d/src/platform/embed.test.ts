import { isEmbed, parseLobbyMessage, postExit, postReady } from './embed';

test('ready message for the lobby', () => {
  const sent: unknown[] = [];
  postReady({ postMessage: (m: unknown, o: string) => sent.push([m, o]) } as unknown as Pick<Window, 'postMessage'>);
  expect(sent).toEqual([[{ type: 'clickable:ready' }, '*']]);
});

test('lobby messages: visible and mute from the same origin only', () => {
  const origin = 'http://localhost:4173';
  const parent = {};
  const msg = (data: unknown, o = origin, source: unknown = parent) => parseLobbyMessage({ data, origin: o, source }, origin, parent);
  expect(msg({ type: 'clickable:visible' })).toEqual({ type: 'visible' });
  expect(msg({ type: 'clickable:mute', muted: true })).toEqual({ type: 'mute', muted: true });
  expect(msg({ type: 'clickable:mute', muted: 'yes' })).toBeNull();
  expect(msg({ type: 'clickable:visible' }, 'https://evil.example')).toBeNull();
  expect(msg({ type: 'clickable:visible' }, origin, {})).toBeNull();
  expect(msg('clickable:visible')).toBeNull();
  expect(msg(null)).toBeNull();
});

test('embed flag and exit message', () => {
  expect(isEmbed('?embed=1')).toBe(true);
  expect(isEmbed('')).toBe(false);
  expect(isEmbed('?embed=0')).toBe(false);
  const sent: unknown[] = [];
  postExit({ postMessage: (m: unknown, o: string) => sent.push([m, o]) } as unknown as Pick<Window, 'postMessage'>);
  expect(sent).toEqual([[{ type: 'clickable:exit' }, '*']]);
});
