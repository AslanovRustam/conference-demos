import {
  BONUS_LADDER,
  COLS,
  GEM,
  LADDER,
  MIN_MATCH,
  RETRIGGER_SPINS,
  ROWS,
  SCATTER,
  SCATTERS_TO_TRIGGER,
  SYMBOLS,
  WIN_TIERS,
  type SymbolId,
  type WinTier,
} from './config'
import type { Rng } from './rng'

/** grid[col][row], row 0 is the top */
export type Grid = SymbolId[][]

export interface Cell {
  col: number
  row: number
}

export interface Win {
  symbol: SymbolId
  count: number
  positions: Cell[]
  /** in tenths of the bet, before the cascade multiplier */
  pay: number
}

export interface ColumnFall {
  col: number
  /** surviving symbols sliding down; `to >= from` */
  moves: { from: number; to: number }[]
  /** new symbols for rows 0..incoming.length-1, top to bottom */
  incoming: SymbolId[]
}

export interface CascadeStep {
  /** grid before the winning symbols are removed */
  grid: Grid
  wins: Win[]
  multiplier: number
  /** credits */
  win: number
  removed: Cell[]
  fall: ColumnFall[]
  /** grid after the refill */
  next: Grid
}

export interface SpinResult {
  bet: number
  initial: Grid
  steps: CascadeStep[]
  final: Grid
  totalWin: number
  scatterCount: number
  scatterCells: Cell[]
  freeSpinsAwarded: number
  /** ladder position after the spin; free spins continue from here */
  ladderEnd: number
}

export interface SpinOptions {
  bet: number
  rng: Rng
  ladderStart?: number
  inBonus?: boolean
  /** play out a predefined starting grid (presenter mode, tests) */
  initial?: Grid
  /** override symbol weights, indexed by symbol id */
  weights?: readonly number[]
}

const BASE_WEIGHTS = SYMBOLS.map((s) => s.weight)

function pickSymbol(rng: Rng, weights: readonly number[]): SymbolId {
  const total = weights.reduce((a, b) => a + b, 0)
  let x = rng() * total
  for (let i = 0; i < weights.length; i++) {
    x -= weights[i]
    if (x < 0) return i as SymbolId
  }
  return (weights.length - 1) as SymbolId
}

export function randomGrid(rng: Rng, weights: readonly number[] = BASE_WEIGHTS): Grid {
  return Array.from({ length: COLS }, () => Array.from({ length: ROWS }, () => pickSymbol(rng, weights)))
}

function cloneGrid(grid: Grid): Grid {
  return grid.map((col) => [...col])
}

function payFor(symbol: SymbolId, count: number): number {
  const [p8, p10, p12] = SYMBOLS[symbol].pays
  if (count >= 12) return p12
  if (count >= 10) return p10
  return p8
}

export function evaluate(grid: Grid): Win[] {
  const cells = new Map<SymbolId, Cell[]>()
  grid.forEach((col, c) =>
    col.forEach((s, r) => {
      if (s === SCATTER) return
      let list = cells.get(s)
      if (!list) cells.set(s, (list = []))
      list.push({ col: c, row: r })
    }),
  )
  const wins: Win[] = []
  for (const [symbol, positions] of cells) {
    if (positions.length < MIN_MATCH) continue
    wins.push({ symbol, count: positions.length, positions, pay: payFor(symbol, positions.length) })
  }
  return wins.sort((a, b) => a.symbol - b.symbol)
}

export function collapse(
  grid: Grid,
  removed: Cell[],
  rng: Rng,
  weights: readonly number[] = BASE_WEIGHTS,
): { next: Grid; fall: ColumnFall[] } {
  const next = cloneGrid(grid)
  const fall: ColumnFall[] = []
  for (let c = 0; c < COLS; c++) {
    const gone = new Set(removed.filter((p) => p.col === c).map((p) => p.row))
    if (gone.size === 0) continue
    const moves: ColumnFall['moves'] = []
    const survivors: SymbolId[] = []
    // walk bottom-up so survivors pack against the floor in their original order
    let target = ROWS - 1
    for (let r = ROWS - 1; r >= 0; r--) {
      if (gone.has(r)) continue
      survivors.unshift(grid[c][r])
      if (target !== r) moves.push({ from: r, to: target })
      target--
    }
    const incoming = Array.from({ length: gone.size }, () => pickSymbol(rng, weights))
    next[c] = [...incoming, ...survivors]
    fall.push({ col: c, moves, incoming })
  }
  return { next, fall }
}

export function multiplierAt(ladderIndex: number, inBonus = false): number {
  const ladder = inBonus ? BONUS_LADDER : LADDER
  return ladder[Math.min(ladderIndex, ladder.length - 1)]
}

export function freeSpinsFor(scatters: number, inBonus: boolean): number {
  if (scatters < SCATTERS_TO_TRIGGER) return 0
  if (inBonus) return RETRIGGER_SPINS
  if (scatters === 3) return 10
  if (scatters === 4) return 12
  return 15
}

export function winTier(win: number, bet: number): WinTier {
  const x = win / bet
  if (x >= WIN_TIERS.jackpot) return 'jackpot'
  if (x >= WIN_TIERS.epic) return 'epic'
  if (x >= WIN_TIERS.mega) return 'mega'
  if (x >= WIN_TIERS.big) return 'big'
  return 'none'
}

