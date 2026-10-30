import { expect, test } from 'vitest'
import { Emitter, type GameEvent } from './events'
import { payoutFor } from './payout'
import { RoundEngine } from './round'
import { timeAt } from './curve'

function build(us: number[], balance?: number) {
  let i = 0
  const rng = () => us[i++ % us.length]
  const emitter = new Emitter()
  const events: GameEvent[] = []
  emitter.on((e) => events.push(e))
  const engine = new RoundEngine({ rng, emitter, balance })
  return { engine, events }
}
const setup = (us: number[]) => build(us)
const setupWithBalance = (balance: number, us: number[]) => build(us, balance)
function run(engine: RoundEngine, seconds: number) {
  const n = Math.round(seconds * 60)
  for (let i = 0; i < n; i++) engine.tick(1 / 60)
}

test('starts in betting with default balance, bet and auto', () => {
  const s = setup([0.5]).engine.snapshot()
  expect(s).toMatchObject({ phase: 'betting', balance: 10_000, bet: 100, auto: { enabled: false, value: 2 } })
})

test('launch deducts the bet, counts 3-2-1 and lifts off after 3 s', () => {
  const { engine, events } = setup([0.5])
  expect(engine.launch()).toBe(true)
  expect(engine.snapshot()).toMatchObject({ phase: 'countdown', balance: 9_900 })
  run(engine, 3.05)
  expect(engine.snapshot().phase).toBe('flight')
  expect(events.map((e) => (e.type === 'countdown' ? `c${e.n}` : e.type))).toEqual(['launch', 'c3', 'c2', 'c1', 'liftoff'])
})

test('a second launch or launch outside betting is ignored', () => {
  const { engine } = setup([0.5])
  engine.launch()
  expect(engine.launch()).toBe(false)
  expect(engine.snapshot().balance).toBe(9_900)
})

test('manual cash out pays bet × multiplier (whole credits) once', () => {
  const { engine } = setup([0.25]) // crash ×5
  engine.launch()
  run(engine, 3 + timeAt(1.5))
  expect(engine.cashOut()).toBe(true)
  const s = engine.snapshot()
  expect(s.phase).toBe('ejected')
  expect(s.payout).toBe(payoutFor(100, s.cashedAt!))
  expect(s.balance).toBe(9_900 + s.payout)
  expect(engine.cashOut()).toBe(false)
})

test('cash out at 1.15 credits exactly 115 (integer-cent payout)', () => {
  const { engine } = setup([0.25]) // crash ×5
  engine.launch()
  run(engine, 3.05)
  while (engine.snapshot().multiplier < 1.15) engine.tick(1 / 600)
  expect(engine.snapshot().multiplier).toBe(1.15)
  expect(engine.cashOut()).toBe(true)
  expect(engine.snapshot()).toMatchObject({ cashedAt: 1.15, payout: 115, balance: 9_900 + 115 })
})

test('without cash out the rocket crashes exactly at the crash point and the bet is lost', () => {
  const { engine, events } = setup([0.5]) // crash ×2
  engine.launch()
  run(engine, 3 + timeAt(2) + 0.1)
  const s = engine.snapshot()
  expect(s).toMatchObject({ phase: 'crashed', multiplier: 2, crashPoint: 2, balance: 9_900 })
  expect(events).toContainEqual(expect.objectContaining({ type: 'crash', multiplier: 2, cashedOut: false }))
  expect(engine.cashOut()).toBe(false)
})

test('auto cash out pays exactly the auto value', () => {
  const { engine, events } = setup([0.25]) // crash ×5
  engine.toggleAuto()
  engine.launch()
  run(engine, 3 + timeAt(2.5))
  expect(engine.snapshot()).toMatchObject({ phase: 'ejected', cashedAt: 2, payout: 200 })
  expect(events).toContainEqual(expect.objectContaining({ type: 'cashout', auto: true, multiplier: 2 }))
})

test('auto value equal to the crash point loses', () => {
  const { engine } = setup([0.5]) // crash ×2, auto ×2
  engine.toggleAuto()
  engine.launch()
  run(engine, 3 + timeAt(2) + 0.1)
  expect(engine.snapshot()).toMatchObject({ phase: 'crashed', payout: 0, cashedAt: null })
})

test('after cash out the rest of the flight takes at most 6 s', () => {
  const { engine } = setup([0.0001]) // crash ×1000
  engine.launch()
  run(engine, 3 + timeAt(1.2))
  engine.cashOut()
  let real = 0
  while (engine.snapshot().phase === 'ejected') {
    engine.tick(1 / 60)
    real += 1 / 60
  }
  expect(real).toBeLessThanOrEqual(6.05)
})

test('crash at 1.00 explodes right at liftoff', () => {
  const { engine } = setup([0.99])
  engine.launch()
  run(engine, 3.05)
  expect(engine.snapshot().phase).toBe('crashed')
})

test('crashed → result → betting with the configured durations', () => {
  const { engine, events } = setup([0.99])
  engine.launch()
  run(engine, 3.05 + 1.6 + 2.5 + 0.1)
  expect(engine.snapshot().phase).toBe('betting')
  expect(events.map((e) => e.type)).toEqual(expect.arrayContaining(['result', 'betting']))
})

test('refuels to 10 000 when the balance cannot cover the minimum bet', () => {
  const { engine, events } = setupWithBalance(15, [0.99])
  expect(engine.snapshot().bet).toBe(10)
  engine.launch()
  run(engine, 3.05 + 1.6 + 2.5 + 0.1)
  expect(engine.snapshot().balance).toBe(10_000)
  expect(events).toContainEqual({ type: 'refuel', balance: 10_000 })
})

