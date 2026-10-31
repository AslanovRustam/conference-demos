import { afterEach, expect, test } from 'vitest'
import { SPACE_SUN_DIR } from './environment'
import {
  envScaleAt,
  lightState,
  MOON_DIR,
  overrideSunAzimuth,
  overrideSunElevation,
  SPACE_ENV_STAGE,
  sunAbove,
  sunElevationAt,
  SUN_PAD_ELEVATION,
  SUN_SPACE_ELEVATION,
  updateLightState,
  type LightState,
} from './lightState'

const DEG = Math.PI / 180
// stage -> altitude in metres, as the telemetry anchors put it (0, 0.4, 3.5, 40, 400 km at stages 0..4)
const ALT = [0, 400, 3500, 40_000, 400_000]
const altAt = (s: number) => {
  const i = Math.min(Math.floor(s), 3)
  return ALT[i] + (ALT[i + 1] - ALT[i]) * (s - i)
}
const at = (s: number): LightState => structuredCloneState(updateLightState(s, altAt(s)))
function structuredCloneState(s: LightState) {
  return {
    ...s,
    sunDir: s.sunDir.clone(),
    keyDir: s.keyDir.clone(),
    keyColor: s.keyColor.clone(),
    sunColor: s.sunColor.clone(),
    fillSky: s.fillSky.clone(),
    fillGround: s.fillGround.clone(),
  }
}

afterEach(() => {
  overrideSunElevation(null)
  overrideSunAzimuth(null)
})

test('the sun climbs out of the twilight: -8 degrees on the pad, the space map sun from stage 3', () => {
  expect(sunElevationAt(0)).toBeCloseTo(SUN_PAD_ELEVATION, 9)
  expect(sunElevationAt(1)).toBeCloseTo(SUN_PAD_ELEVATION, 9)
  expect(SUN_PAD_ELEVATION / DEG).toBeCloseTo(-8, 9)
  expect(sunElevationAt(3)).toBeCloseTo(SUN_SPACE_ELEVATION, 9)
  let last = -Infinity
  for (let s = 0; s <= 6; s += 0.05) {
    const el = sunElevationAt(s)
    expect(el).toBeGreaterThanOrEqual(last - 1e-12)
    last = el
  }
})

test('in space the sun is exactly where the space environment map has it', () => {
  for (const s of [3, 4, 5.5]) {
    const { sunDir, envRotation } = at(s)
    expect(sunDir.distanceTo(SPACE_SUN_DIR)).toBeLessThan(1e-9)
    expect(envRotation).toBeCloseTo(0, 9)
  }
})

test('on the pad: night, the sun below the horizon, a weak cold moon key', () => {
  const s = at(0)
  expect(s.sunAbove).toBe(0)
  expect(s.sunColor.r).toBe(0)
  expect(s.keyDir.distanceTo(MOON_DIR)).toBeLessThan(1e-3)
  expect(s.keyIntensity).toBeLessThan(1)
  expect(s.keyColor.b).toBeGreaterThan(s.keyColor.r)
  expect(s.envScale).toBe(1)
})

test('over the clouds the sun is up, and from stage 2.2 the key is a strong warm sun', () => {
  expect(sunAbove(sunElevationAt(2), altAt(2))).toBe(1)
  for (const st of [2.2, 2.6, 3, 4.5]) {
    const s = at(st)
    expect(s.keyDir.angleTo(s.sunDir)).toBeLessThan(1e-3)
    expect(s.keyIntensity).toBeGreaterThan(4)
    expect(s.keyColor.r).toBeGreaterThan(s.keyColor.b)
  }
  // golden at sunrise, whiter in space
  const dawn = at(2)
  const space = at(4)
  expect(dawn.keyColor.b).toBeLessThan(space.keyColor.b)
})

// 0.01 of a stage is ~20 ms of flight around the sunrise, where the key climbs fastest (0 to 6 in ~1.2 s)
test('the key never jumps', () => {
  let last = at(0)
  for (let s = 0.01; s <= 6; s += 0.01) {
    const cur = at(s)
    expect(Math.abs(cur.keyIntensity - last.keyIntensity)).toBeLessThan(0.5)
    if (cur.keyIntensity > 0.2 && last.keyIntensity > 0.2) expect(cur.keyDir.angleTo(last.keyDir)).toBeLessThan(0.12)
    last = cur
  }
})

test('earthshine fills from below only once the earth is under the rocket', () => {
  const pad = at(0)
  const space = at(3)
  expect(space.fillGround.b).toBeGreaterThan(space.fillGround.r)
  expect(space.fillGround.b).toBeGreaterThan(pad.fillGround.b * 20)
  expect(space.fillSky.b).toBeLessThan(1e-6)
})

test('the environment maps swap at a low level and are at full strength on the pad and in space', () => {
  expect(envScaleAt(0)).toBe(1)
  expect(envScaleAt(3)).toBe(1)
  expect(Math.abs(envScaleAt(SPACE_ENV_STAGE - 1e-6) - envScaleAt(SPACE_ENV_STAGE))).toBeLessThan(1e-4)
  expect(envScaleAt(SPACE_ENV_STAGE)).toBeLessThan(0.5)
})

test('the sunrise event takes the elevation over and hands it back', () => {
  overrideSunElevation(-20 * DEG)
  const dark = at(3)
  expect(dark.sunAbove).toBe(0)
  expect(dark.keyIntensity).toBeLessThan(0.01)
  expect(lightState.sunElevation).toBeCloseTo(-20 * DEG, 9)
  overrideSunElevation(null)
  expect(at(3).sunAbove).toBe(1)
})

test('a sunrise round can turn the sun into the crash view: the azimuth override wins and hands back', () => {
  overrideSunAzimuth(Math.PI + 0.4)
  at(3)
  expect(Math.atan2(lightState.sunDir.x, lightState.sunDir.z)).toBeCloseTo(-Math.PI + 0.4, 6)
  overrideSunAzimuth(null)
  at(3)
  const az = Math.atan2(lightState.sunDir.x, lightState.sunDir.z)
  expect(Math.abs(az - (-Math.PI + 0.4))).toBeGreaterThan(0.1)
})
