import type { Rng } from '../../core/rng'

// hull fragments thrown out by the blast, in absolute altitude like the free capsule (y = alt − nearOffset)

export interface DebrisPiece {
  x: number
  alt: number
  z: number
  vx: number
  vy: number
  vz: number
  rx: number
  ry: number
  rz: number
  wx: number // tumble rates, rad/s
  wy: number
  wz: number
  size: number // metres
  heat: number // 1 glowing … 0 cold
  cool: number // 1/s
}

const SPEED_MIN = 12 // m/s
const SPEED_MAX = 70
const G = 9.81

export function spawnDebris(rng: Rng, count: number, at: { x: number; alt: number; z: number }): DebrisPiece[] {
  return Array.from({ length: count }, () => {
    // a direction on the sphere, a little more sideways than up or down
    const u = rng() * 2 - 1
    const phi = rng() * Math.PI * 2
    const r = Math.sqrt(1 - u * u)
    const speed = SPEED_MIN + (SPEED_MAX - SPEED_MIN) * rng() ** 1.6
    const tumble = () => (rng() - 0.5) * 12
    return {
      x: at.x,
      alt: at.alt,
      z: at.z,
      vx: Math.cos(phi) * r * speed,
      vy: u * 0.7 * speed,
      vz: Math.sin(phi) * r * speed,
      rx: rng() * Math.PI * 2,
      ry: rng() * Math.PI * 2,
      rz: rng() * Math.PI * 2,
      wx: tumble(),
      wy: tumble(),
      wz: tumble(),
      size: 0.25 + rng() ** 2 * 1.6,
      heat: 0.7 + rng() * 0.3,
      cool: 0.4 + rng() * 0.6,
    }
  })
}

export function stepDebris(parts: DebrisPiece[], dt: number, inAir: boolean): void {
  // the air slows the pieces and gravity takes them; in space they keep their speed
  const k = inAir ? Math.exp(-0.35 * dt) : 1
  for (const p of parts) {
    if (inAir) {
      p.vx *= k
      p.vz *= k
      p.vy = p.vy * k - G * dt
    }
    p.x += p.vx * dt
    p.alt += p.vy * dt
    p.z += p.vz * dt
    p.rx += p.wx * dt
    p.ry += p.wy * dt
    p.rz += p.wz * dt
    p.heat = Math.max(0, p.heat - p.cool * dt * p.heat)
  }
}
