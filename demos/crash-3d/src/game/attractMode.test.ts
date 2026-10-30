import { expect, test } from 'vitest'
import { attractRound } from '../core/attract'
import { IDLE_TO_ATTRACT_S } from '../core/config'
import { Emitter } from '../core/events'
import { RoundEngine } from '../core/round'
import { createAttractMode } from './attractMode'

function setup(held = () => false) {
  let now = 0
  const engine = new RoundEngine({ rng: () => 0.5, emitter: new Emitter() })
  const mode = createAttractMode(engine, () => now, held)
  // one engine tick and one controller tick per frame, like the game loop
  const run = (seconds: number) => {
    const n = Math.round(seconds * 60)
    for (let i = 0; i < n; i++) {
      now += 1000 / 60
      engine.tick(1 / 60)
      mode.tick()
    }
  }
  return { engine, mode, run }
}

test('the stand drops into attract after the idle time in betting and launches the first scripted round', () => {
  const { engine, run } = setup()
  run(IDLE_TO_ATTRACT_S - 1)
  expect(engine.snapshot().attract).toBe(false)
  run(1.1)
  expect(engine.snapshot()).toMatchObject({ attract: true, phase: 'countdown' })
})

test('a round in progress holds the idle clock until the game is back in betting', () => {
  const { engine, run } = setup()
  engine.launch()
  run(IDLE_TO_ATTRACT_S + 5)
  expect(engine.snapshot().attract).toBe(false)
})

test('attract rounds follow each other with a 2 s pause and keep the balance', () => {
  const { engine, run } = setup()
  run(IDLE_TO_ATTRACT_S + 0.1)
  let launches = 1
  let wasBetting = false
  for (let i = 0; i < 60 * 200 && launches < 3; i++) {
    run(1 / 60)
    const s = engine.snapshot()
    if (s.phase === 'betting') wasBetting = true
    else if (wasBetting && s.phase === 'countdown') {
      launches++
      wasBetting = false
    }
  }
  expect(launches).toBe(3)
  expect(engine.snapshot()).toMatchObject({ attract: true, balance: 10_000, history: [] })
})

test('the first input only wakes the game: back to betting, attract off', () => {
  const { engine, mode, run } = setup()
  run(IDLE_TO_ATTRACT_S + 5)
  expect(mode.input()).toBe(true)
  expect(engine.snapshot()).toMatchObject({ attract: false, phase: 'betting', balance: 10_000, bet: 100 })
  expect(mode.input()).toBe(false)
})

test('input in normal play resets the idle clock', () => {
  const { engine, mode, run } = setup()
  run(IDLE_TO_ATTRACT_S - 1)
  mode.input()
  run(IDLE_TO_ATTRACT_S - 1)
  expect(engine.snapshot().attract).toBe(false)
})

test('a presenter arm survives the attract loop and applies to the next player round', () => {
  const { engine, mode, run } = setup()
  engine.arm('instant')
  run(IDLE_TO_ATTRACT_S + 5)
  expect(engine.snapshot().armed).toBe('instant')
  mode.input()
  engine.launch()
  run(3.2)
  expect(engine.snapshot()).toMatchObject({ phase: 'crashed', crashPoint: 1 })
})

test('scripted rounds come from the attract script in order', () => {
  const { engine, run } = setup()
  run(IDLE_TO_ATTRACT_S + 0.1)
  for (const i of [0, 1]) {
    const r = attractRound(i)
    for (let f = 0; f < 60 * 120 && engine.snapshot().phase !== 'crashed'; f++) run(1 / 60)
    expect(engine.snapshot()).toMatchObject({ crashPoint: r.crash, cashedAt: r.autoAt })
    while (engine.snapshot().phase === 'crashed') run(1 / 60)
  }
})

test('a stage still loading holds the idle clock', () => {
  let loading = true
  const { engine, run } = setup(() => loading)
  run(IDLE_TO_ATTRACT_S + 5)
  expect(engine.snapshot().attract).toBe(false)
  loading = false
  run(IDLE_TO_ATTRACT_S - 1)
  expect(engine.snapshot().attract).toBe(false)
  run(1.1)
  expect(engine.snapshot().attract).toBe(true)
})
