import type { Rng } from '../core/rng';
import { columnsOf, pegIndexAt, type Step } from './decisions';
import { BALL_RADIUS, GEM_TOP, PEG_RADIUS, pegFlatIndex, type BoardLayout, type Peg } from './layout';

export const GRAVITY = 44;

export interface Contact {
  row: number;
  index: number;
  t: number;
  x: number;
  y: number;
  speedIn: number;
  speedOut: number;
  micro: boolean;
}

export interface Segment {
  t0: number;
  t1: number;
  x0: number;
  y0: number;
  vx: number;
  vy: number;
  spin: number;
  angle0: number;
}

export interface Trajectory {
  segments: Segment[];
  contacts: Contact[];
  landT: number;
  endT: number;
  slot: number;
}

export interface BallSample {
  x: number;
  y: number;
  angle: number;
  segment: number;
}

const R = PEG_RADIUS + BALL_RADIUS;
const RESTITUTION = 0.85;
const CLEARANCE = R - 0.01;
const DOUBLE_BOUNCE_CHANCE = 0.12;

interface Pt {
  x: number;
  y: number;
}

interface Flight {
  vx: number;
  vy: number;
  T: number;
}

// Парабола из p0 в p1 с подскоком на высоту h над стартом
function flight(p0: Pt, p1: Pt, h: number): Flight {
  const vy = Math.sqrt(2 * GRAVITY * h);
  const disc = vy * vy + 2 * GRAVITY * (p0.y - p1.y);
  const T = (vy + Math.sqrt(Math.max(0, disc))) / GRAVITY;
  return { vx: (p1.x - p0.x) / T, vy, T };
}

const speedOf = (f: Flight) => Math.hypot(f.vx, f.vy);
const endSpeedOf = (f: Flight) => Math.hypot(f.vx, f.vy - GRAVITY * f.T);

function isClear(p0: Pt, f: Flight, pegs: Peg[]): boolean {
  const near = pegs.filter((p) => Math.abs(p.y - p0.y) < 2.5 && Math.abs(p.x - p0.x) < 2);
  for (let i = 1; i < 32; i++) {
    const t = (f.T * i) / 32;
    const x = p0.x + f.vx * t;
    const y = p0.y + f.vy * t - 0.5 * GRAVITY * t * t;
    for (const p of near) if (Math.hypot(x - p.x, y - p.y) < CLEARANCE) return false;
  }
  return true;
}

function contactOn(peg: Pt, side: Step, theta: number): Pt {
  return { x: peg.x + side * Math.sin(theta) * R, y: peg.y + Math.cos(theta) * R };
}

/**
 * Подбирает полёт в точку, заданную функцией target(attempt): сначала случайная высота подскока,
 * затем без прироста энергии (скорость отскока ≤ 0.85 входящей), затем без пересечения кристаллов.
 */
function solve(
  from: Pt,
  speedIn: number | null,
  pegs: Peg[],
  rng: Rng,
  hRange: [number, number],
  target: (attempt: number) => Pt,
): { to: Pt; f: Flight } {
  let best: { to: Pt; f: Flight } | null = null;
  for (let attempt = 0; attempt < 24; attempt++) {
    const to = target(attempt);
    let h = rng.range(hRange[0], hRange[1]) * (1 + attempt * 0.15);
    for (let k = 0; k < 8; k++) {
      let f = flight(from, to, h);
      if (speedIn !== null) {
        while (speedOf(f) > RESTITUTION * speedIn && h > 0.01) {
          h = Math.max(0.01, h * 0.5);
          f = flight(from, to, h);
        }
        if (speedOf(f) > RESTITUTION * speedIn) break;
      }
      best ??= { to, f };
      if (isClear(from, f, pegs)) return { to, f };
      h *= 1.4;
    }
  }
  return best!;
}

export function buildTrajectory(
  layout: BoardLayout,
  steps: Step[],
  rng: Rng,
  opts: { jitterX?: number } = {},
): Trajectory {
  const { rows, pegs } = layout;
  const cols = columnsOf(steps);
  const slot = steps.filter((s) => s === 1).length;
  const segments: Segment[] = [];
  const contacts: Contact[] = [];
  let t = 0;
  let angle = 0;

  const fly = (from: Pt, f: Flight) => {
    const spin = -f.vx / BALL_RADIUS;
    segments.push({ t0: t, t1: t + f.T, x0: from.x, y0: from.y, vx: f.vx, vy: f.vy, spin, angle0: angle });
    t += f.T;
    angle += spin * f.T;
    const last = contacts[contacts.length - 1];
    if (last && last.speedOut === 0 && segments.length > 1) last.speedOut = speedOf(f);
    return endSpeedOf(f);
  };

  let pos: Pt = { x: opts.jitterX ?? 0, y: layout.spawn.y };
  let speedIn: number | null = null;

  for (let row = 0; row < rows; row++) {
    const index = pegIndexAt(row, cols[row]);
    const peg = pegs[pegFlatIndex(row, index)];
    const side = steps[row];
    const first = row === 0;
    const { to, f } = solve(pos, speedIn, pegs, rng, first ? [0, 0] : [0.03, 0.18], (attempt) => {
      const hi = Math.max(0.2, 0.6 - attempt * 0.03);
      return contactOn(peg, side, rng.range(0.18, hi));
    });
    const arrive = fly(pos, f);
    contacts.push({ row, index, t, x: to.x, y: to.y, speedIn: arrive, speedOut: 0, micro: false });
    pos = to;
    speedIn = arrive;

    // Двойной отскок: короткий подскок по тому же кристаллу, шарик скатывается дальше по грани
    if (row < rows - 1 && rng.chance(DOUBLE_BOUNCE_CHANCE)) {
      const theta = Math.atan2(Math.abs(to.x - peg.x), to.y - peg.y) + 0.35;
      const micro = solve(pos, speedIn, pegs, rng, [0.02, 0.05], () => contactOn(peg, side, Math.min(theta, 1.1)));
      const microIn = fly(pos, micro.f);
      contacts.push({ row, index, t, x: micro.to.x, y: micro.to.y, speedIn: microIn, speedOut: 0, micro: true });
      pos = micro.to;
      speedIn = null; // скатывание с грани: следующий вылет может быть быстрее подскока
    }
  }

  const slotPos = layout.slots[slot];
  const landY = slotPos.y + GEM_TOP + BALL_RADIUS;
  const landing = solve(pos, speedIn, pegs, rng, [0.03, 0.18], () => ({ x: slotPos.x + rng.range(-0.08, 0.08), y: landY }));
  fly(pos, landing.f);
  const landT = t;

  // Два затухающих подскока внутри камня
  for (const h of [0.12, 0.04]) fly(landing.to, flight(landing.to, landing.to, h));

  return { segments, contacts, landT, endT: t, slot };
}

export function sampleTrajectory(tr: Trajectory, t: number, out: BallSample = { x: 0, y: 0, angle: 0, segment: 0 }): BallSample {
  const segs = tr.segments;
  const tt = Math.min(Math.max(t, 0), tr.endT);
  let lo = 0;
  let hi = segs.length - 1;
  while (lo < hi) {
    const mid = (lo + hi + 1) >> 1;
    if (segs[mid].t0 <= tt) lo = mid;
    else hi = mid - 1;
  }
  const s = segs[lo];
  const tau = tt - s.t0;
  out.x = s.x0 + s.vx * tau;
  out.y = s.y0 + s.vy * tau - 0.5 * GRAVITY * tau * tau;
  out.angle = s.angle0 + s.spin * tau;
  out.segment = lo;
  return out;
}
