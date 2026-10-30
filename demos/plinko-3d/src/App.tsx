import { useEffect, useState } from 'react';
import { seedFromSearch } from './core/rng';
import { Stage } from './scene/Stage';
import { SimContext, createSim } from './sim/SimProvider';

export function App() {
  const [sim] = useState(() => createSim({ seed: seedFromSearch(location.search) ?? Date.now() }));

  useEffect(() => {
    if (import.meta.env.DEV) (window as unknown as { __sim: typeof sim }).__sim = sim;
  }, [sim]);

  // Временный ввод до появления интерфейса (задача 13)
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.code === 'Space') sim.controller.drop();
    };
    const onPointer = () => sim.controller.drop();
    window.addEventListener('keydown', onKey);
    window.addEventListener('pointerdown', onPointer);
    return () => {
      window.removeEventListener('keydown', onKey);
      window.removeEventListener('pointerdown', onPointer);
    };
  }, [sim]);

  return (
    <SimContext.Provider value={sim}>
      <Stage />
    </SimContext.Provider>
  );
}
