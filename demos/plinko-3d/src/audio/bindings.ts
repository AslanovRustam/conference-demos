import type { EventBus, GameEvents } from '../core/events';
import type { Music } from './music';
import type { Sfx } from './sfx';

export function bindAudio(bus: EventBus<GameEvents>, sfx: Sfx, music: Music | null): () => void {
  const offs = [
    bus.on('peg:hit', (e) => sfx.chime(e.row, e.kind === 'rain' ? 0.35 : Math.min(1, e.speed / 9))),
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
