import { expect, test } from 'vitest'
import { PLAY_AGAIN_AFTER_S } from '../core/config'
import { timeAt } from '../core/curve'
import { Emitter } from '../core/events'
import { RoundEngine } from '../core/round'
import { primaryAction } from './runtime'

test('the primary action launches, cashes out, then plays again after a win', () => {
  const engine = new RoundEngine({ rng: () => 0.5, emitter: new Emitter() })
  engine.setNextCrash(5)
  primaryAction(engine)
  expect(engine.snapshot().phase).toBe('countdown')
  for (let i = 0; i < Math.round((3 + timeAt(1.5)) * 60); i++) engine.tick(1 / 60)
  primaryAction(engine)
  expect(engine.snapshot().phase).toBe('ejected')
  for (let i = 0; i < Math.round(PLAY_AGAIN_AFTER_S * 60); i++) engine.tick(1 / 60)
  primaryAction(engine)
  expect(engine.snapshot().phase).toBe('betting')
})
