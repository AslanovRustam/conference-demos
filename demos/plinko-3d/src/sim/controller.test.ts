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

test('rain balls stay out of history, player drops go in', () => {
  const { st, ctl, run } = setup(15);
  ctl.rain({ mode: 'free', count: 20 });
  run(12);
  expect(st.getState().history).toHaveLength(0);
});

// Бросает по одному шарику и ждёт приземления; празднования закрываются сразу
function dropOneByOne(kit: ReturnType<typeof setup>, n: number): string[] {
  const tiers: string[] = [];
  kit.bus.on('ball:land', (e) => e.kind === 'player' && tiers.push(e.tier));
  kit.bus.on('celebrate:start', (e) => kit.bus.emit('celebrate:end', { kind: e.kind }));
  for (let i = 0; i < n; i++) {
    const before = tiers.length;
    kit.ctl.drop();
    while (tiers.length === before) kit.run(0.05);
    kit.run(1);
  }
  return tiers;
}

test('every 5th player drop is a BIG or MEGA win', () => {
  const kit = setup(20);
  const tiers = dropOneByOne(kit, 10);
  expect(['big', 'mega']).toContain(tiers[4]);
  expect(['big', 'mega']).toContain(tiers[9]);
});

test('attract exit restarts the 5-drop count for the next visitor', () => {
  const kit = setup(21);
  dropOneByOne(kit, 3);
  kit.ctl.endDemo();
  const tiers = dropOneByOne(kit, 5);
  expect(['big', 'mega']).toContain(tiers[4]);
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

// Сид, при котором первый бросок даёт крупный (не Big) выигрыш с замедлением, но без празднования
function seedWithPlainSlowMo(): number {
  for (let seed = 0; seed < 500; seed++) {
    const { ctl, sys } = setup(seed);
    ctl.drop();
    const b = sys.balls[0];
    if (b.slowMo === 'win' && b.tier === 'large') return seed;
  }
  throw new Error('no seed');
}

test('drops during a plain slow-mo are queued, then fire one by one', () => {
  const { bus, ctl, sys, slowmo } = setup(seedWithPlainSlowMo());
  let frame = 0;
  let started = false;
  let endFrame = -1;
  const spawns: { frame: number; afterSlowMo: boolean }[] = [];
  bus.on('slowmo:start', () => (started = true));
  bus.on('slowmo:end', () => (endFrame = frame));
  bus.on('ball:spawn', () => started && spawns.push({ frame, afterSlowMo: slowmo.activeBallId === null }));
  const step = () => {
    frame++;
    ctl.update(1 / 60);
  };
  ctl.drop();
  while (!started) step();
  ctl.drop();
  ctl.drop();
  expect(sys.balls).toHaveLength(1);
  for (let i = 0; i < 60 * 8; i++) step();
  expect(endFrame).toBeGreaterThan(0);
  expect(spawns.map((s) => s.afterSlowMo)).toEqual([true, true]);
  expect(spawns[1].frame - spawns[0].frame).toBeGreaterThanOrEqual(8); // ≥ 0.13 с между шариками
});

test('drops queued before a big win are discarded when it is celebrated', () => {
  const { bus, ctl, run } = setup(9);
  let started = false;
  let spawnsAfter = 0;
  bus.on('slowmo:start', () => (started = true));
  bus.on('ball:spawn', () => started && spawnsAfter++);
  ctl.drop({ forceBig: true });
  while (!started) run(0.05);
  ctl.drop();
  ctl.drop();
  let kind: GameEvents['celebrate:start']['kind'] | null = null;
  bus.on('celebrate:start', (e) => (kind = e.kind));
  while (!kind) run(0.05);
  run(1);
  bus.emit('celebrate:end', { kind: kind! });
  run(3);
  expect(spawnsAfter).toBe(0);
});

test('endDemo stops a demo rain without a celebration', () => {
  const { st, bus, ctl, run } = setup(16);
  let celebrations = 0;
  bus.on('celebrate:start', () => celebrations++);
  ctl.rain({ mode: 'demo', count: 30 });
  run(1);
  ctl.endDemo();
  expect(ctl.rainActive).toBe(false);
  run(15);
  expect(celebrations).toBe(0);
  expect(st.getState().balance).toBe(10000);
  expect(ctl.drop()).toBe(true);
});

test('endDemo ends a demo slow-mo at once and its landing celebrates nothing', () => {
  const { bus, ctl, sys, slowmo, run } = setup(17);
  let started = false;
  let ended = 0;
  let celebrations = 0;
  bus.on('slowmo:start', () => (started = true));
  bus.on('slowmo:end', () => ended++);
  bus.on('celebrate:start', () => celebrations++);
  ctl.drop({ kind: 'demo', forceBig: true });
  while (!started) run(0.05);
  ctl.endDemo();
  expect(slowmo.activeBallId).toBeNull();
  expect(sys.timeScale).toBe(1);
  expect(ended).toBe(1);
  run(8);
  expect(celebrations).toBe(0);
});

test('endDemo closes a running demo celebration', () => {
  const { bus, ctl, run } = setup(18);
  const ends: string[] = [];
  bus.on('celebrate:end', (e) => ends.push(e.kind));
  let kind: string | null = null;
  bus.on('celebrate:start', (e) => (kind = e.kind));
  ctl.drop({ kind: 'demo', forceBig: true });
  while (!kind) run(0.05);
  expect(ctl.celebrating).toBe(true);
  ctl.endDemo();
  expect(ends).toEqual([kind]);
  expect(ctl.celebrating).toBe(false);
});

test('endDemo leaves a player celebration alone', () => {
  const { bus, ctl, run } = setup(19);
  let kind: string | null = null;
  bus.on('celebrate:start', (e) => (kind = e.kind));
  ctl.drop({ forceBig: true });
  while (!kind) run(0.05);
  ctl.endDemo();
  expect(ctl.celebrating).toBe(true);
});
