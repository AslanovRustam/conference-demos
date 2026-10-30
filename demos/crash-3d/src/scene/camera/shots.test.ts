import { expect, test } from 'vitest'
import { SHOTS, type ShotId } from './shots'
import { emptyPose, projectRocketCenter, rigAt } from './testRig'

const FLIGHT: ShotId[] = ['groundTele', 'onboard', 'sideChase', 'wide']

test.each([16 / 9, 9 / 19.5])('every flight shot keeps the rocket inside the central 70%% at aspect %f', (aspect) => {
  for (const id of FLIGHT) {
    const pose = emptyPose()
    SHOTS[id].pose(rigAt({ phase: 'flight', stageF: 1, rocketY: 900 }), 1, aspect, pose)
    const ndc = projectRocketCenter(pose, aspect, 900)
    expect(Math.abs(ndc.x), id).toBeLessThan(0.7)
    expect(Math.abs(ndc.y), id).toBeLessThan(0.7)
    expect(ndc.z, id).toBeLessThan(1) // in front of the camera, inside the far plane
  }
})

test('ground telephoto stays on the ground with a long lens', () => {
  const pose = emptyPose()
  SHOTS.groundTele.pose(rigAt({ phase: 'flight', stageF: 1, rocketY: 900 }), 2, 16 / 9, pose)
  expect(pose.pos.y).toBeLessThan(20)
  expect(pose.fov).toBeGreaterThanOrEqual(8)
  expect(pose.fov).toBeLessThanOrEqual(12)
})

test('side chase sits 60–90 m from the rocket', () => {
  for (const age of [0, 2, 4, 6]) {
    const pose = emptyPose()
    SHOTS.sideChase.pose(rigAt({ phase: 'flight', stageF: 3, rocketY: 6000 }), age, 16 / 9, pose)
    const d = Math.hypot(pose.pos.x, pose.pos.z)
    expect(d).toBeGreaterThanOrEqual(60)
    expect(d).toBeLessThanOrEqual(90)
  }
})

test('the wide shot pulls back 200–300 m', () => {
  const pose = emptyPose()
  SHOTS.wide.pose(rigAt({ phase: 'flight', stageF: 3, rocketY: 6000 }), 1, 16 / 9, pose)
  const d = pose.pos.distanceTo(pose.look)
  expect(d).toBeGreaterThanOrEqual(200)
  expect(d).toBeLessThanOrEqual(300)
})

test('every shot has a broadcast label', () => {
  for (const id of Object.keys(SHOTS) as ShotId[]) expect(SHOTS[id].label).toMatch(/^CAM \d · [A-Z]+$/)
  expect(SHOTS.groundTele.label).toBe('CAM 1 · GROUND')
  expect(SHOTS.onboard.label).toBe('CAM 2 · ONBOARD')
  expect(SHOTS.sideChase.label).toBe('CAM 3 · CHASE')
  expect(SHOTS.wide.label).toBe('CAM 4 · WIDE')
})
