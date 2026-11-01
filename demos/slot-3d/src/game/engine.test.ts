import { describe, expect, it } from 'vitest'
import { COLS, GEM, LADDER, ROWS, SCATTER, SYMBOLS, type SymbolId } from './config'
import {
  collapse,
  evaluate,
  forceBigWin,
  forceBonus,
  freeSpinsFor,
  showcaseSpin,
  multiplierAt,
  planBonus,
  playSpin,
  randomGrid,
  winTier,
  type Grid,
} from './engine'
import { mulberry32 } from './rng'

/** builds a grid where every cell is `fill`, then applies [col,row,symbol] overrides */
function gridOf(fill: SymbolId, overrides: [number, number, SymbolId][] = []): Grid {
  const g: Grid = Array.from({ length: COLS }, () => Array<SymbolId>(ROWS).fill(fill))
  for (const [c, r, s] of overrides) g[c][r] = s
  return g
}

/** a grid with no symbol repeated 8+ times: 30 cells over 6 symbols, 5 each */
function noWinGrid(): Grid {
  return Array.from({ length: COLS }, (_, c) =>
    Array.from({ length: ROWS }, (_, r) => ((c + r * 2) % 6) as SymbolId),
  )
}

function countOf(grid: Grid, s: SymbolId) {
  return grid.flat().filter((x) => x === s).length
}

describe('rng', () => {
  it('is deterministic for a seed', () => {
    const a = mulberry32(42)
    const b = mulberry32(42)
    const xs = Array.from({ length: 5 }, a)
    expect(Array.from({ length: 5 }, b)).toEqual(xs)
    for (const x of xs) {
      expect(x).toBeGreaterThanOrEqual(0)
      expect(x).toBeLessThan(1)
    }
  })
})

describe('evaluate', () => {
  it('has no wins on a grid without 8 of a kind', () => {
    expect(evaluate(noWinGrid())).toEqual([])
  })

  it('pays 8+ identical symbols anywhere on the grid', () => {
    const g = noWinGrid()
    // put eight rubies on cells spread over all columns
    const cells: [number, number][] = [[0, 0], [1, 3], [2, 1], [3, 4], [4, 2], [5, 0], [5, 4], [0, 4]]
    for (const [c, r] of cells) g[c][r] = GEM
    const wins = evaluate(g)
    expect(wins).toHaveLength(1)
    expect(wins[0].symbol).toBe(GEM)
    expect(wins[0].count).toBe(8)
    expect(wins[0].pay).toBe(SYMBOLS[GEM].pays[0])
    expect(wins[0].positions).toHaveLength(8)
  })

  it('uses the 10–11 and 12+ pay steps', () => {
    const ten = gridOf(1, Array.from({ length: 20 }, (_, i) => [Math.floor(i / ROWS), i % ROWS, (2 + (i % 4)) as SymbolId]))
    // 10 cells of symbol 1 remain in the last two columns
    expect(countOf(ten, 1)).toBe(10)
    expect(evaluate(ten).find((w) => w.symbol === 1)?.pay).toBe(SYMBOLS[1].pays[1])

    const all = gridOf(0)
    expect(evaluate(all)[0].pay).toBe(SYMBOLS[0].pays[2])
  })

  it('never pays scatters as a line win', () => {
    const g = gridOf(SCATTER)
    expect(evaluate(g)).toEqual([])
  })
})

describe('collapse', () => {
  it('drops survivors down, keeps their order and refills from the top', () => {
    const g = noWinGrid()
    const column = [...g[2]]
    const removed = [
      { col: 2, row: 1 },
      { col: 2, row: 3 },
    ]
    const { next, fall } = collapse(g, removed, mulberry32(1))
    const survivors = column.filter((_, r) => r !== 1 && r !== 3)
    // survivors occupy the bottom rows in the same order
    expect(next[2].slice(2)).toEqual(survivors)
    const col = fall.find((f) => f.col === 2)!
    expect(col.incoming).toHaveLength(2)
    expect(next[2].slice(0, 2)).toEqual(col.incoming)
    // every move goes down (or stays)
    for (const m of col.moves) expect(m.to).toBeGreaterThanOrEqual(m.from)
    // untouched columns stay identical
    expect(next[0]).toEqual(g[0])
    expect(fall.find((f) => f.col === 0)).toBeUndefined()
  })
})

