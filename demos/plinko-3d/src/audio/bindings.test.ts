import { createBus, type GameEvents } from '../core/events';
import { bindAudio } from './bindings';
import type { Sfx } from './sfx';

function fakeSfx() {
  const calls: string[] = [];
  const sfx: Sfx = {
    chime: (row) => calls.push(`chime:${row}`),
    land: (t) => calls.push(`land:${t}`),
    tick: () => calls.push('tick'),
    fanfare: (k) => calls.push(`fanfare:${k}`),
    riser: () => calls.push('riser'),
    refill: () => calls.push('refill'),
    uiClick: () => calls.push('click'),
  };
  return { sfx, calls };
}

const hit = (kind: 'player' | 'rain') => ({ ballId: 1, row: 3, index: 1, speed: 6, kind });

test('rain chimes are rate-limited, player chimes are not', () => {
  const bus = createBus<GameEvents>();
  const { sfx, calls } = fakeSfx();
  let now = 0;
  bindAudio(bus, sfx, null, () => now);
  for (let i = 0; i < 100; i++) bus.emit('peg:hit', hit('rain'));
  expect(calls.filter((c) => c.startsWith('chime'))).toHaveLength(1);
  now = 1;
  for (let i = 0; i < 5; i++) bus.emit('peg:hit', hit('player'));
  expect(calls.filter((c) => c.startsWith('chime'))).toHaveLength(6);
});

test('rain landings are silent, player landings sound', () => {
  const bus = createBus<GameEvents>();
  const { sfx, calls } = fakeSfx();
  bindAudio(bus, sfx, null, () => 0);
  bus.emit('ball:land', { ballId: 1, slot: 0, multiplier: 2, tier: 'normal', win: 200, kind: 'rain' });
  bus.emit('ball:land', { ballId: 2, slot: 0, multiplier: 2, tier: 'normal', win: 200, kind: 'player' });
  expect(calls).toEqual(['land:normal']);
});
