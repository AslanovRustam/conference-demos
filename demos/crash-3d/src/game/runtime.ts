import { Emitter } from '../core/events'
import { createRng, randomSeed, type Rng } from '../core/rng'
import { RoundEngine } from '../core/round'
import { params } from '../platform/params'

export interface Runtime {
  engine: RoundEngine
  emitter: Emitter
  rng: Rng
}

function createRuntime(): Runtime {
  const rng = createRng(params.seed ?? randomSeed())
  const emitter = new Emitter()
  const engine = new RoundEngine({ rng, emitter })
  return { engine, emitter, rng }
}

export const runtime: Runtime = createRuntime()

// launch while betting, cash out in flight, nothing otherwise
export function primaryAction(): void {
  const phase = runtime.engine.snapshot().phase
  if (phase === 'betting') runtime.engine.launch()
  else if (phase === 'flight') runtime.engine.cashOut()
}
