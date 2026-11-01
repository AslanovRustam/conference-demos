import gsap from 'gsap'
import { audio } from '../audio/audio'
import { bridge } from '../scene/bridge'
import { game, useGame, type Banner } from '../state/store'
import { COLS, DEFAULT_BET, GUARANTEED_BONUS_EVERY, SCATTER, SCATTERS_TO_TRIGGER, START_BALANCE, WIN_TIERS, type WinTier } from './config'
import { findSpin, forceBigWin, forceBonus, multiplierAt, planBonus, playSpin, showcaseSpin, winTier, type Grid, type SpinResult } from './engine'
import { mulberry32, randomSeed } from './rng'

type Forced = 'bonus' | 'bigwin' | null

const rng = mulberry32(randomSeed())
const ATTRACT_AFTER_MS = 45_000
const TIER_RANK: Record<WinTier, number> = { none: 0, big: 1, mega: 2, epic: 3, jackpot: 4 }
const COIN_RATE = [0, 45, 90, 150, 170]
/** coins per second falling from the top of the screen once the jackpot hits */
const JACKPOT_RAIN = 110

let forcedNext: Forced = null
/** the first spin of every new visitor is a guaranteed cascade */
let showcaseNext = true
let stepId = 0
let lastInput = performance.now()
let skipCelebration: (() => void) | null = null
/** free spins of the running bonus, planned when the vault opens */
let bonusPlan: SpinResult[] = []
/** spins since the last bonus; at GUARANTEED_BONUS_EVERY the next spin opens the vault */
let spinsSinceBonus = 0
/** the coming bonus is a showcase one and is planned to end in a jackpot */
let jackpotBonus = false

const wait = (s: number) => new Promise<void>((resolve) => gsap.delayedCall(s, resolve))

/** column from which the reels should slow down: two scatters are visible and a third could still land */
export function anticipationColumn(grid: Grid): number | null {
  let seen = 0
  for (let c = 0; c < COLS; c++) {
    if (seen === SCATTERS_TO_TRIGGER - 1) return c
    seen += grid[c].filter((s) => s === SCATTER).length
  }
  return null
}

function speed() {
  const s = game()
  // free spins run a little quicker so a whole bonus fits a visitor's attention span
  return s.turbo ? 1.9 : s.freeSpins ? 1.3 : 1
}

async function showBanner(banner: Banner, seconds: number) {
  useGame.setState({ banner })
  await wait(seconds)
  if (useGame.getState().banner === banner) useGame.setState({ banner: null })
}

// ------------------------------------------------------------------ the vault door

/** the visitor opens the vault: the door swings open and the first spin starts straight away */
export async function openVault() {
  const s = game()
  const stage = bridge.stage
  if (!stage || !s.ready || s.vault !== 'closed') return
  void audio.unlock()
  lastInput = performance.now()
  useGame.setState({ vault: 'moving', attract: false })
  stage.orbit(false)
  await stage.openVault()
  useGame.setState({ vault: 'open', started: true })
  lastInput = performance.now()
  if (!game().busy) void spin()
}

// ------------------------------------------------------------------ spin

export function requestSpin(forced: Forced = null) {
  lastInput = performance.now()
  const s = game()
  if (forced) forcedNext = forced
  // with the door shut, the spin button opens the vault (and the first spin follows)
  if (s.vault !== 'open' || s.attract) {
    if (s.vault === 'closed') void openVault()
    return
  }
  if (s.bigWin) return skipCelebration?.()
  if (s.busy || s.freeSpins) return
  void spin()
}

function pickResult(bet: number, demo: boolean): SpinResult {
  const s = game()
  if (s.freeSpins) return bonusPlan.shift() ?? playSpin({ bet, rng, ladderStart: s.freeSpins.ladder, inBonus: true })
  let forced = forcedNext
  forcedNext = null
  if (!demo) spinsSinceBonus++
  if (!demo && !forced && spinsSinceBonus >= GUARANTEED_BONUS_EVERY) forced = 'bonus'
  if (forced === 'bonus') {
    // presenter and guaranteed bonuses are showcases: they always build up to a jackpot
    jackpotBonus = true
    return forceBonus({ bet, rng })
  }
  if (forced === 'bigwin') return forceBigWin({ bet, rng })
  if (demo) {
    // attract mode shows off cascades without starting a bonus nobody watches
    return findSpin({ bet, rng }, (r) => r.steps.length >= 2 && r.scatterCount < SCATTERS_TO_TRIGGER, 3000) ?? playSpin({ bet, rng })
  }
  if (showcaseNext) {
    showcaseNext = false
    return showcaseSpin({ bet, rng })
  }
  return playSpin({ bet, rng })
}

