// Carousel geometry. Positions are continuous slot indices: the carousel eases toward a float
// target, so a drag can sit between slots and the shortest way round is just a nearer integer.

const TAU = Math.PI * 2

export function wrapIndex(i: number, n: number): number {
  return ((i % n) + n) % n
}

/** Slot i on a circle of `radius`; slot 0 sits on +z and every screen faces outward. */
export function slotTransform(i: number, n: number, radius: number): { position: [number, number, number]; rotationY: number } {
  const a = (i * TAU) / n
  return { position: [Math.sin(a) * radius, 0, Math.cos(a) * radius], rotationY: a }
}

/** Group rotation that brings slot `target` to the front (+z). */
export function carouselRotation(target: number, n: number): number {
  return (-target * TAU) / n
}

/** The continuous target closest to `current` that lands on slot `index`. */
export function nearestTarget(current: number, index: number, n: number): number {
  const base = index + n * Math.round((current - index) / n)
  return base
}

/** Where a released drag settles: momentum carries it on, but never more than two slots. */
export function snapTarget(pos: number, velocitySlotsPerSec: number, inertiaSec = 0.25): number {
  const home = Math.round(pos)
  const flung = Math.round(pos + velocitySlotsPerSec * inertiaSec)
  return Math.max(home - 2, Math.min(home + 2, flung))
}

export function ringDistance(i: number, j: number, n: number): number {
  const d = wrapIndex(i - j, n)
  return Math.min(d, n - d)
}
