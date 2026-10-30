import { useEffect, useState } from 'react';
import { seedFromSearch } from './core/rng';
import { Stage } from './scene/Stage';
import { SimContext, createSim } from './sim/SimProvider';
import { Hud } from './ui/Hud';

export function App() {
  const [sim] = useState(() => createSim({ seed: seedFromSearch(location.search) ?? Date.now() }));

  useEffect(() => {
    if (import.meta.env.DEV) (window as unknown as { __sim: typeof sim }).__sim = sim;
    // До заставки (задача 19) игра стартует сразу
    sim.store.getState().setMode('play');
  }, [sim]);

  // Пробел бросает шарик, но только в режиме игры
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.code !== 'Space' || e.repeat || sim.store.getState().mode !== 'play') return;
      e.preventDefault();
      sim.controller.drop();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [sim]);

  return (
    <SimContext.Provider value={sim}>
      <div
        style={{ position: 'absolute', inset: 0 }}
        onPointerDown={(e) => {
          // Тап по пирамиде, а не по интерфейсу
          if (e.target instanceof HTMLCanvasElement && sim.store.getState().mode === 'play') sim.controller.drop();
        }}
      >
        <Stage />
      </div>
      <Hud />
    </SimContext.Provider>
  );
}
