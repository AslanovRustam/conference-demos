import { MUSIC_VOLUME, bindVisibility } from './engine';

test('music bus is half as loud as the first version', () => {
  expect(MUSIC_VOLUME).toBeCloseTo(0.35 / 2);
});

test('visibility suspends and resumes unless muted', async () => {
  let muted = false;
  const calls: string[] = [];
  const ctx = {
    state: 'running',
    suspend: async () => {
      calls.push('s');
    },
    resume: async () => {
      calls.push('r');
    },
  };
  const listeners: Record<string, () => void> = {};
  const doc = {
    visibilityState: 'visible' as DocumentVisibilityState,
    addEventListener: (t: string, fn: () => void) => (listeners[t] = fn),
    removeEventListener: () => {},
  };
  bindVisibility(ctx, doc as unknown as Pick<Document, 'visibilityState' | 'addEventListener' | 'removeEventListener'>, () => muted);
  doc.visibilityState = 'hidden';
  listeners.visibilitychange();
  doc.visibilityState = 'visible';
  listeners.visibilitychange();
  muted = true;
  doc.visibilityState = 'hidden';
  listeners.visibilitychange();
  doc.visibilityState = 'visible';
  listeners.visibilitychange();
  expect(calls).toEqual(['s', 'r', 's']);
});
