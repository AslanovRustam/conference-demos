import { Vector3 } from 'three'
import { hullRadiusAt } from '../rocket/geometry'

// launch pad layout in pad space: meters, +y up, the rocket's axis at x = z = 0, its livery towards +z.
// the deck of the launch mount is y = 0, the rocket's nozzle exit plane: the engines hang into an opening in the deck
// and the exhaust falls through it, between the mount legs, into the flame trench below the hardstand.
// the whole pad sinks by rig.nearOffset with the rest of the near field

export const GROUND_Y = -10 // hardstand level
export const HIDE_ALT_M = 30000 // past this altitude the pad is not drawn at all

// launch mount: a concrete table on four legs
export const DECK_HALF = 10
export const DECK_THICK = 3.2
export const DECK_HOLE_R = 5.2
export const LEG_AT = 7.9 // leg centers at (±LEG_AT, ±LEG_AT)
export const LEG_HALF = 1.5
// hold-down clamps between the fins, holding the aft skirt rim (rocket DIM.skirtBottom = 2.4)
export const CLAMP_AZ = [0, 0.5, 1, 1.5].map((k) => k * Math.PI)
export const CLAMP_TOP = 2.4

// flame trench: an open channel along z under the mount, a wedge deflector under the engines splits the
// exhaust both ways, the floor ramps back up to the hardstand at both exits
export const TRENCH_HALF_W = 6
export const TRENCH_FLOOR_Y = GROUND_Y - 8
export const TRENCH_EXIT = 62 // |z| of the exits
export const TRENCH_RAMP = 18 // length of the exit ramps
export const DEFLECTOR_TOP = GROUND_Y - 3.5

export const HARDSTAND_R = 85 // round concrete apron
export const GROUND_R = 20000

// service tower on the -x side, its arms reach the rocket over the deck
export const TOWER = {
  x: -17,
  z: 0,
  half: 4.5, // square cross-section
  top: 58, // roof height (pad space)
  level: 4, // height of one lattice bay
}
// arms: height of the arm floor, which tower corner holds the hinge (+1 / -1 z), swing-away order
export const ARMS = [
  { y: 43.2, side: 1, start: 0, kind: 'crew' as const }, // crew access arm to the capsule hatch
  { y: 33.4, side: -1, start: 0.18, kind: 'umbilical' as const }, // upper stage umbilical
  { y: 21.5, side: 1, start: 0.34, kind: 'umbilical' as const }, // first stage lox arm
]
export const ARM_SWING = 1.05 // seconds per arm
const ARM_BRACKET = 1.4 // hinges stand off the tower face by this much, so a folded arm clears the lattice

// an arm's hinge by a tower corner, its yaw (rotation.y) when it reaches the rocket, its yaw folded flat along the
// tower face towards the other corner, and its length to the hull
export function armFrame(a: (typeof ARMS)[number]): { hinge: Vector3; yaw: number; away: number; len: number } {
  const hinge = new Vector3(TOWER.x + TOWER.half + ARM_BRACKET, a.y, TOWER.z + a.side * (TOWER.half - 0.7))
  const dx = -hinge.x
  const dz = -hinge.z
  const len = Math.hypot(dx, dz) - hullRadiusAt(a.y + 1) - 0.15
  return { hinge, yaw: Math.atan2(-dz, dx), away: (a.side * Math.PI) / 2, len }
}

// where an extended arm meets the rocket
export function armTip(a: (typeof ARMS)[number]): Vector3 {
  const { hinge, yaw, len } = armFrame(a)
  return new Vector3(hinge.x + Math.cos(yaw) * len, a.y + 1, hinge.z - Math.sin(yaw) * len)
}

// floodlights: masts around the pad with banks of cold lamps aimed at the rocket and the tower, plus two
// xenon searchlights on the ground throwing beams up past the rocket into the sky.
// azimuth 0 = +z, towards +x; the masts sit near the lamp banks the pad environment map reflects
export interface FloodSpec {
  az: number
  dist: number // from the rocket axis, m
  head: number // lamp height (pad space)
  aim: [number, number, number]
  color: [number, number, number] // linear
  cd: number // luminous intensity, candela
  angle: number // cone half angle, rad
  penumbra: number
  beam: number // length of the visible beam, m
  glow: number // brightness of the visible beam
  mast: boolean // on a mast with a lamp bank, or a searchlight on the ground
}

const COLD: [number, number, number] = [0.74, 0.84, 1]
const XENON: [number, number, number] = [0.86, 0.9, 1]

export const FLOODS: FloodSpec[] = [
  { az: 5.4, dist: 106, head: 30, aim: [0, 19, 0], color: COLD, cd: 62000, angle: 0.3, penumbra: 0.45, beam: 150, glow: 1, mast: true },
  { az: 1.3, dist: 98, head: 28, aim: [0, 17, 0], color: COLD, cd: 52000, angle: 0.3, penumbra: 0.45, beam: 140, glow: 1, mast: true },
  { az: 2.45, dist: 92, head: 34, aim: [0, 24, 0], color: COLD, cd: 56000, angle: 0.3, penumbra: 0.5, beam: 140, glow: 1, mast: true },
  { az: 4.2, dist: 112, head: 32, aim: [-7, 22, 0], color: COLD, cd: 62000, angle: 0.33, penumbra: 0.5, beam: 160, glow: 1, mast: true },
  { az: 0.85, dist: 46, head: GROUND_Y + 1.2, aim: [0, 75, 0], color: XENON, cd: 34000, angle: 0.1, penumbra: 0.6, beam: 420, glow: 1.4, mast: false },
  { az: 3.75, dist: 52, head: GROUND_Y + 1.2, aim: [1, 85, -2], color: XENON, cd: 34000, angle: 0.09, penumbra: 0.6, beam: 440, glow: 1.4, mast: false },
]

export const floodPos = (f: FloodSpec) => new Vector3(Math.sin(f.az) * f.dist, f.head, Math.cos(f.az) * f.dist)

// steam vents: lox boil-off on the rocket (rocket space: height, azimuth) streams down the hull, valves on the deck
// and at the foot of the tower puff upwards, the wet trench breathes mist
export const ROCKET_VENTS = [
  { y: 26.6, az: 2.15 },
  { y: 38.8, az: -1.05 },
]
export const DECK_VENTS: [number, number, number][] = [
  [8.6, 0.3, 3.2],
  [-8.4, 0.3, -3.6],
  [3.4, 0.3, -8.6],
  [-3.1, 0.3, 8.7],
  [TOWER.x + TOWER.half + 0.5, 1.2, 3.6],
  [TOWER.x + TOWER.half + 0.5, 22, -3.2],
]
