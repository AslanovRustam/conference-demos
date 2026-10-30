import { useStore } from 'zustand';
import { createStore, type StoreApi } from 'zustand/vanilla';
import { BETS, DEFAULT_BET, DEFAULT_RISK, DEFAULT_ROWS, HISTORY_MAX, START_BALANCE } from '../config';
import type { Quality, Risk, Rows } from '../core/types';
import { tierOf, type Tier } from '../math/tiers';

export interface HistoryItem {
  id: number;
  multiplier: number;
  tier: Tier;
}

export interface GameState {
  balance: number;
  bet: number;
  risk: Risk;
  rows: Rows;
  muted: boolean;
  quality: Quality;
  mode: 'splash' | 'play' | 'attract';
  inFlight: number;
  history: HistoryItem[];
  setBet(b: number): void;
  stepBet(dir: 1 | -1): void;
  setRisk(r: Risk): boolean;
  setRows(n: Rows): boolean;
  debit(amount: number): boolean;
  credit(amount: number): void;
  refill(): void;
  pushHistory(multiplier: number): void;
  setMuted(m: boolean): void;
  setQuality(q: Quality): void;
  setMode(m: GameState['mode']): void;
  setInFlight(n: number): void;
}

type Storage = Pick<globalThis.Storage, 'getItem' | 'setItem'>;

const MUTED_KEY = 'plinko3d.muted';

function readMuted(storage: Storage | null | undefined): boolean {
  try {
    return storage?.getItem(MUTED_KEY) === '1';
  } catch {
    return false;
  }
}

function writeMuted(storage: Storage | null | undefined, muted: boolean) {
  try {
    storage?.setItem(MUTED_KEY, muted ? '1' : '0');
  } catch {
    // приватный режим или заблокированные данные сайта: настройка просто не сохранится
  }
}

export function createGameStore(deps: { storage?: Storage | null } = {}): StoreApi<GameState> {
  const { storage } = deps;
  let historyId = 0;
  return createStore<GameState>((set, get) => ({
    balance: START_BALANCE,
    bet: DEFAULT_BET,
    risk: DEFAULT_RISK,
    rows: DEFAULT_ROWS,
    muted: readMuted(storage),
    quality: 'high',
    mode: 'splash',
    inFlight: 0,
    history: [],
    setBet: (bet) => set({ bet }),
    stepBet: (dir) => {
      const i = BETS.indexOf(get().bet as (typeof BETS)[number]);
      const next = Math.min(BETS.length - 1, Math.max(0, (i === -1 ? BETS.indexOf(DEFAULT_BET) : i) + dir));
      set({ bet: BETS[next] });
    },
    setRisk: (risk) => {
      if (get().inFlight > 0) return false;
      set({ risk });
      return true;
    },
    setRows: (rows) => {
      if (get().inFlight > 0) return false;
      set({ rows });
      return true;
    },
    debit: (amount) => {
      if (get().balance < amount) return false;
      set({ balance: get().balance - amount });
      return true;
    },
    credit: (amount) => set({ balance: get().balance + amount }),
    refill: () => set({ balance: START_BALANCE }),
    pushHistory: (multiplier) =>
      set({ history: [{ id: ++historyId, multiplier, tier: tierOf(multiplier) }, ...get().history].slice(0, HISTORY_MAX) }),
    setMuted: (muted) => {
      writeMuted(storage, muted);
      set({ muted });
    },
    setQuality: (quality) => set({ quality }),
    setMode: (mode) => set({ mode }),
    setInFlight: (inFlight) => set({ inFlight }),
  }));
}

function browserStorage(): Storage | null {
  try {
    return typeof window === 'undefined' ? null : window.localStorage;
  } catch {
    return null;
  }
}

export const gameStore = createGameStore({ storage: browserStorage() });

export function useGame<T>(selector: (s: GameState) => T): T {
  return useStore(gameStore, selector);
}
