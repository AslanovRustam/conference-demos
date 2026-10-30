// Только для тестов: собирает симуляцию без браузера.
import { createBus, type GameEvents } from '../core/events';
import { createRng } from '../core/rng';
import { createGameStore } from '../state/store';
import { AttractDirector } from './attract';
import { BallSystem } from './BallSystem';
import { GameController } from './controller';
import { SlowMoDirector } from './slowmo';

export function setup(seed: number) {
  const st = createGameStore({ storage: null });
  const bus = createBus<GameEvents>();
  const sys = new BallSystem(bus);
  const slowmo = new SlowMoDirector(sys, bus);
  const ctl = new GameController({ store: st, bus, rng: createRng(seed), system: sys, slowmo });
  const run = (sec: number) => {
    const n = Math.max(1, Math.round(sec * 60));
    for (let i = 0; i < n; i++) ctl.update(1 / 60);
  };
  return { st, bus, sys, slowmo, ctl, run };
}

export function setupWithAttract(seed: number) {
  const kit = setup(seed);
  return { ...kit, attract: new AttractDirector({ store: kit.st, controller: kit.ctl }) };
}
