import { setupWithAttract } from './testkit';

test('attract drops demo balls only in attract mode', () => {
  const { st, attract, sys, run } = setupWithAttract(1);
  st.getState().setMode('play');
  for (let i = 0; i < 300; i++) attract.update(1 / 60);
  expect(sys.balls).toHaveLength(0);
  st.getState().setMode('attract');
  let maxBalls = 0;
  for (let i = 0; i < 60 * 30; i++) {
    attract.update(1 / 60);
    run(1 / 60);
    maxBalls = Math.max(maxBalls, sys.balls.length);
  }
  expect(maxBalls).toBeGreaterThan(0);
  expect(st.getState().balance).toBe(10000);
  expect(st.getState().history).toHaveLength(0);
});

test('blocked showcase drop is retried, not skipped', () => {
  const { st, bus, attract, slowmo, run } = setupWithAttract(3);
  const kinds: string[] = [];
  bus.on('celebrate:start', (e) => {
    kinds.push(e.kind);
    bus.emit('celebrate:end', { kind: e.kind });
  });
  st.getState().setMode('attract');
  // Броски заблокированы (как в конце замедления) ровно тогда, когда наступает первый показательный момент
  slowmo.activeBallId = 999;
  for (let i = 0; i < 60 * 10; i++) attract.update(1 / 60);
  slowmo.activeBallId = null;
  for (let i = 0; i < 60 * 20; i++) {
    attract.update(1 / 60);
    run(1 / 60);
  }
  expect(kinds[0] === 'big' || kinds[0] === 'mega').toBe(true);
});

test('attract showcases a big win and a rain', () => {
  const { st, bus, attract, run } = setupWithAttract(2);
  const kinds: string[] = [];
  bus.on('celebrate:start', (e) => {
    kinds.push(e.kind);
    bus.emit('celebrate:end', { kind: e.kind }); // оверлей в тесте закрываем сразу
  });
  let rains = 0;
  bus.on('rain:start', (e) => {
    expect(e.mode).toBe('demo');
    rains++;
  });
  st.getState().setMode('attract');
  for (let i = 0; i < 60 * 60; i++) {
    attract.update(1 / 60);
    run(1 / 60);
  }
  expect(kinds.some((k) => k === 'big' || k === 'mega')).toBe(true);
  expect(rains).toBeGreaterThan(0);
  expect(st.getState().balance).toBe(10000);
});
