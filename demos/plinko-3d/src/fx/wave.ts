import type { Peg } from '../math/layout';
import type { GlowField } from './glowField';

const MAX_RADIUS = 20;

/** Кольцо света радиусом speed·t: 1 на кольце, линейно до 0 на расстоянии width. */
export function waveIntensity(distance: number, t: number, speed = 14, width = 0.7): number {
  if (t > MAX_RADIUS / speed) return 0;
  const off = Math.abs(distance - speed * t);
  return off >= width ? 0 : 1 - off / width;
}

interface Wave {
  x: number;
  y: number;
  intensity: number;
  t: number;
}

export class WaveField {
  private waves: Wave[] = [];

  get active(): number {
    return this.waves.length;
  }

  add(x: number, y: number, intensity: number): void {
    this.waves.push({ x, y, intensity, t: 0 });
  }

  update(dt: number): void {
    for (const w of this.waves) w.t += dt;
    this.waves = this.waves.filter((w) => waveIntensity(0, w.t, 14, Infinity) > 0);
  }

  apply(pegs: Peg[], glow: GlowField): void {
    for (const w of this.waves) {
      for (const p of pegs) {
        const k = waveIntensity(Math.hypot(p.x - w.x, p.y - w.y), w.t);
        if (k > 0) glow.hit(p.flat, k * w.intensity);
      }
    }
  }
}
