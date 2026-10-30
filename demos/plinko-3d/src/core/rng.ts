export interface Rng {
  /** [0, 1) */
  next(): number;
  int(maxExclusive: number): number;
  range(min: number, max: number): number;
  chance(p: number): boolean;
}

// mulberry32: быстрый детерминированный генератор, достаточный для игры
export function createRng(seed: number): Rng {
  let a = seed >>> 0;
  const next = () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  return {
    next,
    int: (maxExclusive) => Math.floor(next() * maxExclusive),
    range: (min, max) => min + next() * (max - min),
    chance: (p) => next() < p,
  };
}

export function seedFromSearch(search: string): number | null {
  const raw = new URLSearchParams(search).get('seed');
  if (raw === null) return null;
  const n = Number(raw);
  return Number.isFinite(n) ? n : null;
}
