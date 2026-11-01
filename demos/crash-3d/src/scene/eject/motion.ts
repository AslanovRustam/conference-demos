// the crew capsule after a cash out: plain kinematics in the capsule's own frame of absolute altitude, so the
// scene can place it in the floating-origin near field (y = alt - rig.nearOffset) while the rocket climbs away

export type EjectKind = 'chute' | 'retro'

export interface EjectState {
  kind: EjectKind
  t: number // seconds since the separation
  x: number
  alt: number // metres above the pad
  z: number
  vx: number
  vy: number
  vz: number
  heading: number // the side the capsule peels off to, radians around y
  tilt: number // lean away from upright, radians
  spin: number // roll around its own axis, radians
}

const KICK_UP = 14 // m/s, the separation motors
const KICK_UP_RETRO = 4 // the thrusters take over at once, so only a short hop off the adapter
const KICK_SIDE = 8
const G_AIR = 9.81
const G_HIGH = 2 // up there it only drifts down a little, the rocket racing off does the rest
const DROGUE_AT = 0.6
const MAIN_AT = 1.2
const DROGUE_OPEN_S = 0.25
const MAIN_OPEN_S = 0.55
const DRAG_FREE = 0.05 // 1/s
const DRAG_DROGUE = 0.3
const DRAG_MAIN = 1.1 // terminal sink g / (free + drogue + main) ≈ 6.8 m/s
const RETRO_ON_S = 0.08
const RETRO_BURN_S = 1.25
const RETRO_OFF_S = 0.45
const RETRO_SIDE = 22 // m/s², along the heading
const RETRO_DOWN = 10
const TUMBLE = 0.6 // rad/s while nothing holds it upright

const clamp01 = (x: number) => Math.min(1, Math.max(0, x))

export function ejectKind(stage: number): EjectKind {
  return stage <= 1 ? 'chute' : 'retro'
}

export function drogueOpen(t: number): number {
  const k = clamp01((t - DROGUE_AT) / DROGUE_OPEN_S)
  return k * k * (3 - 2 * k)
}

// the main canopy snaps open past its size and settles back
export function mainOpen(t: number): number {
  const k = (t - MAIN_AT) / MAIN_OPEN_S
  if (k <= 0) return 0
  if (k >= 3) return 1
  return 1 - Math.exp(-4 * k) * Math.cos(5 * k)
}

export function retroThrust(t: number): number {
  if (t <= 0) return 0
  if (t < RETRO_ON_S) return t / RETRO_ON_S
  if (t < RETRO_BURN_S) return 1
  return clamp01(1 - (t - RETRO_BURN_S) / RETRO_OFF_S)
}

export function startEject(kind: EjectKind, at: { x: number; alt: number; z: number }, heading: number): EjectState {
  return {
    kind,
    t: 0,
    x: at.x,
    alt: at.alt,
    z: at.z,
    vx: Math.cos(heading) * KICK_SIDE,
    vy: kind === 'chute' ? KICK_UP : KICK_UP_RETRO,
    vz: Math.sin(heading) * KICK_SIDE,
    heading,
    tilt: 0,
    spin: 0,
  }
}

export function stepEject(s: EjectState, dt: number): void {
  s.t += dt
  if (s.kind === 'chute') {
    const drogue = drogueOpen(s.t)
    const main = Math.min(1, mainOpen(s.t))
    const drag = DRAG_FREE + DRAG_DROGUE * drogue + DRAG_MAIN * main
    const k = Math.exp(-drag * dt)
    s.vx *= k
    s.vz *= k
    s.vy = s.vy * k - G_AIR * dt
    // tumbles off the rocket until the lines pull it upright
    s.tilt += TUMBLE * dt * (1 - drogue)
    s.tilt *= Math.exp(-2.5 * main * dt)
    s.spin += 0.4 * dt
  } else {
    const thrust = retroThrust(s.t)
    s.vx += Math.cos(s.heading) * RETRO_SIDE * thrust * dt
    s.vz += Math.sin(s.heading) * RETRO_SIDE * thrust * dt
    s.vy += (-RETRO_DOWN * thrust - G_HIGH) * dt
    s.tilt += TUMBLE * 0.5 * dt
    s.spin += 0.9 * dt
  }
  s.x += s.vx * dt
  s.alt += s.vy * dt
  s.z += s.vz * dt
}

