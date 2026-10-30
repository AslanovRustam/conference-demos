import { expect, test } from 'vitest'
import { multiplierAt, timeAt } from '../core/curve'
import { stageAt } from '../core/stages'
import type { RoundSnapshot } from '../core/types'
import { computeRig, initialRig } from './rig'

// a full snapshot with defaults; the rocket clock follows the multiplier unless given
function snapAt(partial: Partial<RoundSnapshot>): RoundSnapshot {
  const multiplier = partial.multiplier ?? 1
  return {
    phase: 'betting',
    balance: 10_000,
    bet: 100,
    auto: { enabled: false, value: 2 },
    countdown: 0,
    t: timeAt(multiplier),
    multiplier,
    cashedAt: null,
    payout: 0,
    crashPoint: null,
    stage: stageAt(multiplier),
    phaseAge: 0,
    history: [],
    armed: null,
    attract: false,
    rare: null,
    frozen: false,
    ...partial,
  }
}

test('rocket stays in the near field and the world shifts past 6 km', () => {
  const r = computeRig(initialRig(), snapAt({ phase: 'flight', multiplier: 3 }), 1 / 60)
  expect(r.altM).toBeCloseTo(40_000, 0)
  expect(r.rocketY).toBe(6000)
  expect(r.nearOffset).toBeCloseTo(34_000, 0)
})
test('thrust is 0 while betting and ramps during the last 1.5 s of countdown', () => {
  expect(computeRig(initialRig(), snapAt({ phase: 'betting' }), 0.016).thrust).toBe(0)
  expect(computeRig(initialRig(), snapAt({ phase: 'countdown', countdown: 2 }), 0.016).thrust).toBe(0)
  expect(computeRig(initialRig(), snapAt({ phase: 'countdown', countdown: 0.75 }), 0.016).thrust).toBeCloseTo(0.5, 2)
})
test('slow motion starts at 0.3 on crash and recovers by 1.5 s', () => {
  let r = computeRig(initialRig(), snapAt({ phase: 'crashed', phaseAge: 0 }), 0.016)
  expect(r.slowmo).toBeCloseTo(0.3, 2)
  r = computeRig(r, snapAt({ phase: 'crashed', phaseAge: 1.5 }), 0.016)
  expect(r.slowmo).toBe(1)
})
test('ejected keeps the rocket flying and remembers the stage', () => {
  const r = computeRig(initialRig(), snapAt({ phase: 'ejected', multiplier: 4, cashedAt: 2 }), 0.016)
  expect(r).toMatchObject({ ejected: true, ejectStage: 2 })
})

// beyond the brief: the rest of the rig contract later scene tasks rely on
test('below 6 km the rocket climbs and the world stays put', () => {
  const r = computeRig(initialRig(), snapAt({ phase: 'flight', multiplier: 1.2 }), 1 / 60)
  expect(r.altM).toBeCloseTo(400, 3)
  expect(r.rocketY).toBeCloseTo(400, 3)
  expect(r.nearOffset).toBe(0)
  expect(r.stageF).toBeCloseTo(1, 6)
})
test('on the pad everything is at rest', () => {
  const r = computeRig(initialRig(), snapAt({ phase: 'betting' }), 0.016)
  expect(r).toMatchObject({ altM: 0, rocketY: 0, nearOffset: 0, speed: 0, thrust: 0, ejected: false, ejectStage: null, crashAge: null, slowmo: 1 })
})
test('flight runs at full thrust and speed follows the stage', () => {
  const r = computeRig(initialRig(), snapAt({ phase: 'flight', multiplier: 3 }), 0.016)
  expect(r.thrust).toBe(1)
  expect(r.speed).toBeCloseTo(0.6, 6)
  expect(computeRig(r, snapAt({ phase: 'flight', multiplier: 500 }), 0.016).speed).toBe(1)
})
test('altitude follows the unfloored rocket clock between cent steps', () => {
  // the snapshot multiplier is floored to cents; the clock is a bit further along
  const t = timeAt(1.1) + 0.03
  const r = computeRig(initialRig(), snapAt({ phase: 'flight', multiplier: 1.1, t }), 0.016)
  expect(r.m).toBeCloseTo(multiplierAt(t), 9)
  expect(r.m).toBeGreaterThan(1.1)
})
test('after the crash: no thrust, speed eases out, crash clock keeps running into the result', () => {
  const flying = computeRig(initialRig(), snapAt({ phase: 'flight', multiplier: 30 }), 0.016)
  expect(flying.speed).toBe(1)
  let r = computeRig(flying, snapAt({ phase: 'crashed', multiplier: 30, crashPoint: 30, phaseAge: 0.5 }), 0.1)
  expect(r.thrust).toBe(0)
  expect(r.crashAge).toBeCloseTo(0.5, 6)
  expect(r.speed).toBeLessThan(1)
  expect(r.speed).toBeGreaterThan(0)
  for (let i = 0; i < 40; i++) r = computeRig(r, snapAt({ phase: 'crashed', multiplier: 30, crashPoint: 30, phaseAge: 0.5 }), 0.1)
  expect(r.speed).toBeLessThan(0.01)
  // the altitude stays where the rocket blew up
  expect(r.altM).toBeCloseTo(flying.altM, 3)
  r = computeRig(r, snapAt({ phase: 'result', multiplier: 30, crashPoint: 30, phaseAge: 0.4 }), 0.016)
  expect(r.crashAge).toBeCloseTo(1.6 + 0.4, 6)
})
test('a cashed-out round stays ejected through the crash', () => {
  const r = computeRig(initialRig(), snapAt({ phase: 'crashed', multiplier: 6, crashPoint: 6, cashedAt: 1.3 }), 0.016)
  expect(r).toMatchObject({ ejected: true, ejectStage: 1, thrust: 0 })
  // the short crash scene is 1.0 s when the player had cashed out
  const res = computeRig(r, snapAt({ phase: 'result', multiplier: 6, crashPoint: 6, cashedAt: 1.3, phaseAge: 0.2 }), 0.016)
  expect(res.crashAge).toBeCloseTo(1.2, 6)
})
test('the visual clock runs slower during slow motion', () => {
  let r = computeRig(initialRig(), snapAt({ phase: 'flight', multiplier: 2 }), 0.5)
  expect(r.vtime).toBeCloseTo(0.5, 9)
  r = computeRig(r, snapAt({ phase: 'crashed', multiplier: 2, crashPoint: 2, phaseAge: 0 }), 0.5)
  expect(r.vtime).toBeCloseTo(0.5 + 0.5 * 0.3, 9)
})
test('computeRig does not mutate the previous rig', () => {
  const prev = initialRig()
  const copy = { ...prev }
  computeRig(prev, snapAt({ phase: 'flight', multiplier: 5 }), 0.016)
  expect(prev).toEqual(copy)
})
