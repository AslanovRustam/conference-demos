import type { AudioEngine } from './engine';

export interface Music {
  start(): void;
  setIntensity(level: number, seconds: number): void;
  stop(): void;
}

// Цикл аккордов в ля мажоре: Amaj9 – F#m9 – Dmaj7 – E6, по 8 секунд
const CHORDS: number[][] = [
  [110, 164.81, 207.65, 246.94, 277.18],
  [92.5, 138.59, 164.81, 207.65, 220],
  [146.83, 220, 277.18, 369.99],
  [82.41, 123.47, 164.81, 207.65, 277.18],
];
const CHORD_SECONDS = 8;
const FADE = 2.5;
const LOOKAHEAD = 0.5;
const ARP_STEP = 0.25;

export function createMusic(engine: AudioEngine): Music {
  let timer: ReturnType<typeof setInterval> | null = null;
  let filter: BiquadFilterNode | null = null;
  let arpGain: GainNode | null = null;
  let nextChordAt = 0;
  let nextArpAt = 0;
  let chordIndex = 0;
  let intensity = 0.3;

  const pad = (ctx: AudioContext, freqs: number[], at: number) => {
    const g = ctx.createGain();
    g.gain.setValueAtTime(0, at);
    g.gain.linearRampToValueAtTime(0.06, at + FADE);
    g.gain.setValueAtTime(0.06, at + CHORD_SECONDS);
    g.gain.linearRampToValueAtTime(0, at + CHORD_SECONDS + FADE);
    g.connect(filter!);
    for (const f of freqs) {
      for (const [type, detune] of [
        ['triangle', -7],
        ['sawtooth', 6],
      ] as const) {
        const o = ctx.createOscillator();
        o.type = type;
        o.frequency.value = f;
        o.detune.value = detune;
        const og = ctx.createGain();
        og.gain.value = type === 'sawtooth' ? 0.35 : 0.6;
        o.connect(og).connect(g);
        o.start(at);
        o.stop(at + CHORD_SECONDS + FADE + 0.1);
      }
    }
  };

  const arpNote = (ctx: AudioContext, freq: number, at: number) => {
    const o = ctx.createOscillator();
    o.type = 'sine';
    o.frequency.value = freq;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0, at);
    g.gain.linearRampToValueAtTime(0.12, at + 0.005);
    g.gain.exponentialRampToValueAtTime(0.0001, at + 0.6);
    o.connect(g).connect(arpGain!);
    o.start(at);
    o.stop(at + 0.65);
  };

  const schedule = () => {
    const ctx = engine.ctx;
    if (!ctx || ctx.state !== 'running') return;
    const horizon = ctx.currentTime + LOOKAHEAD;
    while (nextChordAt < horizon) {
      pad(ctx, CHORDS[chordIndex], nextChordAt);
      chordIndex = (chordIndex + 1) % CHORDS.length;
      nextChordAt += CHORD_SECONDS;
    }
    while (nextArpAt < horizon) {
      const chord = CHORDS[(chordIndex + CHORDS.length - 1) % CHORDS.length];
      if (intensity > 0.5) arpNote(ctx, chord[Math.floor(Math.random() * chord.length)] * 4, nextArpAt);
      nextArpAt += ARP_STEP;
    }
  };

  return {
    start() {
      const ctx = engine.ctx;
      if (timer || !ctx || !engine.music) return;
      filter = ctx.createBiquadFilter();
      filter.type = 'lowpass';
      filter.Q.value = 0.7;
      filter.frequency.value = 600 + 3400 * intensity;
      // Медленное «дыхание» фильтра
      const lfo = ctx.createOscillator();
      lfo.frequency.value = 0.07;
      const lfoDepth = ctx.createGain();
      lfoDepth.gain.value = 250;
      lfo.connect(lfoDepth).connect(filter.frequency);
      lfo.start();
      filter.connect(engine.music);
      arpGain = ctx.createGain();
      arpGain.gain.value = 0;
      arpGain.connect(engine.music);
      nextChordAt = ctx.currentTime + 0.1;
      nextArpAt = ctx.currentTime + 0.1;
      timer = setInterval(schedule, 200);
      schedule();
    },
    setIntensity(level, seconds) {
      intensity = level;
      const ctx = engine.ctx;
      if (!ctx || !filter || !arpGain) return;
      const tc = Math.max(0.05, seconds / 3);
      filter.frequency.setTargetAtTime(600 + 3400 * level, ctx.currentTime, tc);
      arpGain.gain.setTargetAtTime(Math.pow(level, 1.5) * 0.5, ctx.currentTime, tc);
    },
    stop() {
      if (timer) clearInterval(timer);
      timer = null;
    },
  };
}
