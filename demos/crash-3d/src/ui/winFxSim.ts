import type { Rng } from '../core/rng'

// the cash-out burst around the win card, in screen pixels (y grows downwards): a flash, two shock rings, sparks
// streaking out and braking hard, glints twinkling round the amount, and credits flying from the amount into the
// balance. the card is ui/WinBurst.tsx, the drawing ui/WinFx.tsx

export const WINFX_S = 2
export const WINFX_COLORS = ['#ff1923', '#f6f3ee'] as const
// the first and the last credit landing on the balance; the balance counts up between them (ui/Balance.tsx)
export const CREDIT_LAND_S: readonly [number, number] = [0.75, 1.5]

type Color = (typeof WINFX_COLORS)[number]

export interface Point {
  x: number
  y: number
}

export interface Spark {
  x: number
  y: number
  vx: number
  vy: number
  size: number
  life: number
  color: Color
  alpha: number
}

export interface Glint {
  x: number
  y: number
  size: number
  start: number
  life: number
  spin: number
  color: Color
  alpha: number
}

export interface Credit {
  from: Point
  via: Point // the arc's control point
  to: Point
  start: number
  dur: number
}

export interface WinFx {
  age: number
  unit: number
  sparks: Spark[]
  glints: Glint[]
  credits: Credit[]
}

const SPARKS = 90
const SPARK_RIM = 0.05 // units
const GLINTS = 22
const CREDITS = 12
const DRAG = 4.5 // 1/s
const GRAVITY = 0.35 // units per s²
const RING_S = 0.75
const RING_GAP_S = 0.12
const FLASH_S = 0.35

const smooth = (p: number) => p * p * (3 - 2 * p)

// origin: the middle of the amount; target: the balance, null when it is not on screen; unit: the screen's short side
export function spawnWinFx(rng: Rng, origin: Point, target: Point | null, unit: number): WinFx {
  // from the rim of the amount, not its middle: the number stays readable through the burst
  const sparks = Array.from({ length: SPARKS }, (): Spark => {
    const a = rng() * Math.PI * 2
    const v = (1.2 + 2 * rng() * rng()) * unit
    return {
      x: origin.x + Math.cos(a) * SPARK_RIM * unit * 1.8,
      y: origin.y + Math.sin(a) * SPARK_RIM * unit,
      vx: Math.cos(a) * v,
      vy: Math.sin(a) * v,
      size: (0.0016 + 0.0018 * rng()) * unit,
      life: 0.55 + 0.6 * rng(),
      color: rng() < 0.7 ? WINFX_COLORS[0] : WINFX_COLORS[1],
      alpha: 1,
    }
  })
  // the card is wide: the glints sit in an ellipse round the amount
  const glints = Array.from({ length: GLINTS }, (): Glint => {
    const a = rng() * Math.PI * 2
    const r = (0.08 + 0.22 * rng()) * unit
    return {
      x: origin.x + Math.cos(a) * r * 1.8,
      y: origin.y + Math.sin(a) * r,
      size: (0.012 + 0.016 * rng()) * unit,
      start: 0.1 + 1.1 * rng(),
      life: 0.45 + 0.25 * rng(),
      spin: (rng() - 0.5) * 2,
      color: rng() < 0.6 ? WINFX_COLORS[1] : WINFX_COLORS[0],
      alpha: 0,
    }
  })
  const credits: Credit[] = []
  if (target) {
    const dx = target.x - origin.x
    const dy = target.y - origin.y
    const len = Math.hypot(dx, dy) || 1
    const mid = { x: origin.x + dx / 2, y: origin.y + dy / 2 }
    for (let i = 0; i < CREDITS; i++) {
      // a fan of arcs on both sides of the straight line
      const bend = (rng() < 0.5 ? -1 : 1) * (0.12 + 0.22 * rng()) * len
      const land = CREDIT_LAND_S[0] + ((CREDIT_LAND_S[1] - CREDIT_LAND_S[0]) * i) / (CREDITS - 1)
      const dur = 0.55 + 0.15 * rng()
      credits.push({
        from: { ...origin },
        via: { x: mid.x - (dy / len) * bend, y: mid.y + (dx / len) * bend },
        to: { ...target },
        start: land - dur,
        dur,
      })
    }
  }
  return { age: 0, unit, sparks, glints, credits }
}

export function stepWinFx(fx: WinFx, dt: number): void {
  fx.age += dt
  const drag = Math.exp(-DRAG * dt)
  for (const s of fx.sparks) {
    if (fx.age >= s.life) {
      s.alpha = 0
      continue
    }
    s.vx *= drag
    s.vy = s.vy * drag + GRAVITY * fx.unit * dt
    s.x += s.vx * dt
    s.y += s.vy * dt
    s.alpha = 1 - fx.age / s.life
  }
  for (const g of fx.glints) {
    const p = (fx.age - g.start) / g.life
    g.alpha = p > 0 && p < 1 ? Math.sin(Math.PI * p) : 0
  }
}

// a credit on its arc: from the amount, speeding up into the balance; invisible before and after its flight
export function creditAt(c: Credit, age: number): Point & { alpha: number } {
  const p = (age - c.start) / c.dur
  if (p < 0) return { ...c.from, alpha: 0 }
  if (p > 1) return { ...c.to, alpha: 0 }
  const e = smooth(p)
  const u = 1 - e
  return {
    x: u * u * c.from.x + 2 * u * e * c.via.x + e * e * c.to.x,
    y: u * u * c.from.y + 2 * u * e * c.via.y + e * e * c.to.y,
    alpha: Math.min(1, p / 0.12),
  }
}

// shock ring i (0, 1): radius and the width of its soft band in pixels, alpha 0..1
export function ringAt(age: number, i: number, unit: number): { radius: number; width: number; alpha: number } {
  const a = age - i * RING_GAP_S
  if (a < 0) return { radius: 0, width: 0, alpha: 0 }
  const p = Math.min(1, a / RING_S)
  const out = 1 - Math.pow(1 - p, 3)
  return {
    radius: unit * (0.06 + 0.4 * out),
    width: unit * (0.01 + 0.05 * (1 - p)),
    alpha: p >= 1 ? 0 : (1 - p) * (1 - p) * (i === 0 ? 1 : 0.7),
  }
}

export function flashAt(age: number): number {
  if (age < 0 || age >= FLASH_S) return 0
  const k = 1 - age / FLASH_S
  return k * k
}
