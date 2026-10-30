import { Color, Vector3 } from 'three'
import { horizonDip, smoothstep, sunTransmittance } from './atmosphere'
import { SPACE_SUN_DIR } from './environment'

// where the light comes from during the flight: a cold moon over the night pad, the sun rising out of the dawn as the
// rocket clears the clouds, a hard warm sun in space. the clouds (task 11), the earth (task 16) and the rare events
// (task 19) read their light directions here. directions point towards the light; azimuth 0 = +z, towards +x

const DEG = Math.PI / 180
const lerp = (a: number, b: number, t: number) => a + (b - a) * t

export function dirFromAzEl(az: number, el: number, out = new Vector3()): Vector3 {
  return out.set(Math.sin(az) * Math.cos(el), Math.sin(el), Math.cos(az) * Math.cos(el))
}

// the sun on the pad: below the horizon (twilight), behind the rocket as the broadcast camera sees it, where the pad
// environment map has its glow. in space it is where the space environment map has it. it rises out of the twilight
// between stage 1 and 3 (the rocket climbs over the horizon and pitches over) and swings round to the front of the
// livery from stage 2.1 (the roll program)
export const SUN_PAD_ELEVATION = -8 * DEG
export const SUN_PAD_AZIMUTH = Math.PI + 0.6
export const SUN_SPACE_ELEVATION = Math.asin(SPACE_SUN_DIR.y)
export const SUN_SPACE_AZIMUTH = Math.atan2(SPACE_SUN_DIR.x, SPACE_SUN_DIR.z) + 2 * Math.PI

// the moon, where the pad environment map has it
export const MOON_DIR = dirFromAzEl(2.1, 0.75)

export function sunElevationAt(stageF: number): number {
  const k = smoothstep(1, 3, stageF)
  return lerp(SUN_PAD_ELEVATION, SUN_SPACE_ELEVATION, k * k)
}

export function sunAzimuthAt(stageF: number): number {
  return lerp(SUN_PAD_AZIMUTH, SUN_SPACE_AZIMUTH, smoothstep(2.1, 3, stageF))
}

// 0..1, how much of the sun's disc is above the horizon of this altitude
export function sunAbove(elevation: number, altM: number): number {
  const h = -horizonDip(altM)
  return smoothstep(h - 0.3 * DEG, h + 0.3 * DEG, elevation)
}

// the environment maps (rocket and pad reflections): the pad map until the sun is up, then the space map. the pad
// map's floodlight banks fade as the rocket climbs away from them and the space map comes in as the sun climbs, so
// the swap happens at a low level
export const SPACE_ENV_STAGE = 1.9
export function envScaleAt(stageF: number): number {
  if (stageF < SPACE_ENV_STAGE) return lerp(1, 0.35, smoothstep(1, SPACE_ENV_STAGE, stageF))
  return lerp(0.35, 1, smoothstep(SPACE_ENV_STAGE, 2.6, stageF))
}

const MOON_KEY = new Color(0.55, 0.68, 1) // cold
const MOON_KEY_I = 0.4
const SUN_KEY = new Color(1, 0.92, 0.82) // warm, before the atmosphere reddens it
const SUN_KEY_I = 6.5
const NIGHT_SKY = new Color(0.0066, 0.01, 0.021) // hemisphere fill on the pad
const NIGHT_GROUND = new Color(0.0006, 0.0006, 0.0008)
const DAWN_SKY = new Color(0.018, 0.03, 0.06) // the bright dawn sky over the clouds
const EARTH_FILL = new Color(0.03, 0.06, 0.13) // earthshine from below in space

export interface LightState {
  sunDir: Vector3 // towards the sun
  moonDir: Vector3 // towards the moon
  keyDir: Vector3 // towards the key light (the moon, then the sun)
  keyColor: Color // brightest channel 1
  keyIntensity: number
  sunElevation: number // radians over the horizontal
  sunAbove: number // 0..1 above the horizon (0 below it or behind the earth)
  sunColor: Color // sunlight that reaches the rocket through the air, 1 = the sun in space
  horizon: number // elevation of the rocket's horizon (negative as it climbs), radians
  fillSky: Color // hemisphere fill
  fillGround: Color
  envScale: number // environment map strength
  envRotation: number // y rotation that turns the space map's sun to the sun's azimuth
}

export const lightState: LightState = {
  sunDir: new Vector3(),
  moonDir: MOON_DIR.clone(),
  keyDir: new Vector3(),
  keyColor: new Color(),
  keyIntensity: 0,
  sunElevation: SUN_PAD_ELEVATION,
  sunAbove: 0,
  sunColor: new Color(),
  horizon: 0,
  fillSky: new Color(),
  fillGround: new Color(),
  envScale: 1,
  envRotation: 0,
}

// the sunrise event (task 19) takes the elevation over; null hands it back to the flight path
let sunElevationOverride: number | null = null
export function overrideSunElevation(rad: number | null): void {
  sunElevationOverride = rad
}

const sunKey = new Color()
const part = new Color()

// refreshes lightState for the rig's stage and altitude
export function updateLightState(stageF: number, altM: number, s: LightState = lightState): LightState {
  const el = sunElevationOverride ?? sunElevationAt(stageF)
  const az = sunAzimuthAt(stageF)
  dirFromAzEl(az, el, s.sunDir)
  s.sunElevation = el
  s.horizon = -horizonDip(altM)
  s.sunAbove = sunAbove(el, altM)
  sunTransmittance(altM, Math.max(el, s.horizon), s.sunColor).multiplyScalar(s.sunAbove)

  // key: the moon until the rocket is through the clouds, then the sun as it rises
  const moonPower = MOON_KEY_I * (1 - smoothstep(1.5, 1.95, stageF))
  sunKey.copy(SUN_KEY).multiply(s.sunColor)
  const sunMax = Math.max(sunKey.r, sunKey.g, sunKey.b)
  const sunPower = SUN_KEY_I * sunMax
  if (sunMax > 0) sunKey.multiplyScalar(1 / sunMax)
  const total = moonPower + sunPower
  s.keyIntensity = total
  if (total > 0) s.keyColor.copy(MOON_KEY).lerp(sunKey, sunPower / total)
  else s.keyColor.copy(sunKey)
  const m = Math.max(s.keyColor.r, s.keyColor.g, s.keyColor.b)
  if (m > 0) s.keyColor.multiplyScalar(1 / m)
  s.keyDir
    .copy(s.moonDir)
    .multiplyScalar(moonPower)
    .addScaledVector(s.sunDir, sunPower + 1e-4)
    .normalize()

  // fill: the night sky on the pad, the dawn sky over the clouds, earthshine from below in space
  const night = 1 - smoothstep(1.6, 2.2, stageF)
  const dawn = smoothstep(1.85, 2.05, stageF) * (1 - smoothstep(2.4, 2.8, stageF))
  const earth = smoothstep(2.2, 2.6, stageF)
  s.fillSky.copy(NIGHT_SKY).multiplyScalar(night).add(part.copy(DAWN_SKY).multiplyScalar(dawn * s.sunAbove))
  s.fillGround.copy(NIGHT_GROUND).multiplyScalar(night).add(part.copy(EARTH_FILL).multiplyScalar(earth))

  s.envScale = envScaleAt(stageF)
  s.envRotation = stageF >= SPACE_ENV_STAGE ? az - SUN_SPACE_AZIMUTH : 0
  return s
}

// valid before the first frame
updateLightState(0, 0)
