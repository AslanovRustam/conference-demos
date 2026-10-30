// Camera framing for the fly-in: how close the camera must get for the cabinet screen to cover
// the whole viewport, whatever the display aspect (16:9 stand TV, 4:3 projector, portrait kiosk).

const DEG = Math.PI / 180

export function coverDistance(screenW: number, screenH: number, vfovDeg: number, aspect: number): number {
  const t = Math.tan((vfovDeg * DEG) / 2)
  const distH = screenH / 2 / t
  const distW = screenW / 2 / (t * aspect)
  // the nearer of the two makes the screen overflow the other axis instead of leaving bars
  return Math.min(distH, distW)
}
