import type { StoreApi } from 'zustand/vanilla';
import { MAX_ACTIVE_BALLS, MAX_DT, MAX_QUEUED_DROPS, RAIN_COUNT, RAIN_SPAWN_INTERVAL, START_BALANCE } from '../config';
import type { EventBus, GameEvents } from '../core/events';
import type { Rng } from '../core/rng';
import type { BallKind, RainMode } from '../core/types';
import { alternativeSlot, buildDecisions, type Step } from '../math/decisions';
import { boardLayout } from '../math/layout';
import { bigCells, pickForcedBig, pickSlot } from '../math/outcome';
import { getPaytable } from '../math/paytable';
import { TIER_RANK, tierOf } from '../math/tiers';
import { buildTrajectory } from '../math/trajectory';
import type { GameState } from '../state/store';
import type { BallSystem } from './BallSystem';
import { slowMoReason, type SlowMoDirector } from './slowmo';

interface RainState {
  mode: RainMode;
  bet: number;
  remaining: number;
  timer: number;
  pending: Set<number>;
  totalWin: number;
  totalBet: number;
}

const NEAR_MISS_CHANCE = 0.5;

export class GameController {
  private readonly store: StoreApi<GameState>;
  private readonly bus: EventBus<GameEvents>;
  private readonly rng: Rng;
  private readonly system: BallSystem;
  private readonly slowmo: SlowMoDirector;
  private rainState: RainState | null = null;
  private queued = 0;
  private forceNext = false;
  private riskHighOnClear = false;
  private celebratingNow = false;

  constructor(deps: { store: StoreApi<GameState>; bus: EventBus<GameEvents>; rng: Rng; system: BallSystem; slowmo: SlowMoDirector }) {
    this.store = deps.store;
    this.bus = deps.bus;
    this.rng = deps.rng;
    this.system = deps.system;
    this.slowmo = deps.slowmo;

    this.bus.on('ball:land', (e) => this.onLand(e));
    this.bus.on('slowmo:end', () => this.flushQueue());
    this.bus.on('celebrate:end', () => {
      this.celebratingNow = false;
      this.flushQueue();
    });
    this.bus.on('board:clear', () => {
      this.store.getState().setInFlight(0);
      if (this.riskHighOnClear) {
        this.riskHighOnClear = false;
        this.store.getState().setRisk('high');
      }
    });
  }

  get rainActive(): boolean {
    return this.rainState !== null;
  }

  get celebrating(): boolean {
    return this.celebratingNow;
  }

  /** true, если шарик появился прямо сейчас (а не отклонён или поставлен в очередь). */
  drop(opts: { kind?: 'player' | 'demo'; forceBig?: boolean } = {}): boolean {
    const kind = opts.kind ?? 'player';
    if (this.celebratingNow) return false;
    if (this.slowmo.activeBallId !== null) {
      // момент замедления не прерываем: бросок игрока выполнится после приземления
      if (kind === 'player') this.queued = Math.min(MAX_QUEUED_DROPS, this.queued + 1);
      return false;
    }
    if (this.system.balls.length >= MAX_ACTIVE_BALLS) return false;

    const bet = this.store.getState().bet;
    if (kind === 'player') {
      this.ensureBalance(bet);
      this.store.getState().debit(bet);
    }
    const { risk, rows } = this.store.getState();
    const hasBig = bigCells(getPaytable(risk, rows)).length > 0;
    let force = opts.forceBig ?? false;
    if (kind === 'player' && this.forceNext && hasBig) {
      force = true;
      this.forceNext = false;
    }
    this.spawn(kind, bet, force, true);
    return true;
  }

  rain(opts: { mode: RainMode; count?: number }): void {
    if (this.rainState || this.celebratingNow) return;
    const bet = this.store.getState().bet;
    let count = opts.count ?? RAIN_COUNT;
    if (opts.mode === 'paid') {
      this.ensureBalance(bet);
      count = Math.min(count, Math.floor(this.store.getState().balance / bet));
    }
    this.rainState = { mode: opts.mode, bet, remaining: count, timer: 0, pending: new Set(), totalWin: 0, totalBet: 0 };
    this.bus.emit('rain:start', { count, mode: opts.mode });
  }

