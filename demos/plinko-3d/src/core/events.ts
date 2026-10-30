import type { Tier } from '../math/tiers';
import type { BallKind, CelebrateKind, RainMode } from './types';

export interface EventBus<E> {
  on<K extends keyof E>(type: K, fn: (p: E[K]) => void): () => void;
  emit<K extends keyof E>(type: K, p: E[K]): void;
}

type Empty = Record<string, never>;

export type GameEvents = {
  'ball:spawn': { ballId: number; kind: BallKind };
  'peg:hit': { ballId: number; row: number; index: number; speed: number; kind: BallKind };
  'ball:land': { ballId: number; slot: number; multiplier: number; tier: Tier; win: number; kind: BallKind };
  'ball:gone': { ballId: number };
  'board:clear': Empty;
  'slowmo:start': { ballId: number; reason: 'win' | 'decoy' };
  'slowmo:end': { ballId: number };
  'rain:start': { count: number; mode: RainMode };
  'rain:end': { totalWin: number; totalBet: number; mode: RainMode };
  'balance:refill': { from: number; to: number };
  'celebrate:start': { kind: CelebrateKind; amount: number; slot: number | null };
  'celebrate:tick': Empty;
  'celebrate:end': { kind: CelebrateKind };
  'ui:click': Empty;
};

export function createBus<E>(): EventBus<E> {
  const listeners = new Map<keyof E, Set<(p: never) => void>>();
  return {
    on(type, fn) {
      let set = listeners.get(type);
      if (!set) listeners.set(type, (set = new Set()));
      set.add(fn as (p: never) => void);
      return () => void set.delete(fn as (p: never) => void);
    },
    emit(type, p) {
      const set = listeners.get(type);
      if (!set) return;
      for (const fn of [...set]) (fn as (p: E[typeof type]) => void)(p);
    },
  };
}
