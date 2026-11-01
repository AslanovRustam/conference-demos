import { S } from '../strings'

const credits = new Intl.NumberFormat('en-US', { maximumFractionDigits: 0 })
const pad2 = (n: number) => String(n).padStart(2, '0')

// 9563 -> 9,563
export function formatCredits(n: number): string {
  return credits.format(n)
}

// always two decimals, no grouping, no ×: the component draws the sign
export function formatMult(m: number): string {
  return m.toFixed(2)
}

// broadcast clock: T+00:12.4, negative values count down as T-00:02.4
export function formatClock(t: number): string {
  const tenths = Math.floor(Math.abs(t) * 10 + 1e-6)
  const sign = t < 0 && tenths > 0 ? S.tMinus : S.tPlus
  const min = Math.floor(tenths / 600)
  const sec = Math.floor((tenths % 600) / 10)
  return `${sign}${pad2(min)}:${pad2(sec)}.${tenths % 10}`
}

// meters below 1 km, one decimal below 1000 km, grouped integers above
export function formatAlt(km: number): string {
  const m = Math.round(km * 1000)
  if (m < 1000) return `${S.alt} ${m} ${S.meters}`
  const tenth = Math.round(km * 10) / 10
  if (tenth < 1000) return `${S.alt} ${tenth.toFixed(1)} ${S.km}`
  return `${S.alt} ${credits.format(Math.round(km))} ${S.km}`
}

export function formatVel(kms: number): string {
  return `${S.vel} ${kms.toFixed(2)} ${S.kms}`
}
