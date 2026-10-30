import { MAX_MULT, STAGE_THRESHOLDS } from './config'

export type StageId = 0 | 1 | 2 | 3 | 4 | 5

const T = STAGE_THRESHOLDS

export function stageAt(m: number): StageId {
  let s = 0
  for (let i = 1; i < T.length; i++) if (m >= T[i]) s = i
  return s as StageId
}

// continuous stage position, 0..6
export function stageFloat(m: number): number {
  const i = stageAt(m)
  const hi = i === 5 ? MAX_MULT : T[i + 1]
  return i + Math.log(m / T[i]) / Math.log(hi / T[i])
}
