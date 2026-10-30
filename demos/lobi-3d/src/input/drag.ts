// Horizontal drag/swipe tracking. A press that moves less than the threshold is a tap
// (so it can open a cabinet); release velocity comes from the last 100 ms only, so a
// finger that stops before lifting does not fling the carousel.

const WINDOW_MS = 100

/** Fingers jitter more than a mouse; Chrome's own tap slop is about 15 px. */
export function dragThreshold(pointerType: string): number {
  return pointerType === 'touch' ? 12 : 6
}

export interface DragTracker {
  /** `thresholdPx` overrides the tracker default for this press */
  start(x: number, t: number, thresholdPx?: number): void
  /** total offset from the start, in px */
  move(x: number, t: number): number
  end(t: number): { wasDrag: boolean; velocityPxPerSec: number }
  isDragging(): boolean
}

export function createDragTracker(thresholdPx = 6): DragTracker {
  let x0 = 0
  let threshold = thresholdPx
  let dragging = false
  let samples: { x: number; t: number }[] = []

  return {
    start(x, t, thresholdOverride) {
      x0 = x
      threshold = thresholdOverride ?? thresholdPx
      dragging = false
      samples = [{ x, t }]
    },
    move(x, t) {
      if (Math.abs(x - x0) > threshold) dragging = true
      samples.push({ x, t })
      while (samples.length > 2 && t - samples[0].t > WINDOW_MS) samples.shift()
      return x - x0
    },
    end(t) {
      const recent = samples.filter((s) => t - s.t <= WINDOW_MS)
      let velocityPxPerSec = 0
      if (recent.length >= 2) {
        const a = recent[0]
        const b = recent[recent.length - 1]
        if (b.t > a.t) velocityPxPerSec = ((b.x - a.x) / (b.t - a.t)) * 1000
      }
      return { wasDrag: dragging, velocityPxPerSec }
    },
    isDragging: () => dragging,
  }
}

/** Dragging left by 30% of the screen width moves one slot forward. */
export function pxToSlots(px: number, viewportWidth: number): number {
  return -px / (viewportWidth * 0.3)
}
