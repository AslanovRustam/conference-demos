import { MAX_MULT, MULT_RATE } from './config'

export function multiplierAt(t: number): number {
  return Math.min(Math.exp(MULT_RATE * t), MAX_MULT)
}

export function timeAt(m: number): number {
  return Math.log(m) / MULT_RATE
}
