import { expect, test } from 'vitest'
import { carouselRotation, nearestTarget, ringDistance, slotTransform, snapTarget, wrapIndex } from './math'

test('wrapIndex', () => {
  expect(wrapIndex(-1, 6)).toBe(5)
  expect(wrapIndex(7, 6)).toBe(1)
  expect(wrapIndex(0, 6)).toBe(0)
})

test('slotTransform puts slot 0 on +z facing out', () => {
  const t = slotTransform(0, 6, 4)
  expect(t.position[0]).toBeCloseTo(0)
  expect(t.position[2]).toBeCloseTo(4)
  expect(t.rotationY).toBeCloseTo(0)
  expect(slotTransform(3, 6, 4).position[2]).toBeCloseTo(-4)
})

test('carouselRotation brings the target slot to the front', () => {
  // slot 1 sits at angle 60°; rotating the group by -60° moves it onto +z
  expect(carouselRotation(1, 6)).toBeCloseTo(-Math.PI / 3)
})

test('nearestTarget takes the short way round', () => {
  expect(nearestTarget(5.2, 0, 6)).toBe(6)
  expect(nearestTarget(0.4, 5, 6)).toBe(-1)
  expect(nearestTarget(2, 3, 6)).toBe(3)
})

test('snapTarget', () => {
  expect(snapTarget(2.3, 0)).toBe(2)
  expect(snapTarget(2.3, 4)).toBe(3)
  expect(snapTarget(0, 40)).toBe(2)
  expect(snapTarget(0, -40)).toBe(-2)
})

test('ringDistance', () => {
  expect(ringDistance(0, 5, 6)).toBe(1)
  expect(ringDistance(1, 4, 6)).toBe(3)
})
