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

// launch while betting, cash out in flight, play again once the round is won (the engine refuses it otherwise)
export function primaryAction(engine = runtime.engine): void {
  const phase = engine.snapshot().phase
  if (phase === 'betting') engine.launch()
  else if (phase === 'flight') engine.cashOut()
  else engine.playAgain()
}
