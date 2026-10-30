import { createGameStore } from './store';

const mem = () => {
  const m = new Map<string, string>();
  return { getItem: (k: string) => m.get(k) ?? null, setItem: (k: string, v: string) => void m.set(k, v) };
};

test('debit never goes negative', () => {
  const s = createGameStore({ storage: mem() }).getState();
  expect(s.debit(10_001)).toBe(false);
  expect(s.debit(10_000)).toBe(true);
});

test('credit and refill', () => {
  const st = createGameStore({ storage: mem() });
  st.getState().debit(9000);
  st.getState().credit(250);
  expect(st.getState().balance).toBe(1250);
  st.getState().refill();
  expect(st.getState().balance).toBe(10000);
});

test('risk/rows locked while balls in flight', () => {
  const st = createGameStore({ storage: mem() });
  st.getState().setInFlight(2);
  expect(st.getState().setRows(16)).toBe(false);
  expect(st.getState().rows).toBe(12);
  expect(st.getState().setRisk('low')).toBe(false);
  expect(st.getState().risk).toBe('high');
  st.getState().setInFlight(0);
  expect(st.getState().setRows(16)).toBe(true);
  expect(st.getState().rows).toBe(16);
});

test('bet stepping clamps to BETS', () => {
  const st = createGameStore({ storage: mem() });
  for (let i = 0; i < 20; i++) st.getState().stepBet(1);
  expect(st.getState().bet).toBe(1000);
  for (let i = 0; i < 20; i++) st.getState().stepBet(-1);
  expect(st.getState().bet).toBe(10);
});

test('history newest first, capped', () => {
  const st = createGameStore({ storage: mem() });
  for (let i = 0; i < 20; i++) st.getState().pushHistory(i);
  expect(st.getState().history).toHaveLength(12);
  expect(st.getState().history[0].multiplier).toBe(19);
  expect(st.getState().history[0].tier).toBe('large');
});

test('muted persists', () => {
  const storage = mem();
  createGameStore({ storage }).getState().setMuted(true);
  expect(createGameStore({ storage }).getState().muted).toBe(true);
});

test('works when storage throws', () => {
  const bad = {
    getItem: () => {
      throw new Error('denied');
    },
    setItem: () => {
      throw new Error('denied');
    },
  };
  const st = createGameStore({ storage: bad });
  expect(st.getState().muted).toBe(false);
  expect(() => st.getState().setMuted(true)).not.toThrow();
  expect(st.getState().muted).toBe(true);
});

test('works without storage', () => {
  expect(createGameStore({ storage: null }).getState().muted).toBe(false);
});
