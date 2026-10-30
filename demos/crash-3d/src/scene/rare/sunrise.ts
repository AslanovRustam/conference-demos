const DEG = Math.PI / 180

// how far under the horizon the sun waits in a sunrise round
export const SUNRISE_HOLD = 1.2 * DEG

// the sun's elevation in a sunrise round (null: the flight's own). it waits under the horizon from liftoff, rises
// out of the limb during the event, slowly at first (the glow builds), and meets the flight's sun at the end
export function sunriseElevation(
  normal: number,
  horizon: number,
  show: { started: boolean; active: boolean; p: number },
): number | null {
  const low = Math.min(normal, horizon - SUNRISE_HOLD)
  if (!show.started) return low
  if (!show.active) return null
  return low + (normal - low) * show.p ** 3
}
