import { useState } from 'react';
import { seedFromSearch } from './core/rng';
import { Stage } from './scene/Stage';
import { SimContext, createSim } from './sim/SimProvider';

export function App() {
  const [sim] = useState(() => createSim({ seed: seedFromSearch(location.search) ?? Date.now() }));
  return (
    <SimContext.Provider value={sim}>
      <Stage />
    </SimContext.Provider>
  );
}
