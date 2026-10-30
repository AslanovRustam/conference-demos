import { Color } from 'three'

// a thin model of earth's atmosphere for the sky dome (glsl twin in far/SkyDome.tsx), the sun's color and the key
// light: rayleigh and mie scattering with exponential density profiles, ozone riding on the rayleigh density,
// optical depth towards the sun from schuler's analytic chapman function. units: km

export const EARTH_R_KM = 6371
export const ATMOSPHERE_KM = 100 // thickness: past this there is nothing to scatter
export const RAYLEIGH_H_KM = 8
export const MIE_H_KM = 1.2
// scattering per km at sea level
export const RAYLEIGH: [number, number, number] = [5.802e-3, 13.558e-3, 33.1e-3]
// ozone absorption, scaled onto the rayleigh profile (the layer's column over the rayleigh scale height), doubled:
// it keeps the twilight zenith blue
export const OZONE: [number, number, number] = [2.44e-3, 7.05e-3, 0.32e-3]
export const MIE = 5e-3
export const MIE_EXT = 5.5e-3
export const MIE_G = 0.8

const clamp01 = (x: number) => Math.min(1, Math.max(0, x))
export const smoothstep = (a: number, b: number, x: number) => {
  const t = clamp01((x - a) / (b - a))
  return t * t * (3 - 2 * t)
}

// how far the geometric horizon sits below the horizontal at this altitude, radians
export function horizonDip(altM: number): number {
  const h = Math.max(0, altM) / 1000
  return Math.acos(EARTH_R_KM / (EARTH_R_KM + h))
}

// column density along a ray from altitude x (in scale heights) at zenith cosine cosZ, in units of the sea level density
// times the scale height; X is the planet radius in scale heights. a ray into the planet comes out huge, not infinite
export function chapman(X: number, x: number, cosZ: number): number {
  const c = Math.sqrt(X + x)
  if (cosZ >= 0) return (c / (c * cosZ + 1)) * Math.exp(-x)
  const x0 = Math.sqrt(1 - cosZ * cosZ) * (X + x)
  return 2 * Math.sqrt(x0) * Math.exp(Math.min(X - x0, 60)) - (c / (1 - c * cosZ)) * Math.exp(-x)
}

// how much sunlight gets through the air to a point at this altitude, for a sun at this elevation (per channel)
export function sunTransmittance(altM: number, elevation: number, out = new Color()): Color {
  const h = Math.max(0, altM) / 1000
  const cosZ = Math.sin(elevation)
  const r = RAYLEIGH_H_KM * chapman(EARTH_R_KM / RAYLEIGH_H_KM, h / RAYLEIGH_H_KM, cosZ)
  const m = MIE_H_KM * chapman(EARTH_R_KM / MIE_H_KM, h / MIE_H_KM, cosZ)
  const t = (k: 0 | 1 | 2) => Math.exp(-((RAYLEIGH[k] + OZONE[k]) * r + MIE_EXT * m))
  return out.setRGB(t(0), t(1), t(2))
}