export function playSpin({ bet, rng, ladderStart = 0, inBonus = false, initial, weights = BASE_WEIGHTS }: SpinOptions): SpinResult {
  const start = initial ? cloneGrid(initial) : randomGrid(rng, weights)
  const steps: CascadeStep[] = []
  let grid = start
  let ladder = ladderStart
  for (;;) {
    const wins = evaluate(grid)
    if (wins.length === 0) break
    const multiplier = multiplierAt(ladder++, inBonus)
    const base = wins.reduce((s, w) => s + w.pay, 0)
    const removed = wins.flatMap((w) => w.positions)
    const { next, fall } = collapse(grid, removed, rng, weights)
    steps.push({ grid, wins, multiplier, win: (base * bet * multiplier) / 10, removed, fall, next })
    grid = next
  }
  const scatterCells: Cell[] = []
  grid.forEach((col, c) => col.forEach((s, r) => s === SCATTER && scatterCells.push({ col: c, row: r })))
  return {
    bet,
    initial: start,
    steps,
    final: grid,
    totalWin: steps.reduce((s, x) => s + x.win, 0),
    scatterCount: scatterCells.length,
    scatterCells,
    freeSpinsAwarded: freeSpinsFor(scatterCells.length, inBonus),
    ladderEnd: ladder,
  }
}

/** plays random spins until one satisfies `accept` */
export function findSpin(opts: SpinOptions, accept: (r: SpinResult) => boolean, tries = 4000): SpinResult | null {
  for (let i = 0; i < tries; i++) {
    const r = playSpin(opts)
    if (accept(r)) return r
  }
  return null
}

function shuffled<T>(items: T[], rng: Rng): T[] {
  const a = [...items]
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1))
    ;[a[i], a[j]] = [a[j], a[i]]
  }
  return a
}

/** two scatters land in the first five columns and the third arrives in the last one, so the anticipation plays */
export function forceBonus(opts: Omit<SpinOptions, 'initial'>): SpinResult {
  const { rng } = opts
  const noScatter = SYMBOLS.map((s) => (s.id === SCATTER ? 0 : s.weight))
  const grid = randomGrid(rng, noScatter)
  const [a, b] = shuffled([0, 1, 2, 3, 4], rng)
  grid[a][Math.floor(rng() * ROWS)] = SCATTER
  grid[b][Math.floor(rng() * ROWS)] = SCATTER
  grid[COLS - 1][Math.floor(rng() * ROWS)] = SCATTER
  return playSpin({ ...opts, initial: grid, weights: noScatter })
}

const RICH_WEIGHTS = SYMBOLS.map((s) => (s.id === SCATTER ? 0 : s.tier === 'high' ? s.weight * 2.5 : s.weight))

/** a guaranteed mega+ win with a visible cascade chain */
export function forceBigWin(opts: Omit<SpinOptions, 'initial'>): SpinResult {
  const accept = (r: SpinResult) =>
    r.steps.length >= 2 && r.scatterCount < SCATTERS_TO_TRIGGER && winTier(r.totalWin, opts.bet) !== 'none' && winTier(r.totalWin, opts.bet) !== 'big'
  const found = findSpin({ ...opts, weights: RICH_WEIGHTS }, accept, 3000)
  if (found) return found

  // fallback: build it — ten rubies plus eight ingots guarantee two pays on the first drop
  const { rng } = opts
  for (;;) {
    const grid = randomGrid(rng, RICH_WEIGHTS)
    const cells = shuffled(
      Array.from({ length: COLS * ROWS }, (_, i) => ({ col: Math.floor(i / ROWS), row: i % ROWS })),
      rng,
    )
    cells.slice(0, 10).forEach((p) => (grid[p.col][p.row] = GEM))
    cells.slice(10, 18).forEach((p) => (grid[p.col][p.row] = 6))
    const r = playSpin({ ...opts, initial: grid, weights: RICH_WEIGHTS })
    if (accept(r)) return r
  }
}

export interface BonusPlan {
  spins: SpinResult[]
  total: number
}

function simulateBonus(bet: number, rng: Rng, spins: number, weights?: readonly number[]): BonusPlan {
  const out: SpinResult[] = []
  let left = spins
  let ladder = 0
  let total = 0
  // the cap only guards against an endless retrigger chain
  while (left > 0 && out.length < 60) {
    left--
    const r = playSpin({ bet, rng, ladderStart: ladder, inBonus: true, weights })
    ladder = r.ladderEnd
    total += r.totalWin
    left += r.freeSpinsAwarded
    out.push(r)
  }
  return { spins: out, total }
}

/** the whole free-spins round is decided up front so every bonus ends in a celebration */
export function planBonus({
  bet,
  rng,
  spins,
  minWin = 15,
  maxSpins = Infinity,
}: {
  bet: number
  rng: Rng
  spins: number
  /** total win in bets the bonus must reach */
  minWin?: number
  /** cap on free spins including retriggers, to keep showcases short */
  maxSpins?: number
}): BonusPlan {
  let best: BonusPlan | null = null
  // first with the real symbol mix, then with richer reels for showcase targets the real mix rarely reaches
  for (const weights of [undefined, RICH_WEIGHTS]) {
    for (let attempt = 0; attempt < 400; attempt++) {
      const plan = simulateBonus(bet, rng, spins, weights)
      if (plan.spins.length > maxSpins) continue
      if (plan.total >= bet * minWin) return plan
      if (!best || plan.total > best.total) best = plan
    }
  }
  return best!
}

/** a pleasant first impression: at least 5x the bet over a chain of two or more cascades */
export function showcaseSpin(opts: Omit<SpinOptions, 'initial'>): SpinResult {
  const accept = (r: SpinResult) => r.steps.length >= 2 && r.totalWin >= opts.bet * 5 && r.scatterCount < SCATTERS_TO_TRIGGER
  return findSpin(opts, accept, 4000) ?? findSpin({ ...opts, weights: RICH_WEIGHTS }, accept, 4000) ?? forceBigWin(opts)
}