async function spin(demo = false) {
  const grid = bridge.grid
  const stage = bridge.stage
  const s = game()
  if (!grid || !stage || s.busy) return
  const inBonus = s.freeSpins !== null
  const bet = s.bet

  if (!inBonus && !demo) {
    if (s.balance < bet) void showBanner({ kind: 'refill', value: START_BALANCE }, 2.2)
    const balance = s.balance < bet ? START_BALANCE : s.balance
    useGame.setState({ balance: balance - bet })
    if (s.autoplay > 0) useGame.setState({ autoplay: s.autoplay - 1 })
  }

  const result = pickResult(bet, demo)
  const fs = game().freeSpins
  grid.speed = speed()
  useGame.setState({
    busy: true,
    spinWin: 0,
    stepWin: null,
    multiplier: multiplierAt(fs?.ladder ?? 0, inBonus),
    freeSpins: fs ? { ...fs, left: fs.left - 1 } : null,
  })

  // apply a queued resolution change now: the launch flash hides the one-frame resize
  const pending = game().pendingDprScale
  if (pending !== null) useGame.setState({ dprScale: pending, pendingDprScale: null })
  audio.play('spinStart')
  let stopRiser: (() => void) | null = null
  await grid.spin(result.initial, {
    anticipateFrom: anticipationColumn(result.initial),
    onColumnLand: (c, scatters) => {
      audio.play('reelStop', c)
      stage.shake(0.05, 0.15)
      if (result.initial[c].includes(SCATTER)) audio.play('scatterLand', scatters)
    },
    onAnticipate: () => {
      if (stopRiser) return
      stopRiser = audio.startAnticipation()
      stage.anticipation(true)
    },
  })
  if (stopRiser) {
    ;(stopRiser as () => void)()
    stage.anticipation(false)
  }

  let total = 0
  let ladder = fs?.ladder ?? 0
  for (const [i, step] of result.steps.entries()) {
    audio.setIntensity(Math.min(1, 0.35 + i * 0.18))
    audio.play('win', i)
    await grid.highlight(step.removed)
    audio.play('explode')
    stage.shake(0.16 + Math.min(i, 5) * 0.06, 0.45)
    stage.flash(0.5 + Math.min(i, 5) * 0.15, 0.5)
    stage.punch(0.035 + Math.min(i, 5) * 0.008)
    const exploding = grid.explode(step.removed)
    total += step.win
    useGame.setState({ spinWin: total, stepWin: { id: ++stepId, amount: step.win, multiplier: step.multiplier } })
    await exploding
    ladder++
    const next = multiplierAt(ladder, inBonus)
    if (next !== game().multiplier) {
      useGame.setState({ multiplier: next, multiplierFx: { id: ++stepId, value: next } })
      stage.multiplierHit()
      audio.play('multiplier', next)
    }
    audio.play('drop')
    await grid.collapse(step.fall, step.next)
  }
  audio.setIntensity(inBonus ? 0.5 : 0.15)

  if (result.freeSpinsAwarded > 0) {
    audio.play('bonusTrigger')
    stage.flash(1, 0.8)
    await grid.celebrateScatters(result.scatterCells)
  }

  if (inBonus) {
    const cur = game().freeSpins!
    useGame.setState({ freeSpins: { ...cur, won: cur.won + total, ladder: result.ladderEnd } })
  } else if (!demo) {
    useGame.setState({ balance: game().balance + total })
  }

  const tier = winTier(total, bet)
  if (tier !== 'none' && !inBonus) await celebrate(total, bet)
  else if (total > 0) stage.coinBurst(Math.min(40, Math.ceil((total / bet) * 4)))

  if (result.freeSpinsAwarded > 0) {
    if (inBonus) {
      const cur = game().freeSpins!
      useGame.setState({ freeSpins: { ...cur, left: cur.left + result.freeSpinsAwarded, total: cur.total + result.freeSpinsAwarded } })
      audio.play('freeSpinsAward')
      await showBanner({ kind: 'freeSpins', value: result.freeSpinsAwarded, retrigger: true }, 2)
    } else {
      await enterBonus(result.freeSpinsAwarded)
    }
  }

  useGame.setState({ busy: false })
  continueFlow()
}

function continueFlow() {
  const s = game()
  if (s.attract) return
  if (s.freeSpins) {
    if (s.freeSpins.left > 0) gsap.delayedCall(0.55 / speed(), () => void spin())
    else void endBonus()
    return
  }
  if (s.autoplay > 0) gsap.delayedCall(0.45 / speed(), () => !game().busy && game().autoplay > 0 && void spin())
}

export function startAutoplay(count: number) {
  lastInput = performance.now()
  useGame.setState({ autoplay: count })
  const s = game()
  if (!s.busy && !s.freeSpins && s.started) void spin()
}

export function stopAutoplay() {
  useGame.setState({ autoplay: 0 })
}

// ------------------------------------------------------------------ bonus

async function enterBonus(spins: number) {
  const stage = bridge.stage!
  useGame.setState({ vault: 'moving' })
  bonusPlan = planBonus(
    jackpotBonus
      ? { bet: game().bet, rng, spins, minWin: WIN_TIERS.jackpot, maxSpins: spins }
      : { bet: game().bet, rng, spins, minWin: WIN_TIERS.big },
  ).spins
  jackpotBonus = false
  spinsSinceBonus = 0
  await stage.enterBonus()
  useGame.setState({ vault: 'open' })
  useGame.setState({ freeSpins: { left: spins, total: spins, won: 0, ladder: 0 }, multiplier: multiplierAt(0, true) })
  audio.play('freeSpinsAward')
  await showBanner({ kind: 'freeSpins', value: spins, retrigger: false }, 2.6)
}

