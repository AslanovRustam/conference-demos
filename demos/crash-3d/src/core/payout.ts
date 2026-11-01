// credits paid for a bet at a multiplier. multipliers are whole cents, so work in
// integer cents: 100 × 1.15 in floats is 114.99999999999999 and would floor to 114
export function payoutFor(bet: number, m: number): number {
  return Math.floor((bet * Math.round(m * 100)) / 100)
}