describe('playSpin', () => {
  it('replays the same result for the same seed', () => {
    expect(playSpin({ bet: 100, rng: mulberry32(7) })).toEqual(playSpin({ bet: 100, rng: mulberry32(7) }))
  })

  it('cascades until nothing wins and applies the multiplier ladder', () => {
    // find a spin with at least two cascades
    let seed = 1
    let r = playSpin({ bet: 100, rng: mulberry32(seed) })
    while (r.steps.length < 2) r = playSpin({ bet: 100, rng: mulberry32(++seed) })

    r.steps.forEach((step, i) => {
      expect(step.multiplier).toBe(LADDER[i])
      const base = step.wins.reduce((s, w) => s + w.pay, 0)
      expect(step.win).toBe((base * 100 * step.multiplier) / 10)
      expect(step.removed.length).toBe(step.wins.reduce((s, w) => s + w.count, 0))
      if (i > 0) expect(step.grid).toEqual(r.steps[i - 1].next)
    })
    expect(r.steps[0].grid).toEqual(r.initial)
    expect(r.final).toEqual(r.steps.at(-1)!.next)
    expect(evaluate(r.final)).toEqual([])
    expect(r.totalWin).toBe(r.steps.reduce((s, x) => s + x.win, 0))
    expect(r.ladderEnd).toBe(r.steps.length)
  })

  it('continues the ladder from ladderStart (free spins keep their multiplier)', () => {
    let seed = 1
    let r = playSpin({ bet: 100, rng: mulberry32(seed), ladderStart: 3 })
    while (r.steps.length === 0) r = playSpin({ bet: 100, rng: mulberry32(++seed), ladderStart: 3 })
    expect(r.steps[0].multiplier).toBe(LADDER[3])
    expect(r.ladderEnd).toBe(3 + r.steps.length)
  })

  it('caps the multiplier at the top of the ladder', () => {
    expect(multiplierAt(0)).toBe(1)
    expect(multiplierAt(LADDER.length + 5)).toBe(LADDER.at(-1))
  })

  it('counts scatters on the final grid and awards free spins', () => {
    const r = playSpin({ bet: 100, rng: mulberry32(3), initial: noWinGridWithScatters(3) })
    expect(r.scatterCount).toBe(countOf(r.final, SCATTER))
    expect(r.scatterCount).toBeGreaterThanOrEqual(3)
    expect(r.freeSpinsAwarded).toBe(freeSpinsFor(r.scatterCount, false))
  })
})

function noWinGridWithScatters(n: number): Grid {
  const g = noWinGrid()
  for (let i = 0; i < n; i++) g[i * 2][i] = SCATTER
  return g
}

describe('rules', () => {
  it('awards free spins by scatter count', () => {
    expect(freeSpinsFor(2, false)).toBe(0)
    expect(freeSpinsFor(3, false)).toBe(10)
    expect(freeSpinsFor(4, false)).toBe(12)
    expect(freeSpinsFor(6, false)).toBe(15)
    expect(freeSpinsFor(3, true)).toBe(5)
    expect(freeSpinsFor(2, true)).toBe(0)
  })

  it('maps total win to celebration tiers', () => {
    expect(winTier(0, 100)).toBe('none')
    expect(winTier(1499, 100)).toBe('none')
    expect(winTier(1500, 100)).toBe('big')
    expect(winTier(4000, 100)).toBe('mega')
    expect(winTier(10000, 100)).toBe('epic')
    expect(winTier(19999, 100)).toBe('epic')
    expect(winTier(20000, 100)).toBe('jackpot')
  })

  it('fills random grids with valid symbols', () => {
    const g = randomGrid(mulberry32(9))
    expect(g).toHaveLength(COLS)
    for (const col of g) {
      expect(col).toHaveLength(ROWS)
      for (const s of col) expect(SYMBOLS[s]).toBeDefined()
    }
  })
})

