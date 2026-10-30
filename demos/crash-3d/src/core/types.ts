import type { StageId } from './stages'

export type Phase = 'betting' | 'countdown' | 'flight' | 'ejected' | 'crashed' | 'result'
export type PresenterForce = 'warp' | 'instant'
export type RareKind = 'meteors' | 'aurora' | 'station' | 'sunrise'
export interface RarePlan {
  kind: RareKind
  atStage: number // stageFloat at which it starts
}
export interface HistoryEntry {
  crash: number
  won: boolean
}
export interface RoundSnapshot {
  phase: Phase
  balance: number
  bet: number
  auto: { enabled: boolean; value: number }
  countdown: number // seconds left, 0 outside countdown
  t: number // rocket clock since liftoff
  multiplier: number // rocket multiplier, floor2; keeps growing after cash out
  cashedAt: number | null // player's multiplier after cash out
  payout: number // credits won this round
  crashPoint: number | null // revealed only once crashed
  stage: StageId
  phaseAge: number // real seconds since the phase began
  history: HistoryEntry[] // newest first
  armed: PresenterForce | null
  attract: boolean
  rare: RarePlan | null
  frozen: boolean
}
