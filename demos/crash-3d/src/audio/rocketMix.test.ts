import { expect, test } from 'vitest'
import { initialRig, type FlightRig } from '../scene/rig'
import { rocketMix } from './rocketMix'

const at = (p: Partial<FlightRig>): FlightRig => ({ ...initialRig(), ...p })

test('silent on the pad until the engines light, loud at full thrust', () => {
  expect(rocketMix(at({ phase: 'betting' })).roar).toBe(0)
  expect(rocketMix(at({ phase: 'countdown', thrust: 0.5 })).roar).toBeGreaterThan(0)
  expect(rocketMix(at({ phase: 'flight', thrust: 1, stageF: 0.1 })).roar).toBeGreaterThan(0.6)
})

test('in vacuum the roar is muffled: quieter and darker', () => {
  const air = rocketMix(at({ phase: 'flight', thrust: 1, stageF: 1 }))
  const vac = rocketMix(at({ phase: 'flight', thrust: 1, stageF: 4 }))
  expect(vac.cutoff).toBeLessThan(air.cutoff / 2)
  expect(vac.roar).toBeLessThan(air.roar)
})

test('the riser climbs with the multiplier and stays in a sane range', () => {
  let prev = 0
  for (const m of [1.01, 1.5, 2, 5, 20, 100, 1000]) {
    const r = rocketMix(at({ phase: 'flight', thrust: 1, m, stageF: Math.log(m) })).riserHz
    expect(r).toBeGreaterThan(prev)
    expect(r).toBeLessThanOrEqual(1400)
    prev = r
  }
})

test('after the crash or a cash out of nothing everything fades out', () => {
  const crash = rocketMix(at({ phase: 'crashed', thrust: 0, crashAge: 0.1 }))
  expect(crash.roar).toBe(0)
  expect(crash.riser).toBe(0)
})
