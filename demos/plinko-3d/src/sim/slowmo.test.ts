import { SLOWMO_SCALE } from '../config';
import { slowMoReason } from './slowmo';
import { setup } from './testkit';

test('slowMoReason rules', () => {
  expect(slowMoReason({ tier: 'large', altTier: 'sub', alone: false, decoyRoll: 0 })).toBeNull();
  expect(slowMoReason({ tier: 'big', altTier: 'sub', alone: true, decoyRoll: 0.9 })).toBe('win');
  expect(slowMoReason({ tier: 'normal', altTier: 'large', alone: true, decoyRoll: 0.4 })).toBe('decoy');
  expect(slowMoReason({ tier: 'normal', altTier: 'large', alone: true, decoyRoll: 0.6 })).toBeNull();
});

test('director slows down and restores', () => {
  const { bus, ctl, sys, run } = setup(10);
  const ev: string[] = [];
  let min = 1;
  bus.on('slowmo:start', () => ev.push('start'));
  bus.on('slowmo:end', () => ev.push('end'));
  ctl.drop({ forceBig: true });
  for (let i = 0; i < 60 * 12; i++) {
    run(1 / 60);
    min = Math.min(min, sys.timeScale);
  }
  expect(min).toBeCloseTo(SLOWMO_SCALE, 2);
  expect(sys.timeScale).toBe(1);
  expect(ev).toEqual(['start', 'end']);
});

test('no slow-mo when another ball is in flight', () => {
  const { bus, ctl, run } = setup(11);
  let started = false;
  bus.on('slowmo:start', () => (started = true));
  ctl.drop({ forceBig: true });
  run(0.2);
  ctl.drop();
  run(10);
  expect(started).toBe(false);
});
