// Carousel geometry. Positions are continuous slot indices: the carousel eases toward a float
// target, so a drag can sit between slots and the shortest way round is just a nearer integer.

const TAU = Math.PI * 2

export function wrapIndex(i: number, n: number): number {
  return ((i % n) + n) % n
}

/**
 * Slot i on the ring turned by `rotation` (radians): slot 0 sits on +z when the ring is at rest.
 * `squash` < 1 pulls the sides in (an ellipse, for upright screens). `angle` is the slot's place
 * on the ring in (-π, π], 0 at the front; a cabinet facing straight out is rotated by it.
 */
export function ringSlot(i: number, n: number, rotation: number, radius: number, squash = 1): { position: [number, number, number]; angle: number } {
  const raw = (i * TAU) / n + rotation
  const angle = raw - TAU * Math.round(raw / TAU)
  return { position: [Math.sin(angle) * radius * squash, 0, Math.cos(angle) * radius], angle }
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
