import { MAX_ACTIVE_BALLS, MAX_DT } from '../config';
import type { GameEvents } from '../core/events';
import { setup } from './testkit';

type Land = GameEvents['ball:land'];

test('drop debits, lands, credits, history', () => {
  const { st, bus, ctl, run } = setup(1);
  const lands: Land[] = [];
  bus.on('ball:land', (e) => lands.push(e));
  ctl.drop();
  expect(st.getState().balance).toBe(10000 - 100);
  run(8);
  expect(lands).toHaveLength(1);
  expect(st.getState().balance).toBe(9900 + lands[0].win);
  expect(st.getState().history).toHaveLength(1);
  expect(lands[0].win).toBe(Math.round(100 * lands[0].multiplier));
});

test('peg hits arrive in row order before land', () => {
  const { bus, ctl, run } = setup(2);
  const seq: string[] = [];
  bus.on('peg:hit', (e) => seq.push('p' + e.row));
  bus.on('ball:land', () => seq.push('land'));
  ctl.drop();
  run(8);
  expect(seq.at(-1)).toBe('land');
  expect(seq[0]).toBe('p0');
  const rows = seq.filter((s) => s !== 'land').map((s) => Number(s.slice(1)));
  rows.slice(1).forEach((r, i) => expect(r).toBeGreaterThanOrEqual(rows[i]));
});

test('in-flight count and board clear', () => {
  const { st, bus, ctl, run } = setup(12);
  let cleared = 0;
  bus.on('board:clear', () => cleared++);
  ctl.drop();
  ctl.drop();
  run(0.1);
  expect(st.getState().inFlight).toBe(2);
  run(10);
  expect(st.getState().inFlight).toBe(0);
  expect(cleared).toBe(1);
});

test('spam drop: never negative, capped balls', () => {
  const { st, sys, ctl, run } = setup(3);
  for (let i = 0; i < 1000; i++) {
    ctl.drop();
    if (i % 10 === 0) run(0.05);
    expect(st.getState().balance).toBeGreaterThanOrEqual(0);
    expect(sys.balls.length).toBeLessThanOrEqual(MAX_ACTIVE_BALLS);
  }
});

test('huge dt is clamped (hidden tab)', () => {
  const { sys, ctl } = setup(4);
  ctl.drop();
  const t0 = sys.balls[0].t;
  ctl.update(5);
  expect(sys.balls[0].t - t0).toBeLessThanOrEqual(MAX_DT + 1e-9);
});

test('refill when broke', () => {
  const { st, bus, ctl } = setup(5);
  st.setState({ balance: 50 });
  const ev: GameEvents['balance:refill'][] = [];
  bus.on('balance:refill', (e) => ev.push(e));
  ctl.drop();
  expect(ev).toEqual([{ from: 50, to: 10000 }]);
  expect(st.getState().balance).toBe(10000 - 100);
});

test('paid rain spends at most 100 bets and emits total', () => {
  const { st, bus, ctl, run } = setup(6);
  let end: GameEvents['rain:end'] | undefined;
  let celebrate: GameEvents['celebrate:start'] | undefined;
  bus.on('rain:end', (e) => (end = e));
  bus.on('celebrate:start', (e) => (celebrate = e));
  ctl.rain({ mode: 'paid' });
  expect(ctl.rainActive).toBe(true);
  run(20);
  expect(end!.totalBet).toBe(100 * 100);
  expect(st.getState().balance).toBe(10000 - 10000 + end!.totalWin);
  expect(celebrate).toEqual({ kind: 'total', amount: end!.totalWin, slot: null });
  expect(ctl.rainActive).toBe(false);
});

test('free rain does not debit', () => {
  const { st, bus, ctl, run } = setup(13);
  let end: GameEvents['rain:end'] | undefined;
  bus.on('rain:end', (e) => (end = e));
  ctl.rain({ mode: 'free', count: 20 });
  run(0.5);
  expect(st.getState().balance).toBeGreaterThanOrEqual(10000);
  run(15);
  expect(end!.totalBet).toBe(0);
  expect(st.getState().balance).toBe(10000 + end!.totalWin);
});

test('demo balls never touch balance', () => {
  const { st, bus, ctl, run } = setup(7);
  bus.on('celebrate:start', () => bus.emit('celebrate:end', { kind: 'total' }));
  ctl.rain({ mode: 'demo', count: 30 });
  run(15);
  ctl.drop({ kind: 'demo' });
  run(10);
  expect(st.getState().balance).toBe(10000);
  expect(st.getState().history).toHaveLength(0);
});

test('forceBigNext lands >=25x and switches risk if needed', () => {
  const { st, bus, ctl, run } = setup(8);
  st.getState().setRisk('low');
  let land: Land | undefined;
  bus.on('ball:land', (e) => (land = e));
  ctl.forceBigNext();
  expect(st.getState().risk).toBe('high');
  ctl.drop();
  run(8);
  expect(land!.multiplier).toBeGreaterThanOrEqual(25);
});

test('big win starts celebration and blocks drops until it ends', () => {
  const { bus, ctl, sys, run } = setup(14);
  let celebrate: GameEvents['celebrate:start'] | undefined;
  bus.on('celebrate:start', (e) => (celebrate = e));
  ctl.drop({ forceBig: true });
  run(8);
  expect(celebrate!.kind === 'big' || celebrate!.kind === 'mega').toBe(true);
  expect(ctl.celebrating).toBe(true);
  ctl.drop();
  expect(sys.balls).toHaveLength(0);
  bus.emit('celebrate:end', { kind: celebrate!.kind });
  ctl.drop();
  expect(sys.balls).toHaveLength(1);
});

test('drops during slow-mo are queued, then flushed', () => {
  const { bus, ctl, sys, slowmo, run } = setup(9);
  let started = false;
  let ended = false;
  const spawnsAfterStart: boolean[] = []; // true, если замедление в момент появления уже закончилось
  bus.on('slowmo:start', () => (started = true));
  bus.on('slowmo:end', () => (ended = true));
  bus.on('ball:spawn', () => started && spawnsAfterStart.push(slowmo.activeBallId === null));
  ctl.drop({ forceBig: true });
  while (!started) run(0.05);
  ctl.drop();
  ctl.drop();
  expect(sys.balls).toHaveLength(1);
  // празднование крупного выигрыша блокирует броски, поэтому оверлей завершаем сразу
  bus.on('celebrate:start', (e) => bus.emit('celebrate:end', { kind: e.kind }));
  run(8);
  expect(ended).toBe(true);
  expect(spawnsAfterStart).toEqual([true, true]);
});
