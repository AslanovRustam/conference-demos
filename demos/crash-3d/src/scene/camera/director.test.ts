import { expect, test } from 'vitest'
import { createRng } from '../../core/rng'
import { createDirector } from './director'
import { requestShot } from './shotRequest'
import type { ShotId } from './shots'
import { rigAt } from './testRig'

const DT = 1 / 60

test('in flight, cuts every 3–6 s and never repeats a shot twice in a row', () => {
  const d = createDirector(createRng(1))
  const cuts: { shot: ShotId; at: number }[] = []
  for (let t = 0; t < 120; t += DT) {
    const r = d.update(rigAt({ phase: 'flight', stageF: 3 }), DT, 16 / 9)
    if (r.cut) cuts.push({ shot: r.shot, at: t })
  }
  expect(cuts.length).toBeGreaterThan(15)
  for (let i = 1; i < cuts.length; i++) {
    expect(cuts[i].shot).not.toBe(cuts[i - 1].shot)
    expect(cuts[i].at - cuts[i - 1].at).toBeGreaterThanOrEqual(3 - 1e-6)
    expect(cuts[i].at - cuts[i - 1].at).toBeLessThanOrEqual(6 + 1e-6)
  }
})

test('ground telephoto is only used up to stage 1', () => {
  const d = createDirector(createRng(2))
  const seen = new Set<ShotId>()
  for (let t = 0; t < 120; t += DT) seen.add(d.update(rigAt({ phase: 'flight', stageF: 3 }), DT, 16 / 9).shot)
  expect(seen.has('groundTele')).toBe(false)
  expect(seen.size).toBe(3)
})

test('countdown uses pad shots, eject follows the capsule, crash goes wide', () => {
  const d = createDirector(createRng(1))
  expect(['padWide', 'padClose']).toContain(d.update(rigAt({ phase: 'countdown' }), 0.016, 16 / 9).shot)
  expect(d.update(rigAt({ phase: 'ejected', ejected: true }), 0.016, 16 / 9).shot).toBe('capsuleFollow')
  expect(d.update(rigAt({ phase: 'crashed', crashAge: 0 }), 0.016, 16 / 9).shot).toBe('crashWide')
})

test('capsuleFollow hands back to the rocket after 1.5 s', () => {
  const d = createDirector(createRng(3))
  let shot: ShotId = 'padWide'
  for (let t = 0; t < 1.6; t += DT) shot = d.update(rigAt({ phase: 'ejected', ejected: true, stageF: 2 }), DT, 16 / 9).shot
  expect(['sideChase', 'wide']).toContain(shot)
})

test('the countdown goes from the wide pad shot to the close one, liftoff cuts to the ground telephoto', () => {
  const d = createDirector(createRng(4))
  expect(d.update(rigAt({ phase: 'betting' }), DT, 16 / 9).shot).toBe('padWide')
  const shots: ShotId[] = []
  for (let t = 0; t < 3; t += DT) shots.push(d.update(rigAt({ phase: 'countdown' }), DT, 16 / 9).shot)
  expect(shots[0]).toBe('padWide')
  expect(shots[shots.length - 1]).toBe('padClose')
  const lift = d.update(rigAt({ phase: 'flight', stageF: 0.01 }), DT, 16 / 9)
  expect(lift).toMatchObject({ shot: 'groundTele', cut: true })
})

test('a new round starts again on the wide pad shot', () => {
  const d = createDirector(createRng(5))
  d.update(rigAt({ phase: 'crashed', crashAge: 0 }), DT, 16 / 9)
  expect(d.update(rigAt({ phase: 'betting' }), DT, 16 / 9)).toMatchObject({ shot: 'padWide', cut: true })
})

test('a rare event asks for a camera: the director cuts to it at once and holds it for the event', () => {
  const d = createDirector(createRng(5))
  for (let t = 0; t < 0.5; t += DT) d.update(rigAt({ phase: 'flight', stageF: 3 }), DT, 16 / 9)
  requestShot('sunrise', 5)
  const r = d.update(rigAt({ phase: 'flight', stageF: 3 }), DT, 16 / 9)
  expect(r).toMatchObject({ shot: 'sunrise', cut: true })
  for (let t = 0; t < 4.9; t += DT) expect(d.update(rigAt({ phase: 'flight', stageF: 3 }), DT, 16 / 9).shot).toBe('sunrise')
  let shot: ShotId = 'sunrise'
  for (let t = 0; t < 0.3; t += DT) shot = d.update(rigAt({ phase: 'flight', stageF: 3 }), DT, 16 / 9).shot
  expect(shot).not.toBe('sunrise')
})

test('a camera request waits out the capsule shot', () => {
  const d = createDirector(createRng(6))
  d.update(rigAt({ phase: 'ejected', ejected: true, stageF: 3 }), DT, 16 / 9)
  requestShot('wide', 5)
  expect(d.update(rigAt({ phase: 'ejected', ejected: true, stageF: 3 }), DT, 16 / 9).shot).toBe('capsuleFollow')
  let shot: ShotId = 'capsuleFollow'
  for (let t = 0; t < 1.6; t += DT) shot = d.update(rigAt({ phase: 'ejected', ejected: true, stageF: 3 }), DT, 16 / 9).shot
  expect(shot).toBe('wide')
})
