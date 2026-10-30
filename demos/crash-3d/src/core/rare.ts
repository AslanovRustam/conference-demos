import type { Rng } from './rng'
import { stageFloat } from './stages'
import type { RareKind, RarePlan } from './types'

// stageFloat windows in which each rare event may start
export const RARE_WINDOWS: Record<RareKind, [number, number]> = {
  sunrise: [2.2, 3.5],
  aurora: [3.1, 3.9],
  station: [3.2, 3.9],
  meteors: [3.3, 4.8],
}
export const RARE_CHANCE = 0.25
// an event starts at least this far (in stageFloat) before the crash, so the rocket is there to see it
const RARE_MARGIN = 0.1

const KINDS = Object.keys(RARE_WINDOWS) as RareKind[]

// one round in RARE_CHANCE gets an event the rocket will live to see, at a random point of its window
export function pickRare(rng: Rng, crashPoint: number): RarePlan | null {
  const limit = stageFloat(crashPoint) - RARE_MARGIN
  const open = KINDS.filter((k) => RARE_WINDOWS[k][0] < limit)
  if (open.length === 0 || rng() >= RARE_CHANCE) return null
  const kind = open[Math.min(open.length - 1, Math.floor(rng() * open.length))]
  const [lo, hi] = RARE_WINDOWS[kind]
  return { kind, atStage: lo + rng() * (Math.min(hi, limit) - lo) }
}

// debug (?rare=<kind>): the event at the opening of its window
export function forcedRare(kind: RareKind): RarePlan {
  return { kind, atStage: RARE_WINDOWS[kind][0] }
}
