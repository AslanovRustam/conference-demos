import type { Rng } from '../core/rng'

// the cash-out confetti: screen-space paper pieces in pixels, y grows downwards

export const CONFETTI_COUNT = 150
export const CONFETTI_S = 1.2
export const CONFETTI_COLORS = ['#ff1923', '#f6f3ee'] as const

export interface ConfettiPiece {
  x: number
  y: number
  vx: number
  vy: number
  angle: number
  turn: number // rad/s
  flip: number // phase of the paper turning over
  size: number
  color: (typeof CONFETTI_COLORS)[number]
  age: number
  alpha: number
}

const GRAVITY = 1.6 // screen heights per s²
const DRAG = 1.4 // 1/s

// a fountain out of the main button area, under the payout
export function spawnConfetti(rng: Rng, width: number, height: number): ConfettiPiece[] {
  const unit = Math.min(width, height)
  return Array.from({ length: CONFETTI_COUNT }, (_, i) => {
    const a = -Math.PI / 2 + (rng() - 0.5) * 1.9
    const speed = unit * (1.2 + rng() * 1.1)
    return {
      x: width / 2 + (rng() - 0.5) * unit * 0.1,
      y: height * 0.8,
      vx: Math.cos(a) * speed,
      vy: Math.sin(a) * speed,
      angle: rng() * Math.PI * 2,
      turn: (rng() - 0.5) * 14,
      flip: rng() * Math.PI * 2,
      size: unit * (0.004 + rng() * 0.005),
      color: CONFETTI_COLORS[i % 2],
      age: 0,
      alpha: 1,
    }
  })
}

export function stepConfetti(parts: ConfettiPiece[], dt: number, height: number): void {
  const k = Math.exp(-DRAG * dt)
  for (const p of parts) {
    p.age += dt
    p.vx *= k
    p.vy = p.vy * k + GRAVITY * height * dt
    p.x += p.vx * dt
    p.y += p.vy * dt
    p.angle += p.turn * dt
    p.flip += 9 * dt
    // full until two thirds through, then fades out by the end
    const fade = (CONFETTI_S - p.age) / (CONFETTI_S / 3)
    p.alpha = Math.min(1, Math.max(0, fade))
  }
}
