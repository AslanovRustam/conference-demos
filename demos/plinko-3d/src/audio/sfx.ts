import type { CelebrateKind } from '../core/types';
import type { Tier } from '../math/tiers';
import type { AudioEngine } from './engine';
import { VoicePool, rowFrequency } from './scale';

export interface Sfx {
  chime(row: number, velocity: number): void;
  land(tier: Tier): void;
  tick(): void;
  fanfare(kind: CelebrateKind): void;
  riser(): void;
  refill(): void;
  uiClick(): void;
  /** интро: по кристаллу бегут трещины */
  crack(): void;
  /** интро: кристалл разлетается на осколки */
  shatter(): void;
}

// Негармоничные партиалы дают «стеклянный» тембр колокольчика
const GLASS_PARTIALS: [ratio: number, amp: number][] = [
  [1, 1],
  [2.76, 0.35],
  [5.4, 0.12],
  [8.93, 0.05],
];

const MAX_VOICES = 24;

interface Voice {
  gain: GainNode;
  oscs: OscillatorNode[];
}

export function createSfx(engine: AudioEngine): Sfx {
  const pool = new VoicePool(MAX_VOICES);
  const voices: (Voice | null)[] = new Array(MAX_VOICES).fill(null);
  let noise: AudioBuffer | null = null;
  let lastTick = 0;

  const ready = () => {
    const ctx = engine.ctx;
    return ctx && engine.sfx && ctx.state === 'running' ? { ctx, out: engine.sfx } : null;
  };

  const noiseBuffer = (ctx: AudioContext) => {
    if (!noise) {
      noise = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate);
      const d = noise.getChannelData(0);
      for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    }
    return noise;
  };

  /** Стеклянная нота через общий пул голосов. */
  const bell = (freq: number, gain: number, decay: number, when = 0) => {
    const r = ready();
    if (!r) return;
    const { ctx, out } = r;
    const t = ctx.currentTime + when;
    const { index, stolen } = pool.acquire(t);
    const prev = voices[index];
    if (stolen && prev) {
      prev.gain.gain.cancelScheduledValues(ctx.currentTime);
      prev.gain.gain.setTargetAtTime(0, ctx.currentTime, 0.01);
      prev.oscs.forEach((o) => o.stop(ctx.currentTime + 0.05));
    }
    const g = ctx.createGain();
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(gain, t + 0.003);
    g.gain.exponentialRampToValueAtTime(0.0001, t + decay);
    g.connect(out);
    const oscs = GLASS_PARTIALS.map(([ratio, amp]) => {
      const o = ctx.createOscillator();
      o.type = 'sine';
      o.frequency.value = freq * ratio;
      const pg = ctx.createGain();
      // Верхние партиалы гаснут быстрее основного тона
      pg.gain.setValueAtTime(amp, t);
      pg.gain.exponentialRampToValueAtTime(0.0001, t + decay / ratio ** 0.5);
      o.connect(pg).connect(g);
      o.start(t);
      o.stop(t + decay + 0.05);
      return o;
    });
    const voice: Voice = { gain: g, oscs };
    voices[index] = voice;
    oscs[0].onended = () => {
      if (voices[index] === voice) {
        voices[index] = null;
        pool.release(index);
      }
    };
  };

  const tone = (type: OscillatorType, freq: number, gain: number, dur: number, when = 0, endFreq?: number, filterHz?: number) => {
    const r = ready();
    if (!r) return;
    const { ctx, out } = r;
    const t = ctx.currentTime + when;
    const o = ctx.createOscillator();
    o.type = type;
    o.frequency.setValueAtTime(freq, t);
    if (endFreq) o.frequency.exponentialRampToValueAtTime(endFreq, t + dur);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(gain, t + 0.01);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    let node: AudioNode = o.connect(g);
    if (filterHz) {
      const f = ctx.createBiquadFilter();
      f.type = 'lowpass';
      f.frequency.value = filterHz;
      node = g.connect(f);
    }
    node.connect(out);
    o.start(t);
    o.stop(t + dur + 0.05);
  };

  const shimmer = (gain: number, dur: number, fromHz: number, toHz: number, when = 0) => {
    const r = ready();
    if (!r) return;
    const { ctx, out } = r;
    const t = ctx.currentTime + when;
    const src = ctx.createBufferSource();
    src.buffer = noiseBuffer(ctx);
    src.loop = true;
    const f = ctx.createBiquadFilter();
    f.type = 'bandpass';
    f.Q.value = 6;
    f.frequency.setValueAtTime(fromHz, t);
    f.frequency.exponentialRampToValueAtTime(toHz, t + dur);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(gain, t + dur * 0.3);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    src.connect(f).connect(g).connect(out);
    src.start(t);
    src.stop(t + dur + 0.05);
  };

  const cents = () => 2 ** (((Math.random() - 0.5) * 10) / 1200); // ±5 центов

  return {
    chime(row, velocity) {
      const freq = rowFrequency(row) * cents();
      bell(freq, 0.11 * velocity, freq > 900 ? 0.6 : 1.1);
    },
    land(tier) {
      if (tier === 'sub') {
        tone('sine', 140, 0.16, 0.25, 0, 60);
        bell(rowFrequency(2), 0.05, 0.5);
      } else if (tier === 'normal') {
        bell(rowFrequency(5), 0.12, 0.8);
        bell(rowFrequency(7), 0.12, 0.9, 0.08);
      } else {
        [5, 7, 9, 10, 12].forEach((row, i) => bell(rowFrequency(row), 0.13, 1.1, i * 0.06));
        shimmer(0.08, 0.7, 3000, 9000, 0.05);
      }
    },
    tick() {
      const r = ready();
      if (!r || r.ctx.currentTime - lastTick < 0.045) return;
      lastTick = r.ctx.currentTime;
      tone('triangle', 2400 + Math.random() * 300, 0.035, 0.035);
    },
    fanfare(kind) {
      const chord = [rowFrequency(5), rowFrequency(7), rowFrequency(8)]; // A4, C#5, E5
      const stabs = kind === 'mega' ? [0, 0.35, 0.7] : [0, 0.3];
      for (const at of stabs) for (const f of chord) tone('sawtooth', f, 0.05, kind === 'mega' ? 1.4 : 0.9, at, undefined, 2600);
      const run = kind === 'mega' ? 14 : 9;
      for (let i = 0; i < run; i++) bell(rowFrequency(5 + i), 0.09, 1.2, 0.15 + i * 0.07);
      shimmer(0.1, kind === 'mega' ? 2.5 : 1.4, 2000, 10000, 0.1);
      if (kind !== 'total') tone('sine', 55, 0.25, kind === 'mega' ? 1.8 : 1.1, 0, 41);
    },
    riser() {
      shimmer(0.07, 1.1, 400, 3000);
      tone('sine', 320, 0.08, 1.0, 0, 140);
    },
    refill() {
      for (let i = 0; i < 6; i++) bell(rowFrequency(7 + i), 0.07, 0.7, i * 0.05);
    },
    uiClick() {
      tone('triangle', 1300, 0.04, 0.03);
    },
    crack() {
      // Нарастающий хруст: шумовой свип, низкий гул и редкие стеклянные щелчки
      shimmer(0.06, 0.9, 300, 2400);
      tone('sine', 70, 0.18, 0.9, 0, 45);
      for (let i = 0; i < 6; i++) bell(2200 + Math.random() * 1800, 0.05, 0.15, 0.1 + i * 0.13 + Math.random() * 0.05);
    },
    shatter() {
      // Удар и стеклянный каскад вниз по пентатонике
      tone('sine', 110, 0.35, 1.2, 0, 38);
      shimmer(0.16, 1.4, 9000, 1500);
      for (let i = 0; i < 14; i++) bell(rowFrequency(15 - i), 0.08, 0.9, 0.03 + i * 0.045);
    },
  };
}
