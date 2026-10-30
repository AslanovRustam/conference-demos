import { useFrame } from '@react-three/fiber';
import { createContext, useContext } from 'react';
import type { StoreApi } from 'zustand/vanilla';
import { createBus, type EventBus, type GameEvents } from '../core/events';
import { createRng, type Rng } from '../core/rng';
import { gameStore, type GameState } from '../state/store';
import { AttractDirector } from './attract';
import { BallSystem } from './BallSystem';
import { GameController } from './controller';
import { SlowMoDirector } from './slowmo';

export interface Sim {
  bus: EventBus<GameEvents>;
  store: StoreApi<GameState>;
  rng: Rng;
  system: BallSystem;
  slowmo: SlowMoDirector;
  controller: GameController;
  attract: AttractDirector;
}

export function createSim(opts: { seed: number; store?: StoreApi<GameState> }): Sim {
  const store = opts.store ?? gameStore;
  const bus = createBus<GameEvents>();
  const rng = createRng(opts.seed);
  const system = new BallSystem(bus);
  const slowmo = new SlowMoDirector(system, bus);
  const controller = new GameController({ store, bus, rng, system, slowmo });
  const attract = new AttractDirector({ store, controller });
  return { bus, store, rng, system, slowmo, controller, attract };
}

export const SimContext = createContext<Sim | null>(null);

export function useSim(): Sim {
  const sim = useContext(SimContext);
  if (!sim) throw new Error('useSim outside SimContext');
  return sim;
}

/** Внутри <Canvas>: продвигает симуляцию раньше всех остальных подписчиков кадра. */
export function SimDriver(): null {
  const sim = useSim();
  useFrame((_, dt) => {
    sim.attract.update(dt);
    sim.controller.update(dt);
  }, -1);
  return null;
}