async function endBonus() {
  const stage = bridge.stage!
  const fs = game().freeSpins!
  useGame.setState({ busy: true })
  await wait(0.6)
  const bet = game().bet
  if (winTier(fs.won, bet) !== 'none') await celebrate(fs.won, bet)
  audio.play('bonusEnd')
  await showBanner({ kind: 'bonusEnd', value: fs.won }, 2.8)
  useGame.setState({ balance: game().balance + fs.won, freeSpins: null, multiplier: 1, spinWin: fs.won })
  useGame.setState({ vault: 'moving' })
  await stage.exitBonus()
  useGame.setState({ vault: 'open' })
  useGame.setState({ busy: false })
  continueFlow()
}

// ------------------------------------------------------------------ big win

async function celebrate(amount: number, bet: number) {
  const stage = bridge.stage!
  const finalTier = winTier(amount, bet)
  const duration = ({ none: 3, big: 4.5, mega: 6.5, epic: 9, jackpot: 12 } as const)[finalTier] / (game().turbo ? 1.4 : 1)
  const proxy = { v: 0 }
  let shownTier: WinTier = 'none'
  audio.setIntensity(1)

  const raise = (tier: WinTier) => {
    shownTier = tier
    const rank = TIER_RANK[tier]
    audio.play('bigWinTier', Math.min(rank, 3))
    if (tier === 'jackpot') {
      audio.play('bonusTrigger')
      stage.coinRain(JACKPOT_RAIN)
    }
    stage.shake(0.35 + rank * 0.2, 0.9)
    stage.flash(1 + rank * 0.45, 0.9)
    stage.coins(COIN_RATE[rank])
    stage.coinBurst(30 * rank)
  }

  await new Promise<void>((resolve) => {
    let holding = false
    const finish = () => {
      if (holding) return
      holding = true
      audio.play('countEnd')
      stage.flash(1.6, 1)
      useGame.setState({ bigWin: { tier: shownTier, shown: amount, target: amount } })
      const hold = gsap.delayedCall(2.4, resolve)
      skipCelebration = () => {
        hold.kill()
        resolve()
      }
    }
    const tw = gsap.to(proxy, {
      v: amount,
      duration,
      ease: 'power1.in',
      onUpdate: () => {
        const t = winTier(proxy.v, bet)
        const tier = TIER_RANK[t] > TIER_RANK[shownTier] ? t : shownTier === 'none' ? 'big' : shownTier
        if (tier !== shownTier) raise(tier)
        audio.play('countTick', proxy.v / amount)
        useGame.setState({ bigWin: { tier: shownTier, shown: proxy.v, target: amount } })
      },
      onComplete: finish,
    })
    skipCelebration = () => {
      tw.progress(1)
    }
  })

  skipCelebration = null
  stage.coins(0)
  stage.coinRain(0)
  useGame.setState({ bigWin: null })
  audio.setIntensity(game().freeSpins ? 0.5 : 0.15)
}

// ------------------------------------------------------------------ attract mode & presenter

export function noteActivity() {
  lastInput = performance.now()
  if (game().attract) exitAttract()
}

export function startAttractWatch() {
  const id = window.setInterval(() => {
    const s = game()
    if (s.attract || !s.started || s.vault !== 'open') return
    // watching a spin, a bonus or a celebration counts as being at the booth: the idle clock starts afterwards
    if (s.busy || s.freeSpins || s.bigWin || s.autoplay > 0) {
      lastInput = performance.now()
      return
    }
    if (performance.now() - lastInput > ATTRACT_AFTER_MS) enterAttract()
  }, 1000)
  return () => window.clearInterval(id)
}

/** nobody is playing: shut the vault and let the camera drift round the closed door */
export function enterAttract() {
  const s = game()
  if (s.attract || s.freeSpins || s.busy || s.vault !== 'open') return
  useGame.setState({ attract: true, autoplay: 0, presenterPanel: false, vault: 'moving' })
  void bridge.stage?.closeVault().then(() => {
    useGame.setState({ vault: 'closed' })
    if (game().attract) bridge.stage?.orbit(true)
    // someone tapped while it was still closing
    else void openVault()
  })
}

function exitAttract() {
  useGame.setState({ attract: false })
  skipCelebration?.()
  forcedNext = null
  // a new visitor gets a fresh wallet and a generous first spin
  showcaseNext = true
  spinsSinceBonus = 0
  useGame.setState({ balance: START_BALANCE, bet: DEFAULT_BET, spinWin: 0, stepWin: null, multiplier: 1 })
  if (game().vault === 'closed') void openVault()
}

export function resetBalance() {
  if (game().busy || game().freeSpins) return
  useGame.setState({ balance: START_BALANCE, spinWin: 0, stepWin: null, autoplay: 0 })
}
