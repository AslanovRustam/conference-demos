import { CRASH_ANCHORS, MAX_MULT } from './config'
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