  forceBigNext(): void {
    this.forceNext = true;
    const s = this.store.getState();
    if (bigCells(getPaytable(s.risk, s.rows)).length > 0) return;
    if (this.system.balls.length === 0) {
      s.setInFlight(0);
      s.setRisk('high');
    } else {
      this.riskHighOnClear = true;
    }
  }

  update(realDt: number): void {
    this.updateRain(Math.min(realDt, MAX_DT));
    this.slowmo.update(realDt);
    this.system.update(realDt);
    const n = this.system.balls.length;
    if (this.store.getState().inFlight !== n) this.store.getState().setInFlight(n);
  }

  private ensureBalance(bet: number) {
    const s = this.store.getState();
    if (s.balance >= bet) return;
    const from = s.balance;
    s.refill();
    this.bus.emit('balance:refill', { from, to: START_BALANCE });
  }

  private flushQueue() {
    if (this.celebratingNow || this.slowmo.activeBallId !== null) return;
    const n = this.queued;
    this.queued = 0;
    for (let i = 0; i < n; i++) this.drop();
  }

  private updateRain(dt: number) {
    const r = this.rainState;
    if (!r || r.remaining <= 0) return;
    r.timer -= dt;
    while (r.timer <= 0 && r.remaining > 0 && this.system.balls.length < MAX_ACTIVE_BALLS) {
      r.timer += RAIN_SPAWN_INTERVAL;
      r.remaining--;
      if (r.mode === 'paid') {
        if (!this.store.getState().debit(r.bet)) continue;
        r.totalBet += r.bet;
      }
      const ball = this.spawn(r.mode === 'demo' ? 'demo' : 'rain', r.bet, false, false);
      r.pending.add(ball.id);
    }
  }

  private spawn(kind: BallKind, bet: number, force: boolean, allowSlowMo: boolean) {
    const { risk, rows } = this.store.getState();
    const table = getPaytable(risk, rows);
    const slot = (force ? pickForcedBig(table, this.rng) : null) ?? pickSlot(table, this.rng);
    const multiplier = table.multipliers[slot];
    const tier = tierOf(multiplier);

    // Почти-попадание: последний отскок проходит мимо соседней крупной ячейки
    let lastStep: Step | undefined;
    if (TIER_RANK[tier] < TIER_RANK.large) {
      const options: Step[] = [];
      if (slot > 0 && TIER_RANK[tierOf(table.multipliers[slot - 1])] >= TIER_RANK.large) options.push(1);
      if (slot < rows && TIER_RANK[tierOf(table.multipliers[slot + 1])] >= TIER_RANK.large) options.push(-1);
      if (options.length && this.rng.chance(NEAR_MISS_CHANCE)) lastStep = options[this.rng.int(options.length)];
    }

    const steps = buildDecisions(rows, slot, this.rng, lastStep);
    const traj = buildTrajectory(boardLayout(rows), steps, this.rng, { jitterX: this.rng.range(-0.15, 0.15) });
    const altTier = tierOf(table.multipliers[alternativeSlot(slot, steps)]);
    const slowMo = allowSlowMo
      ? slowMoReason({ tier, altTier, alone: this.system.balls.length === 0, decoyRoll: this.rng.next() })
      : null;
    return this.system.add({ kind, bet, slot, multiplier, tier, traj, slowMo });
  }

  private onLand(e: GameEvents['ball:land']) {
    if (e.kind !== 'demo') {
      this.store.getState().credit(e.win);
      this.store.getState().pushHistory(e.multiplier);
    }
    const r = this.rainState;
    if (r && r.pending.delete(e.ballId)) {
      r.totalWin += e.win;
      if (r.remaining <= 0 && r.pending.size === 0) {
        this.rainState = null;
        this.bus.emit('rain:end', { totalWin: r.totalWin, totalBet: r.totalBet, mode: r.mode });
        this.celebratingNow = true;
        this.bus.emit('celebrate:start', { kind: 'total', amount: r.totalWin, slot: null });
      }
      return;
    }
    if (e.tier === 'big' || e.tier === 'mega') {
      this.celebratingNow = true;
      this.bus.emit('celebrate:start', { kind: e.tier, amount: e.win, slot: e.slot });
    }
  }
}
