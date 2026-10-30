import { expect, test } from 'vitest'
import { createDragTracker, dragThreshold, pxToSlots } from './drag'

test('a small move is a tap, not a drag', () => {
  const d = createDragTracker()
  d.start(100, 0)
  d.move(104, 50)
  expect(d.end(80).wasDrag).toBe(false)
})

test('a swipe is a drag with velocity', () => {
  const d = createDragTracker()
  d.start(100, 0)
  d.move(130, 50)
  expect(d.move(160, 100)).toBe(60)
  const r = d.end(110)
  expect(r.wasDrag).toBe(true)
  expect(r.velocityPxPerSec).toBeGreaterThan(300)
})

test('holding still before release kills the momentum', () => {
  const d = createDragTracker()
  d.start(100, 0)
  d.move(400, 100)
  expect(d.end(400)).toEqual({ wasDrag: true, velocityPxPerSec: 0 })
})

test('pxToSlots', () => {
  expect(pxToSlots(-576, 1920)).toBeCloseTo(1)
})

test('touch gets a wider tap slop than mouse', () => {
  expect(dragThreshold('mouse')).toBe(6)
  expect(dragThreshold('touch')).toBe(12)
  expect(dragThreshold('pen')).toBe(6)
})

test('finger jitter under the touch slop is still a tap', () => {
  const d = createDragTracker()
  d.start(100, 0, dragThreshold('touch'))
  d.move(110, 40)
  expect(d.isDragging()).toBe(false)
  expect(d.end(80).wasDrag).toBe(false)
  d.start(100, 0, dragThreshold('touch'))
  d.move(113, 40)
  expect(d.isDragging()).toBe(true)
})
