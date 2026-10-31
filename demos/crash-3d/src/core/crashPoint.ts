import { CRASH_ANCHORS, MAX_MULT, MIN_FLIGHT_S } from './config'
import { multiplierAt } from './curve'
import { floor2 } from './rng'

const A = CRASH_ANCHORS
const LAST = A.length - 1

// log-log interpolation between anchors
export function survival(x: number): number {
  if (x < 1) return 1
  if (x < A[0][0]) return A[0][1]
  if (x >= MAX_MULT) return 0
  let i = 0
  while (i < LAST - 1 && x >= A[i + 1][0]) i++
  const [x0, s0] = A[i]
  const [x1, s1] = A[i + 1]
  return s0 * Math.pow(s1 / s0, Math.log(x / x0) / Math.log(x1 / x0))
}

export function sampleCrashPoint(u: number): number {
  if (u >= A[0][1]) return 1
  if (u < A[LAST][1]) return MAX_MULT
  let i = 0
  while (i < LAST - 1 && u < A[i + 1][1]) i++
  const [x0, s0] = A[i]
  const [x1, s1] = A[i + 1]
  const x = x0 * Math.pow(x1 / x0, Math.log(u / s0) / Math.log(s1 / s0))
  return floor2(x)
}

// the lowest crash point of a player round: MIN_FLIGHT_S into the flight, rounded up to whole cents
export const MIN_CRASH = Math.ceil(multiplierAt(MIN_FLIGHT_S) * 100) / 100

// a player round: the anchors' distribution past MIN_CRASH, S(x | x >= MIN_CRASH) = S(x) / S(MIN_CRASH)
export function samplePlayerCrash(u: number): number {
  return Math.max(MIN_CRASH, sampleCrashPoint(u * survival(MIN_CRASH)))
}
