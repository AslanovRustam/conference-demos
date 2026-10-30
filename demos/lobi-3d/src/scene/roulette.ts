// European wheel: one green zero, then red and black alternating around the ring.
export const ROULETTE_SEGMENTS = 37

export function segmentColor(i: number): 'green' | 'red' | 'black' {
  if (i === 0) return 'green'
  return i % 2 ? 'red' : 'black'
}
