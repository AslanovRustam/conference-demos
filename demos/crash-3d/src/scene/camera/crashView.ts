import { Vector3 } from 'three'
import { multiplierAt } from '../../core/curve'

// the one-screen crash view, like the classic crash games: a fixed side camera, the multiplier chart drawn from the
// bottom left, the rocket riding its tip. on the pad the rocket sits at the chart's origin; it climbs to the anchor
// in the upper right within the first seconds and stays there while the world falls away. points are in ndc
export interface ViewLayout {
  origin: [number, number] // the chart's origin: where the rocket stands on the pad
  anchor: [number, number] // where the rocket rides once it has climbed
  dist: number // camera distance from the rocket's middle, metres
  fov: number // vertical, degrees
  tickCeiling: number // axis labels stay below this (the big multiplier sits above it on the left)
  capsule: [number, number] // where the capsule rides after a cash out (the win card sits under it)
  capsuleZoom: number // its camera distance, as a factor on capsuleDist
}

export const LANDSCAPE: ViewLayout = { origin: [-0.74, -0.58], anchor: [0.4, 0.4], dist: 340, fov: 40, tickCeiling: -0.1, capsule: [0, 0.22], capsuleZoom: 1 }
// a tall phone: the hud takes the top and the bottom, the rocket rides lower and smaller
export const PORTRAIT: ViewLayout = { origin: [-0.66, -0.3], anchor: [0.42, 0.28], dist: 480, fov: 46, tickCeiling: 0.2, capsule: [0, 0.06], capsuleZoom: 1.35 }

export const layoutFor = (aspect: number): ViewLayout => (aspect < 1 ? PORTRAIT : LANDSCAPE)

const CROSS_S = 6 // flight seconds to cross to the anchor
const RISE_S = 2.6 // and to rise to it (the rocket climbs fast, then the chart leans over)

// exact at both ends: the rocket sits right on the anchor once there
const mix = (a: number, b: number, k: number) => a * (1 - k) + b * k

const smooth = (x: number) => {
  const k = Math.min(1, Math.max(0, x))
  return k * k * (3 - 2 * k)
}

// the rocket's screen point after t seconds of flight
export function tipAt(t: number, L: ViewLayout): { x: number; y: number } {
  const [ox, oy] = L.origin
  const [ax, ay] = L.anchor
  return { x: mix(ox, ax, smooth(t / CROSS_S)), y: mix(oy, ay, smooth(t / RISE_S)) }
}

// the camera distance: closer on the pad (the rocket and its tower fill the corner), pulling back to the layout's
// distance over the first seconds of flight
const PAD_ZOOM = 0.5
const PULL_S = 2.5
export function distAt(t: number, L: ViewLayout): number {
  return L.dist * mix(PAD_ZOOM, 1, smooth(t / PULL_S))
}

// after a cash out the camera leaves the rocket to its fate and stays with the crew capsule: it hands over within
// the first second (age: seconds since the separation), frames the capsule at the layout's capsule point, close,
// wider under parachutes so the canopy above fits
const FOLLOW_FROM_S = 0.1
const FOLLOW_S = 1.1
export function followAt(age: number | null): number {
  return age === null ? 0 : smooth((age - FOLLOW_FROM_S) / (FOLLOW_S - FOLLOW_FROM_S))
}

export function capsuleDist(kind: 'chute' | 'retro'): number {
  return kind === 'chute' ? 75 : 36
}

// the chart: n points of (τ, m(τ)) for τ in [0, t], scaled into the box from the origin to the rocket. time runs
// along x, the multiplier up y; both axes rescale as the round goes on, so the curve always ends at the rocket
export function chartPoints(t: number, n: number, L: ViewLayout): { x: number; y: number }[] {
  const [ox, oy] = L.origin
  const tip = tipAt(t, L)
  const rise = multiplierAt(t) - 1
  return Array.from({ length: n }, (_, i) => {
    const f = n > 1 ? i / (n - 1) : 1
    const up = rise > 0 ? (multiplierAt(t * f) - 1) / rise : 0
    return { x: ox + (tip.x - ox) * f, y: oy + (tip.y - oy) * up }
  })
}

const TICKS = [500, 200, 100, 50, 20, 10, 5, 3, 2, 1.5, 1.2]
const TICK_GAP = 0.1 // ndc between labels (and the rocket)
const MAX_TICKS = 4

// round multipliers on the chart's y axis, under the current one, top down, never crowded
export function chartTicks(t: number, L: ViewLayout): { value: number; y: number }[] {
  const m = multiplierAt(t)
  if (m <= 1) return []
  const oy = L.origin[1]
  const tip = tipAt(t, L)
  const out: { value: number; y: number }[] = []
  let last = tip.y
  for (const value of TICKS) {
    if (value >= m || out.length >= MAX_TICKS) continue
    const y = oy + (tip.y - oy) * ((value - 1) / (m - 1))
    if (y > L.tickCeiling || last - y < TICK_GAP) continue
    out.push({ value, y })
    last = y
  }
  return out
}

// where the camera (looking along -z, unrotated) stands so the rocket's middle lands on the tip
export function cameraFor(
  rocket: Vector3,
  tip: { x: number; y: number },
  dist: number,
  fov: number,
  aspect: number,
  out: Vector3,
): Vector3 {
  const tanV = Math.tan((fov * Math.PI) / 360)
  return out.set(rocket.x - tip.x * dist * tanV * aspect, rocket.y - tip.y * dist * tanV, rocket.z + dist)
}
