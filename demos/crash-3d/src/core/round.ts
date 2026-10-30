import {
  AUTO_LADDER,
  BET_LADDER,
  COUNTDOWN_S,
  CRASH_SCENE_S,
  CRASH_SCENE_SHORT_S,
  DEFAULT_AUTO,
  DEFAULT_BET,
  EJECT_TAIL_MAX_S,
  HISTORY_LEN,
  MAX_DT,
  MAX_MULT,
  RESULT_S,
  START_BALANCE,
  WARP_FORCE_RANGE,
} from './config'
import { multiplierAt, timeAt } from './curve'
import { sampleCrashPoint } from './crashPoint'
import type { Emitter } from './events'
import { payoutFor } from './payout'
import { floor2, type Rng } from './rng'
import { stageAt, type StageId } from './stages'
import type { HistoryEntry, Phase, PresenterForce, RarePlan, RoundSnapshot } from './types'

interface Opts {
  rng: Rng
  emitter: Emitter
  balance?: number
}

export class RoundEngine {
  private rng: Rng
  private emitter: Emitter
  private phase: Phase = 'betting'
  private balance: number
  private bet = DEFAULT_BET
  private auto = { enabled: false, value: DEFAULT_AUTO }
  private t = 0
  private cashedAt: number | null = null
  private payout = 0
  private crashPoint = 1
  private crashTime = 0
  private tailRate = 1
  private phaseAge = 0
  private history: HistoryEntry[] = []
  private armed: PresenterForce | null = null
  private nextCrash: number | null = null
  private attract = false
  private rare: RarePlan | null = null
  private frozen = false
  private scripted = false // round does not touch balance or history
  private scriptedAuto: number | null = null
  private lastStage = 0
  private lastCountdown = 0

  constructor(opts: Opts) {
    this.rng = opts.rng
    this.emitter = opts.emitter
    this.balance = opts.balance ?? START_BALANCE
    this.clampBet()
  }

  snapshot(): RoundSnapshot {
    const live = this.phase === 'flight' || this.phase === 'ejected'
    const over = this.phase === 'crashed' || this.phase === 'result'
    const multiplier = over ? this.crashPoint : live ? floor2(multiplierAt(this.t)) : 1
    return {
      phase: this.phase,
      balance: this.balance,
      bet: this.bet,
      auto: { ...this.auto },
      countdown: this.phase === 'countdown' ? Math.max(0, COUNTDOWN_S - this.phaseAge) : 0,
      t: this.t,
      multiplier,
      cashedAt: this.cashedAt,
      payout: this.payout,
      crashPoint: over ? this.crashPoint : null,
      stage: stageAt(multiplier),
      phaseAge: this.phaseAge,
      history: this.history.map((h) => ({ ...h })),
      armed: this.armed,
      attract: this.attract,
      rare: this.rare,
      frozen: this.frozen,
    }
  }

  launch(): boolean {
    if (this.phase !== 'betting' || this.balance < this.bet) return false
    this.balance -= this.bet
    this.scripted = false
    this.scriptedAuto = null
    this.startRound(this.pickCrash())
    this.emitter.emit({ type: 'launch', bet: this.bet })
    this.enterCountdown()
    return true
  }

  launchScripted(crash: number, autoAt: number | null): boolean {
    if (!this.attract || this.phase !== 'betting') return false
    this.scripted = true
    this.scriptedAuto = autoAt
    this.startRound(crash)
    this.emitter.emit({ type: 'launch', bet: this.bet })
    this.enterCountdown()
    return true
  }

  cashOut(auto = false): boolean {
    if (this.phase !== 'flight' || this.frozen) return false
    const value = auto ? this.autoValue()! : floor2(multiplierAt(this.t))
    this.payout = payoutFor(this.bet, value)
    this.cashedAt = value
    if (!this.scripted) this.balance += this.payout
    const rem = this.crashTime - this.t
    this.tailRate = Math.max(1, rem / EJECT_TAIL_MAX_S)
    this.setPhase('ejected')
    this.emitter.emit({ type: 'cashout', multiplier: value, payout: this.payout, stage: stageAt(value), auto })
    return true
  }

  tick(dt: number): void {
    dt = Math.min(dt, MAX_DT)
    if (!(dt > 0)) return
    this.phaseAge += dt
    switch (this.phase) {
      case 'countdown':
        this.tickCountdown()
        break
      case 'flight':
      case 'ejected':
        this.tickFlight(dt)
        break
      case 'crashed':
        if (this.phaseAge >= (this.cashedAt !== null ? CRASH_SCENE_SHORT_S : CRASH_SCENE_S)) this.enterResult()
        break
      case 'result':
        if (this.phaseAge >= RESULT_S) this.enterBetting()
        break
    }
  }

  stepBet(dir: 1 | -1): void {
    if (this.phase !== 'betting') return
    const i = BET_LADDER.indexOf(this.bet)
    const next = BET_LADDER[Math.max(0, Math.min(BET_LADDER.length - 1, i + dir))]
    if (next <= this.balance) this.bet = next
  }

