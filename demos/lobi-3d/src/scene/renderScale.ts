// How many device pixels the lobby renders. Phones get their full 3× sharpness, big screens stay at
// 1× (a 1080p stand TV is already 2 M pixels of bloom and post-processing per frame).

/** most pixels a frame may cost: a 3× phone (~3.0 M) fits, a 4K canvas at 2× would not */
export const PIXEL_BUDGET = 3.3e6

export function maxDpr(cssWidth: number, cssHeight: number, deviceDpr: number): number {
  const budget = Math.sqrt(PIXEL_BUDGET / Math.max(1, cssWidth * cssHeight))
  return Math.max(1, Math.min(deviceDpr, 3, budget))
}
