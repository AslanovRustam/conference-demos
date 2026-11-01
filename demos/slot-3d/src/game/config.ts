// Game math for "Neon Vault". All payouts are stored in tenths of the bet so that
// wins stay whole numbers for every bet in BETS (all bets are multiples of 10).

export const COLS = 6
export const ROWS = 5
export const MIN_MATCH = 8

export type SymbolId = 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8
export type Tier = 'low' | 'high' | 'scatter'

export interface SymbolDef {
  id: SymbolId
  key: string
  tier: Tier
  /** neon / material accent used by the scene and particles */
  color: string
  /** relative chance to appear in a cell */
  weight: number
  /** payout in tenths of the bet for 8–9, 10–11 and 12+ symbols */
  pays: readonly [number, number, number]
}

export const SYMBOLS: readonly SymbolDef[] = [
  { id: 0, key: 'emerald', tier: 'low', color: '#19d97a', weight: 18, pays: [1, 5, 12] },
  { id: 1, key: 'sapphire', tier: 'low', color: '#2f6bff', weight: 17, pays: [2, 6, 25] },
  { id: 2, key: 'amethyst', tier: 'low', color: '#a54dff', weight: 16, pays: [3, 6, 30] },
  { id: 3, key: 'topaz', tier: 'low', color: '#ffa31a', weight: 15, pays: [5, 8, 50] },
  { id: 4, key: 'coin', tier: 'high', color: '#ffc23d', weight: 12, pays: [6, 10, 60] },
  { id: 5, key: 'key', tier: 'high', color: '#ff1923', weight: 10, pays: [10, 12, 75] },
  { id: 6, key: 'bars', tier: 'high', color: '#ffd76a', weight: 8, pays: [12, 30, 90] },
  { id: 7, key: 'diamond', tier: 'high', color: '#dff3ff', weight: 4, pays: [60, 150, 300] },
  { id: 8, key: 'scatter', tier: 'scatter', color: '#ffd76a', weight: 1.7, pays: [0, 0, 0] },
]

export const SCATTER: SymbolId = 8
export const GEM: SymbolId = 7

/** multiplier for the 1st, 2nd, 3rd… winning cascade of a series */
export const LADDER = [1, 2, 3, 5, 8, 12, 20, 30, 50] as const
/** free spins keep climbing this gentler ladder across the whole bonus */
export const BONUS_LADDER = [1, 2, 3, 4, 5, 6, 7, 8, 10, 12, 15, 20, 25] as const

export const SCATTERS_TO_TRIGGER = 3
export const RETRIGGER_SPINS = 5

export const BETS = [10, 20, 50, 100, 200, 500] as const
export const DEFAULT_BET = 100
export const START_BALANCE = 100_000

/** total spin win, in bets, needed for each celebration tier */
export const WIN_TIERS = { big: 15, mega: 40, epic: 100, jackpot: 200 } as const
export type WinTier = 'none' | 'big' | 'mega' | 'epic' | 'jackpot'

/** a spin that has not seen a bonus for this many spins starts one (a showcase that ends in a jackpot) */
export const GUARANTEED_BONUS_EVERY = 5
