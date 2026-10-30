import { isEmbed, postExit } from './embed';

test('embed flag and exit message', () => {
  expect(isEmbed('?embed=1')).toBe(true);
  expect(isEmbed('')).toBe(false);
  expect(isEmbed('?embed=0')).toBe(false);
  const sent: unknown[] = [];
  postExit({ postMessage: (m: unknown, o: string) => sent.push([m, o]) } as unknown as Pick<Window, 'postMessage'>);
  expect(sent).toEqual([[{ type: 'clickable:exit' }, '*']]);
});