  toggleAuto(): void {
    if (this.phase !== 'betting') return
    this.auto.enabled = !this.auto.enabled
  }

  stepAuto(dir: 1 | -1): void {
    if (this.phase !== 'betting') return
    const i = AUTO_LADDER.indexOf(this.auto.value)
    this.auto.value = AUTO_LADDER[Math.max(0, Math.min(AUTO_LADDER.length - 1, i + dir))]
  }

  arm(kind: PresenterForce): void {
    this.armed = kind
  }

  // debug and tests only
  setNextCrash(x: number): void {
    this.nextCrash = x
  }

  setAttract(on: boolean): void {
    this.attract = on
    if (!on) return
    this.balance = START_BALANCE
    this.bet = DEFAULT_BET
    this.auto = { enabled: false, value: DEFAULT_AUTO }
  }

  abortToBetting(): void {
    this.enterBetting()
  }

  freezeAt(m: number): void {
    this.scripted = true
    this.scriptedAuto = null
    this.cashedAt = null
    this.payout = 0
    this.crashPoint = MAX_MULT
    this.crashTime = timeAt(MAX_MULT)
    this.t = timeAt(m)
    this.frozen = true
    this.lastStage = 0
    this.setPhase('flight')
    this.emitStages()
  }

  private startRound(crash: number): void {
    this.crashPoint = crash
    this.crashTime = timeAt(crash)
    this.t = 0
    this.cashedAt = null
    this.payout = 0
    this.frozen = false
    this.tailRate = 1
    this.lastStage = 0
  }

  private pickCrash(): number {
    if (this.nextCrash !== null) {
      const x = this.nextCrash
      this.nextCrash = null
      this.armed = null
      return x
    }
    const forced = this.armed
    this.armed = null
    if (forced === 'instant') return 1
    if (forced === 'warp') return floor2(WARP_FORCE_RANGE[0] + this.rng() * (WARP_FORCE_RANGE[1] - WARP_FORCE_RANGE[0]))
    return sampleCrashPoint(this.rng())
  }

  private autoValue(): number | null {
    if (this.scripted) return this.scriptedAuto
    return this.auto.enabled ? this.auto.value : null
  }

  private setPhase(p: Phase): void {
    this.phase = p
    this.phaseAge = 0
  }

  private enterCountdown(): void {
    this.setPhase('countdown')
    this.lastCountdown = 0
    this.tickCountdown()
  }

  private tickCountdown(): void {
    const left = Math.max(0, COUNTDOWN_S - this.phaseAge)
    const n = Math.ceil(left - 1e-9)
    if (n >= 1 && n !== this.lastCountdown) {
      this.lastCountdown = n
      this.emitter.emit({ type: 'countdown', n: n as 3 | 2 | 1 })
    }
    if (left <= 1e-9) {
      this.setPhase('flight')
      this.emitter.emit({ type: 'liftoff' })
      this.checkCrash()
    }
  }

  private tickFlight(dt: number): void {
    if (this.frozen) return
    this.t += dt * (this.phase === 'ejected' ? this.tailRate : 1)
    if (this.phase === 'flight') {
      const a = this.autoValue()
      if (a !== null && a < this.crashPoint && this.t >= timeAt(a)) {
        this.emitStages()
        this.cashOut(true)
      }
    }
    this.checkCrash()
  }

  private checkCrash(): void {
    if (this.t >= this.crashTime) {
      this.t = this.crashTime
      this.emitStages()
      const cashedOut = this.cashedAt !== null
      this.setPhase('crashed')
      this.emitter.emit({ type: 'crash', multiplier: this.crashPoint, cashedOut, stage: stageAt(this.crashPoint) })
      if (!this.scripted) {
        this.history.unshift({ crash: this.crashPoint, won: cashedOut })
        this.history.length = Math.min(this.history.length, HISTORY_LEN)
      }
    } else {
      this.emitStages()
    }
  }

  private emitStages(): void {
    const s = stageAt(Math.min(multiplierAt(this.t), this.crashPoint))
    while (this.lastStage < s) {
      this.lastStage++
      this.emitter.emit({ type: 'stage', stage: this.lastStage as StageId })
    }
  }

  private enterResult(): void {
    this.setPhase('result')
    this.emitter.emit({ type: 'result', won: this.cashedAt !== null, payout: this.payout })
  }

  private enterBetting(): void {
    this.setPhase('betting')
    this.t = 0
    this.cashedAt = null
    this.payout = 0
    this.frozen = false
    this.scripted = false
    this.scriptedAuto = null
    if (this.balance < BET_LADDER[0]) {
      this.balance = START_BALANCE
      this.emitter.emit({ type: 'refuel', balance: this.balance })
    }
    this.clampBet()
    this.emitter.emit({ type: 'betting' })
  }

  private clampBet(): void {
    if (this.bet <= this.balance) return
    const fit = BET_LADDER.filter((b) => b <= this.balance)
    this.bet = fit.length ? fit[fit.length - 1] : BET_LADDER[0]
  }
}
