import { MAX_DT } from '../config';
import type { EventBus, GameEvents } from '../core/events';
import type { BallKind } from '../core/types';
import type { Tier } from '../math/tiers';
import { sampleTrajectory, type BallSample, type Trajectory } from '../math/trajectory';

export interface Ball {
  id: number;
  kind: BallKind;
  bet: number;
  slot: number;
  multiplier: number;
  tier: Tier;
  traj: Trajectory;
  t: number;
  nextContact: number;
  landed: boolean;
  sample: BallSample;
  slowMo: 'win' | 'decoy' | null;
}

export class BallSystem {
  timeScale = 1;
  readonly balls: Ball[] = [];
  private nextId = 1;

  constructor(private readonly bus: EventBus<GameEvents>) {}

  add(spec: Omit<Ball, 'id' | 't' | 'nextContact' | 'landed' | 'sample'>): Ball {
    const ball: Ball = { ...spec, id: this.nextId++, t: 0, nextContact: 0, landed: false, sample: sampleTrajectory(spec.traj, 0) };
    this.balls.push(ball);
    this.bus.emit('ball:spawn', { ballId: ball.id, kind: ball.kind });
    return ball;
  }

  update(realDt: number): void {
    if (!this.balls.length) return;
    const dt = Math.min(realDt, MAX_DT) * this.timeScale;
    let removed = false;
    for (const b of [...this.balls]) {
      b.t += dt;
      const { contacts, landT, endT } = b.traj;
      while (b.nextContact < contacts.length && contacts[b.nextContact].t <= b.t) {
        const c = contacts[b.nextContact++];
        this.bus.emit('peg:hit', { ballId: b.id, row: c.row, index: c.index, speed: c.speedIn, kind: b.kind });
      }
      if (!b.landed && b.t >= landT) {
        b.landed = true;
        const win = Math.round(b.bet * b.multiplier);
        this.bus.emit('ball:land', { ballId: b.id, slot: b.slot, multiplier: b.multiplier, tier: b.tier, win, kind: b.kind });
      }
      sampleTrajectory(b.traj, b.t, b.sample);
      if (b.t >= endT) {
        this.balls.splice(this.balls.indexOf(b), 1);
        removed = true;
        this.bus.emit('ball:gone', { ballId: b.id });
      }
    }
    if (removed && this.balls.length === 0) this.bus.emit('board:clear', {});
  }
}
