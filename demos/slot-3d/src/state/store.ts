import { create } from 'zustand'
import { BETS, DEFAULT_BET, START_BALANCE, type WinTier } from '../game/config'
import { params, type Quality } from './params'

export interface FreeSpins {
  left: number
  total: number
  won: number
  /** position on the bonus multiplier ladder, kept across free spins */
  ladder: number
}

export interface StepWin {
  id: number
  amount: number
  multiplier: number
}

export type Banner =
  | { kind: 'freeSpins'; value: number; retrigger: boolean }
  | { kind: 'bonusEnd'; value: number }
  | { kind: 'refill'; value: number }

export interface BigWin {
  tier: WinTier
  shown: number
  target: number
}

interface State {
  /** the 3D scene has mounted */
  ready: boolean
  /** the vault has been opened at least once (audio unlocked) */
  started: boolean
  /** the vault door: closed on the start screen and in attract mode, moving while it swings */
  vault: 'closed' | 'moving' | 'open'
  balance: number
  bet: number
  /** total win of the current or last spin */
  spinWin: number
  stepWin: StepWin | null
  multiplier: number
  /** a new multiplier value flying into view */
  multiplierFx: { id: number; value: number } | null
  busy: boolean
  turbo: boolean
  /** remaining auto spins, Infinity for endless, 0 when off */
  autoplay: number
  freeSpins: FreeSpins | null
  bigWin: BigWin | null
  banner: Banner | null
  attract: boolean
  quality: Quality
  /** automatic resolution scale on top of the quality tier's DPR */
  dprScale: number
  /** a resolution change waiting for the next spin, which hides the resize */
  pendingDprScale: number | null
  showFps: boolean
  presenterPanel: boolean
  muted: boolean
  /** world palette: 0 neon vault, 1 golden treasury */
  world: 'vault' | 'treasury'

  set: (patch: Partial<State>) => void
  changeBet: (dir: 1 | -1) => void
}

export const useGame = create<State>((set, get) => ({
  ready: false,
  started: false,
  vault: 'closed',
  balance: START_BALANCE,
  bet: DEFAULT_BET,
  spinWin: 0,
  stepWin: null,
  multiplier: 1,
  multiplierFx: null,
  busy: false,
  turbo: false,
  autoplay: 0,
  freeSpins: null,
  bigWin: null,
  banner: null,
  attract: false,
  quality: params.quality,
  dprScale: 1,
  pendingDprScale: null,
  showFps: false,
  presenterPanel: params.presenter,
  muted: false,
  world: 'vault',

  set: (patch) => set(patch),
  changeBet: (dir) => {
    const { bet, busy, freeSpins } = get()
    if (busy || freeSpins) return
    const i = BETS.indexOf(bet as (typeof BETS)[number])
    const next = BETS[Math.max(0, Math.min(BETS.length - 1, i + dir))]
    set({ bet: next })
  },
}))

export const game = () => useGame.getState()
