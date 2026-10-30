import { DECOY_CHANCE, MAX_DT, SLOWMO_ROWS_BEFORE_END, SLOWMO_SCALE } from '../config';
import type { EventBus, GameEvents } from '../core/events';
import { TIER_RANK, type Tier } from '../math/tiers';
import type { Ball, BallSystem } from './BallSystem';

const EASE_IN = 0.25; // с реального времени на вход в замедление
const EASE_OUT = 0.4;

export function slowMoReason(a: { tier: Tier; altTier: Tier; alone: boolean; decoyRoll: number }): 'win' | 'decoy' | null {
  if (!a.alone) return null;
  if (TIER_RANK[a.tier] >= TIER_RANK.large) return 'win';
  if (TIER_RANK[a.altTier] >= TIER_RANK.large && a.decoyRoll < DECOY_CHANCE) return 'decoy';
  return null;
}

const smoothstep = (x: number) => x * x * (3 - 2 * x);

function slowMoStartT(b: Ball): number {
  const contacts = b.traj.contacts;
  const rows = contacts[contacts.length - 1].row + 1;
  const row = Math.max(0, rows - SLOWMO_ROWS_BEFORE_END);
  return contacts.find((c) => c.row === row)!.t;
}

export class SlowMoDirector {
  activeBallId: number | null = null;
  private phase: 'idle' | 'in' | 'hold' | 'out' = 'idle';
  private phaseT = 0;
  private from = 1;

  constructor(
    private readonly system: BallSystem,
    private readonly bus: EventBus<GameEvents>,
  ) {
    bus.on('ball:land', (e) => {
      if (e.ballId !== this.activeBallId || this.phase === 'out') return;
      this.phase = 'out';
      this.phaseT = 0;
      this.from = this.system.timeScale;
    });
  }

  /** Немедленно вернуть нормальное время (выход из attract посреди демо-замедления). */
  cancel(): void {
    if (this.activeBallId === null) return;
    const ballId = this.activeBallId;
    this.activeBallId = null;
    this.phase = 'idle';
    this.system.timeScale = 1;
    this.bus.emit('slowmo:end', { ballId });
  }

  update(realDt: number): void {
    const dt = Math.min(realDt, MAX_DT);
    if (this.phase === 'idle') {
      for (const b of this.system.balls) {
        if (!b.slowMo || b.landed || b.t < slowMoStartT(b)) continue;
        if (this.system.balls.length !== 1) {
          b.slowMo = null; // шарик уже не один: момент не замедляем
          continue;
        }
        this.activeBallId = b.id;
        this.phase = 'in';
        this.phaseT = 0;
        this.bus.emit('slowmo:start', { ballId: b.id, reason: b.slowMo });
      }
      return;
    }

    this.phaseT += dt;
    if (this.phase === 'in') {
      const k = smoothstep(Math.min(1, this.phaseT / EASE_IN));
      this.system.timeScale = 1 + (SLOWMO_SCALE - 1) * k;
      if (k >= 1) this.phase = 'hold';
    } else if (this.phase === 'hold') {
      this.system.timeScale = SLOWMO_SCALE;
    } else {
      const k = smoothstep(Math.min(1, this.phaseT / EASE_OUT));
      this.system.timeScale = this.from + (1 - this.from) * k;
      if (k >= 1) {
        this.system.timeScale = 1;
        const ballId = this.activeBallId!;
        this.activeBallId = null;
        this.phase = 'idle';
        this.bus.emit('slowmo:end', { ballId });
      }
    }
  }
}