test('bet and auto controls are locked outside betting', () => {
  const { engine } = setup([0.5])
  engine.launch()
  engine.stepBet(1)
  engine.toggleAuto()
  expect(engine.snapshot()).toMatchObject({ bet: 100, auto: { enabled: false } })
})

test('stepBet walks the ladder and never exceeds the balance', () => {
  const { engine } = setupWithBalance(300, [0.5])
  engine.stepBet(1)
  expect(engine.snapshot().bet).toBe(200)
  engine.stepBet(1)
  expect(engine.snapshot().bet).toBe(200)
  for (let i = 0; i < 5; i++) engine.stepBet(-1)
  expect(engine.snapshot().bet).toBe(10)
})

test('history keeps the last 15 rounds, newest first', () => {
  const { engine } = setup([0.99])
  for (let i = 0; i < 16; i++) {
    engine.launch()
    run(engine, 3.05 + 1.6 + 2.5 + 0.1)
  }
  const { history } = engine.snapshot()
  expect(history).toHaveLength(15)
  expect(history.every((h) => h.crash === 1 && h.won === false)).toBe(true)
})

test('history records the crash point and outcome, newest first', () => {
  const { engine } = setup([0.99, 0.5])
  engine.launch()
  run(engine, 3.05 + 1.6 + 2.5 + 0.1)
  engine.launch()
  run(engine, 3 + timeAt(2) + 0.1 + 1.6 + 2.5 + 0.2)
  expect(engine.snapshot().history).toEqual([{ crash: 2, won: false }, { crash: 1, won: false }])
})

test('arm forces the next round once', () => {
  const { engine } = setup([0.5, 0.5, 0.5])
  engine.arm('instant')
  expect(engine.snapshot().armed).toBe('instant')
  engine.launch()
  run(engine, 3.05)
  expect(engine.snapshot()).toMatchObject({ phase: 'crashed', armed: null })
  run(engine, 4.2)
  engine.arm('warp')
  engine.launch()
  run(engine, 3 + timeAt(39.9))
  expect(engine.snapshot().phase).toBe('flight') // warp crash point is >= 40
})

test('stage events fire once per stage reached, in order', () => {
  const { engine, events } = setup([0.025]) // crash x50
  engine.launch()
  run(engine, 3 + timeAt(50) + 0.2)
  const stages = events.filter((e) => e.type === 'stage').map((e) => (e as { stage: number }).stage)
  expect(stages).toEqual([1, 2, 3, 4, 5])
  expect(engine.snapshot().crashPoint).toBe(50)
})

test('a huge dt is clamped to MAX_DT so a hidden tab does not skip the round', () => {
  const { engine } = setup([0.25])
  engine.launch()
  run(engine, 3.05)
  const t0 = engine.snapshot().t
  engine.tick(30)
  expect(engine.snapshot().t - t0).toBeLessThanOrEqual(0.1 + 1e-9)
})

test('attract rounds do not touch balance or history', () => {
  const { engine } = setup([0.5])
  engine.setAttract(true)
  expect(engine.launchScripted(3, 2)).toBe(true)
  run(engine, 3 + timeAt(3) + 1 + 2.5 + 3)
  expect(engine.snapshot()).toMatchObject({ phase: 'betting', balance: 10_000, history: [], attract: true })
})

test('launchScripted is refused outside attract', () => {
  const { engine } = setup([0.5])
  expect(engine.launchScripted(3, 2)).toBe(false)
  expect(engine.snapshot().phase).toBe('betting')
})

test('abortToBetting ends any phase immediately without paying', () => {
  const { engine } = setup([0.25])
  engine.launch()
  run(engine, 3 + 1)
  expect(engine.snapshot().phase).toBe('flight')
  engine.abortToBetting()
  expect(engine.snapshot()).toMatchObject({ phase: 'betting', balance: 9_900, payout: 0, cashedAt: null, t: 0 })
})

test('freezeAt holds the rocket at a multiplier', () => {
  const { engine } = setup([0.5])
  engine.freezeAt(4.2)
  run(engine, 5)
  expect(engine.snapshot()).toMatchObject({ phase: 'flight', multiplier: 4.2, frozen: true })
})

test('freezeAt(1) holds the countdown: no liftoff, no bet, no launch', () => {
  const { engine, events } = setup([0.5])
  engine.freezeAt(1)
  const held = engine.snapshot()
  expect(held).toMatchObject({ phase: 'countdown', multiplier: 1, frozen: true, balance: 10_000, t: 0 })
  expect(held.countdown).toBeGreaterThan(0)
  expect(held.countdown).toBeLessThan(3)
  run(engine, 5)
  expect(engine.snapshot()).toMatchObject({ phase: 'countdown', countdown: held.countdown, frozen: true })
  expect(events.map((e) => e.type)).not.toContain('liftoff')
  expect(engine.launch()).toBe(false)
  expect(engine.cashOut()).toBe(false)
})

test('entering attract resets balance, bet and auto for the next visitor', () => {
  const { engine } = setup([0.99])
  engine.stepBet(1)
  engine.toggleAuto()
  engine.launch()
  run(engine, 3.05 + 1.6 + 2.5 + 0.1)
  engine.setAttract(true)
  expect(engine.snapshot()).toMatchObject({ balance: 10_000, bet: 100, auto: { enabled: false, value: 2 }, attract: true })
  expect(engine.snapshot().history).toHaveLength(1)
})
