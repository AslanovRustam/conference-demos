import { READY_TIMEOUT_MS, SMOOTH_FRAMES, stepReadiness, type ReadyState } from './readiness';

const fresh: ReadyState = { smooth: 0, ready: false };
const run = (s: ReadyState, frames: number, input: Parameters<typeof stepReadiness>[1]) => {
  for (let i = 0; i < frames; i++) s = stepReadiness(s, input);
  return s;
};

test('not ready until fonts and shaders are in, however smooth the frames are', () => {
  expect(run(fresh, 100, { fontsReady: false, compiled: true, frameMs: 16, elapsedMs: 1000 }).ready).toBe(false);
  expect(run(fresh, 100, { fontsReady: true, compiled: false, frameMs: 16, elapsedMs: 1000 }).ready).toBe(false);
});

test('ready after a run of smooth frames once everything is compiled', () => {
  const input = { fontsReady: true, compiled: true, frameMs: 16, elapsedMs: 1000 };
  expect(run(fresh, SMOOTH_FRAMES - 1, input).ready).toBe(false);
  expect(run(fresh, SMOOTH_FRAMES, input).ready).toBe(true);
});

test('a hitch restarts the smooth run', () => {
  const input = { fontsReady: true, compiled: true, frameMs: 16, elapsedMs: 1000 };
  let s = run(fresh, SMOOTH_FRAMES - 1, input);
  s = stepReadiness(s, { ...input, frameMs: 400 });
  expect(s.smooth).toBe(0);
  expect(run(s, SMOOTH_FRAMES - 1, input).ready).toBe(false);
});

test('gives up waiting after the timeout so a slow device still starts', () => {
  expect(stepReadiness(fresh, { fontsReady: true, compiled: false, frameMs: 200, elapsedMs: READY_TIMEOUT_MS }).ready).toBe(true);
});

test('once ready it stays ready', () => {
  const s = stepReadiness({ smooth: 0, ready: true }, { fontsReady: false, compiled: false, frameMs: 900, elapsedMs: 0 });
  expect(s.ready).toBe(true);
});

// На слабом или загруженном устройстве кадры ровные, но медленные (15–20 FPS): это не фриз, ждать до таймаута незачем
test('steady slow frames without stalls still count as settled', () => {
  const input = { fontsReady: true, compiled: true, frameMs: 67, elapsedMs: 1000 };
  expect(run(fresh, SMOOTH_FRAMES, input).ready).toBe(true);
});
