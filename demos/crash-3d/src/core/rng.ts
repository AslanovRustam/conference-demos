export type Rng = () => number

// mulberry32
export function createRng(seed: number): Rng {
  let a = seed >>> 0
  return () => {
    a = (a + 0x6d2b79f5) >>> 0
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

export function randomSeed(): number {
  return (Math.random() * 4294967296) >>> 0
}

// floor to cents, tolerant to float error (1.9999999 -> 2)
export function floor2(x: number): number {
  return Math.floor(x * 100 + 1e-9) / 100
}