describe('presenter outcomes', () => {
  it('forceBonus lands two scatters early and the third in the last column', () => {
    for (let seed = 1; seed <= 20; seed++) {
      const r = forceBonus({ bet: 100, rng: mulberry32(seed) })
      const early = r.initial.slice(0, COLS - 1).flat().filter((s) => s === SCATTER).length
      expect(early).toBe(2)
      expect(r.initial[COLS - 1]).toContain(SCATTER)
      expect(r.scatterCount).toBeGreaterThanOrEqual(3)
      expect(r.freeSpinsAwarded).toBeGreaterThanOrEqual(10)
    }
  })

  it('forceBigWin always reaches at least a mega win with a cascade show', () => {
    for (let seed = 1; seed <= 20; seed++) {
      const r = forceBigWin({ bet: 100, rng: mulberry32(seed) })
      expect(['mega', 'epic']).toContain(winTier(r.totalWin, 100))
      expect(r.steps.length).toBeGreaterThanOrEqual(2)
      expect(r.scatterCount).toBeLessThan(3)
    }
  })
})

describe('bonus plan', () => {
  it('plays every free spin in order, keeps the ladder and pays at least 15x bet', () => {
    for (let seed = 1; seed <= 15; seed++) {
      const plan = planBonus({ bet: 100, rng: mulberry32(seed), spins: 10 })
      const awarded = plan.spins.reduce((s, r) => s + r.freeSpinsAwarded, 0)
      expect(plan.spins).toHaveLength(10 + awarded)
      let ladder = 0
      for (const r of plan.spins) {
        if (r.steps.length) expect(r.steps[0].multiplier).toBe(multiplierAt(ladder, true))
        ladder = r.ladderEnd
      }
      expect(plan.total).toBe(plan.spins.reduce((s, r) => s + r.totalWin, 0))
      expect(plan.total).toBeGreaterThanOrEqual(1500)
    }
  })
})

describe('jackpot bonus', () => {
  it('a showcase bonus always reaches the jackpot tier', () => {
    for (let seed = 1; seed <= 8; seed++) {
      const plan = planBonus({ bet: 100, rng: mulberry32(seed), spins: 10, minWin: 200, maxSpins: 10 })
      expect(winTier(plan.total, 100)).toBe('jackpot')
      // a showcase must not drag on with retriggers: visitors watch it standing at the booth
      expect(plan.spins).toHaveLength(10)
      expect(plan.total).toBe(plan.spins.reduce((s, r) => s + r.totalWin, 0))
    }
  })
})

describe('first impression', () => {
  it('showcaseSpin gives a visible win of at least 5x bet with a cascade chain', () => {
    for (let seed = 1; seed <= 20; seed++) {
      const r = showcaseSpin({ bet: 100, rng: mulberry32(seed) })
      expect(r.steps.length).toBeGreaterThanOrEqual(2)
      expect(r.totalWin).toBeGreaterThanOrEqual(500)
      expect(r.scatterCount).toBeLessThan(3)
    }
  })
})

describe('demo balance (simulation)', () => {
  it('stays generous but not absurd', () => {
    const rng = mulberry32(2026)
    const bet = 100
    const spins = 20000
    let paid = 0
    let won = 0
    let hits = 0
    let bonuses = 0
    for (let i = 0; i < spins; i++) {
      paid += bet
      const r = playSpin({ bet, rng })
      won += r.totalWin
      if (r.totalWin > 0) hits++
      let free = r.freeSpinsAwarded
      if (free > 0) {
        bonuses++
        let ladder = 0
        while (free > 0) {
          free--
          const f = playSpin({ bet, rng, ladderStart: ladder, inBonus: true })
          ladder = f.ladderEnd
          won += f.totalWin
          free += f.freeSpinsAwarded
        }
      }
    }
    const rtp = won / paid
    const hitRate = hits / spins
    const bonusEvery = spins / bonuses
    // eslint-disable-next-line no-console
    console.log({ rtp: rtp.toFixed(3), hitRate: hitRate.toFixed(3), bonusEvery: bonusEvery.toFixed(1) })
    expect(rtp).toBeGreaterThan(0.9)
    expect(rtp).toBeLessThan(1.6)
    expect(hitRate).toBeGreaterThan(0.25)
    expect(bonusEvery).toBeGreaterThan(20)
    expect(bonusEvery).toBeLessThan(90)
  })
})
