import type { EventBus, GameEvents } from '../core/events';
import type { Music } from './music';
import type { Sfx } from './sfx';

// Сотня шариков дождя даёт сотни касаний в секунду: столько голосов только перегружают звук и процессор
const RAIN_CHIME_INTERVAL = 0.03;

export function bindAudio(bus: EventBus<GameEvents>, sfx: Sfx, music: Music | null, now: () => number = () => performance.now() / 1000): () => void {
  let lastRainChime = -Infinity;
  const offs = [
    bus.on('peg:hit', (e) => {
      if (e.kind !== 'rain') return sfx.chime(e.row, Math.min(1, e.speed / 9));
      const t = now();
      if (t - lastRainChime < RAIN_CHIME_INTERVAL) return;
      lastRainChime = t;
      sfx.chime(e.row, 0.35);
    }),
    bus.on('ball:land', (e) => {
      if (e.kind !== 'rain') sfx.land(e.tier);
    }),
    bus.on('slowmo:start', () => {
      sfx.riser();
      music?.setIntensity(0.8, 0.3);
    }),
    bus.on('slowmo:end', () => music?.setIntensity(0.3, 1)),
    bus.on('celebrate:start', (e) => {
      sfx.fanfare(e.kind);
      music?.setIntensity(1, 0.2);
    }),
    bus.on('celebrate:end', () => music?.setIntensity(0.3, 1.5)),
    bus.on('celebrate:tick', () => sfx.tick()),
    bus.on('balance:refill', () => sfx.refill()),
    bus.on('ui:click', () => sfx.uiClick()),
  ];
  return () => offs.forEach((off) => off());
}
