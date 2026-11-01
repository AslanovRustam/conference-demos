import type { RareKind, RarePlan } from '../../core/types'

// where a frozen flight (?freeze) holds each event, as a fraction of it: the moment worth a screenshot
export const RARE_FREEZE_P: Record<RareKind, number> = { sunrise: 0.4, aurora: 0.5, station: 0.5, meteors: 0.6 }

export interface RareShow {
  plan: RarePlan | null // the plan this show belongs to
  kind: RareKind | null
  active: boolean
  started: boolean
  age: number // visual seconds since it started
  dur: number // 4–6 s
  p: number // 0..1 through it
}

export function createRareShow(): RareShow {
  return { plan: null, kind: null, active: false, started: false, age: 0, dur: 5, p: 0 }
}

// 4–6 s, fixed per plan
const durationOf = (plan: RarePlan) => 4 + 2 * ((plan.atStage * 977.31) % 1)

// the event of this round: starts once the rocket passes atStage, runs its duration once; ends with the flight
export function stepRare(show: RareShow, plan: RarePlan | null, stageF: number, live: boolean, frozen: boolean, dt: number): void {
  if (!plan || !live) {
    Object.assign(show, createRareShow())
    return
  }
  if (show.plan !== plan) Object.assign(show, createRareShow(), { plan, kind: plan.kind, dur: durationOf(plan) })
  if (!show.started) {
    if (stageF < plan.atStage) return
    show.started = true
    show.age = 0
  } else {
    show.age += dt
  }
  if (frozen) show.age = show.dur * RARE_FREEZE_P[plan.kind]
  show.p = Math.min(1, show.age / show.dur)
  show.active = show.age < show.dur
}
