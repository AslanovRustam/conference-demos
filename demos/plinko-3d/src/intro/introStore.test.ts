import { createIntroStore } from './introStore';

test('start is idempotent and drives the phase clock', () => {
  let now = 10;
  const st = createIntroStore(() => now);
  expect(st.getState().phaseNow().phase).toBe('crystal');
  st.getState().start();
  now = 10.5;
  st.getState().start(); // повторный тап ничего не сбрасывает
  expect(st.getState().phaseNow().phase).toBe('crack');
  now = 30;
  expect(st.getState().phaseNow().phase).toBe('done');
});

test('lobby visibility starts the intro only once it is ready', () => {
  let now = 0;
  const st = createIntroStore(() => now);
  st.getState().lobbyVisible();
  expect(st.getState().autoStartAt).toBeNull();
  st.getState().setReady();
  expect(st.getState().autoStartAt).toBeCloseTo(0.6);
  now = 1;
  st.getState().tick();
  expect(st.getState().startedAt).toBe(1);
});
