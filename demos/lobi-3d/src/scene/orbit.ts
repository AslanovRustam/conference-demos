// Chips and dice around the glass core: evenly spaced on a circle that turns with time and is
// tilted around the X axis, so the ring reads in depth from the stand camera.

const SPEED = 0.35 // rad/s

export function orbitPosition(i: number, n: number, t: number, radius: number, tilt: number): [number, number, number] {
  const a = (i / n) * Math.PI * 2 + t * SPEED
  const x = Math.cos(a) * radius
  const z = Math.sin(a) * radius
  return [x, -z * Math.sin(tilt), z * Math.cos(tilt)]
}
