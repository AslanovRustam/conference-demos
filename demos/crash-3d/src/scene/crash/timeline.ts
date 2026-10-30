// the explosion's beats by visual seconds since the blast (rig.vtime, so the slow motion stretches them).
// after a cash out the same show plays 0.6× as long

export interface CrashBeat {
  flash: number // 0..1 full-screen flash amount
  flashRed: number // 0 white … 1 brand red
  chroma: number // 0..1 chromatic aberration
  shake: number // camera shake amplitude
  zoom: number // radial blur
  fireRadius: number // metres
  fireHeat: number // 1 white hot … 0 cold smoke
  fireAlpha: number
  ringRadius: number // metres
  ringStrength: number // 0..1 screen refraction of the shockwave
}

const SHORT = 0.6
const FLASH_S = 0.8
const FLASH_RED_AT = 0.06 // white for a blink, then red
const FLASH_RED_S = 0.18
const RED_DIM = 0.45 // the red wash is this much weaker than the white blink
const PULSE_S = 1.2 // chroma, shake, zoom
const FIRE_MAX_M = 60
const FIRE_GROW = 3.2 // 1/s
const FIRE_COOL_S = 1.6
const FIRE_FADE_S = 2.6
const RING_SPEED = 260 // m/s
const RING_S = 1.3

const clamp01 = (x: number) => Math.min(1, Math.max(0, x))
const smooth = (x: number) => {
  const k = clamp01(x)
  return k * k * (3 - 2 * k)
}

export function crashTimeline(age: number, short: boolean): CrashBeat {
  const a = Math.max(0, age) / (short ? SHORT : 1)
  const pulse = Math.exp(-4 * a) * (1 - smooth(a / PULSE_S))
  const red = smooth((a - FLASH_RED_AT) / FLASH_RED_S)
  return {
    // a blinding white blink, then a brand-red wash that never hides the fireball
    flash: a >= FLASH_S ? 0 : (1 - smooth(a / FLASH_S)) * (a < 0.03 ? 1 : 0.85) * (1 - RED_DIM * red),
    flashRed: red,
    chroma: pulse,
    shake: pulse,
    zoom: 0.35 * pulse,
    fireRadius: FIRE_MAX_M * (1 - Math.exp(-FIRE_GROW * a)),
    fireHeat: 1 - smooth(a / FIRE_COOL_S),
    fireAlpha: 1 - smooth(a / FIRE_FADE_S),
    ringRadius: RING_SPEED * a,
    ringStrength: a >= RING_S ? 0 : 1 - smooth(a / RING_S),
  }
}
