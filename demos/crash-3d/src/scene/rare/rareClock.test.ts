import { expect, test } from 'vitest'
import type { RarePlan } from '../../core/types'
import { createRareShow, RARE_FREEZE_P, stepRare } from './rareClock'

const DT = 1 / 60
const plan: RarePlan = { kind: 'station', atStage: 3.4 }

function run(show: ReturnType<typeof createRareShow>, seconds: number, stageF: number, frozen = false) {
  for (let t = 0; t < seconds; t += DT) stepRare(show, plan, stageF, true, frozen, DT)
}

test('waits for the rocket to reach atStage, then runs 4–6 s and ends', () => {
  const show = createRareShow()
  run(show, 2, 3.3)
  expect(show.active).toBe(false)
  stepRare(show, plan, 3.4, true, false, DT)
  expect(show).toMatchObject({ active: true, kind: 'station' })
  expect(show.dur).toBeGreaterThanOrEqual(4)
  expect(show.dur).toBeLessThanOrEqual(6)
  run(show, show.dur - 0.1, 3.6)
  expect(show.active).toBe(true)
  expect(show.p).toBeGreaterThan(0.9)
  run(show, 0.2, 3.7)
  expect(show.active).toBe(false)
  // once over it does not come back in the same round
  run(show, 1, 3.8)
  expect(show.active).toBe(false)
})

test('a frozen flight holds the event at its showcase moment', () => {
  const show = createRareShow()
  run(show, 20, 3.5, true)
  expect(show.active).toBe(true)
  expect(show.p).toBeCloseTo(RARE_FREEZE_P.station, 6)
})

test('no plan or no live flight: nothing runs; a new round starts over', () => {
  const show = createRareShow()
  stepRare(show, null, 4, true, false, DT)
  expect(show.active).toBe(false)
  run(show, 1, 3.5)
  expect(show.active).toBe(true)
  stepRare(show, plan, 3.5, false, false, DT) // crashed
  expect(show).toMatchObject({ active: false, kind: null })
  const next: RarePlan = { kind: 'meteors', atStage: 4 }
  stepRare(show, next, 4.1, true, false, DT)
  expect(show).toMatchObject({ active: true, kind: 'meteors' })
})
