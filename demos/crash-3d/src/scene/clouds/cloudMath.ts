// the clouds' geometry and optics in plain ts, mirrored line for line by the glsl in cloudsShader.ts (the tests pin
// them down here). distances in meters, altitudes over the pad (world y + rig.nearOffset)

export const EARTH_R_M = 6371000

// the cloud deck is a shell around the earth (it meets the horizon instead of running off flat), the camera stands
// on the earth's radius through it. distance along a ray to the sphere of altitude a, for a camera at altitude h and
// a ray with vertical component mu: [near, far] roots, NaN where there is no hit. written so that float32 keeps it:
// the radius squared never appears on its own, and the small root comes from the stable form
export function sphereHits(h: number, mu: number, a: number, R = EARTH_R_M): [number, number] {
  const r = R + h
  const b = r * mu
  const c = (h - a) * (2 * R + h + a) // r^2 - (R + a)^2
  const disc = b * b - c
  if (disc < 0) return [NaN, NaN]
  const s = Math.sqrt(disc)
  // roots of t^2 + 2bt + c = 0: -b - s and -b + s; q is the larger in magnitude, the other is c / q
  const q = b > 0 ? -b - s : -b + s
  const t1 = q
  const t2 = q !== 0 ? c / q : -b
  return t1 < t2 ? [t1, t2] : [t2, t1]
}

// the stretch of a ray inside the deck between altitudes base and top, first stretch only: [t0, t1], or null.
// below the deck: from the base up to the top. inside: from the camera to the top, or to the base on the way down.
// above: from the top down to the base, or out through the top again on a grazing ray
export function slabInterval(h: number, mu: number, base: number, top: number, R = EARTH_R_M): [number, number] | null {
  const [bn, bf] = sphereHits(h, mu, base, R)
  const [tn, tf] = sphereHits(h, mu, top, R)
  if (h < base) {
    // inside both spheres: one root behind, one ahead for each
    return [bf, tf]
  }
  const hitsBase = bn >= 0 // going down into the base sphere from outside (NaN: misses it)
  if (h <= top) {
    const exit = hitsBase ? bn : tf
    return exit > 0 ? [0, exit] : null
  }
  if (!(tn > 0)) return null // passes over the deck
  return [tn, hitsBase ? bn : tf]
}

// altitude of a point p (camera-relative, meters) for a camera at altitude h: the sphere through p, second order
// in the horizontal distance (centimeters off at 100 km)
export function altitudeAt(h: number, px: number, py: number, pz: number, R = EARTH_R_M): number {
  const r = R + h + py
  return h + py + (px * px + pz * pz) / (2 * r)
}

// henyey-greenstein phase function, normalized over the sphere; cosTheta between the light's travel and the view
// (1 = looking into the light)
export function henyeyGreenstein(cosTheta: number, g: number): number {
  const g2 = g * g
  return (1 - g2) / (4 * Math.PI * Math.pow(1 + g2 - 2 * g * cosTheta, 1.5))
}

// remap x from [lo, hi] to [nlo, nhi], not clamped (the noise shaping of the density)
export function remap(x: number, lo: number, hi: number, nlo: number, nhi: number): number {
  return nlo + ((x - lo) * (nhi - nlo)) / (hi - lo)
}

// sample distances of the march: even steps in log(t + c) from t0 to t1, so near samples crowd the camera and far
// ones spread out like the pixels they cover. sample i (0..n-1) with jitter j in 0..1
export function marchDistance(t0: number, t1: number, n: number, i: number, j: number, c: number): number {
  const s0 = Math.log(t0 + c)
  const ds = (Math.log(t1 + c) - s0) / n
  return Math.exp(s0 + (i + j) * ds) - c
}

// beer-lambert transmittance with the powder darkening of the cloud's sunlit edges
export function beerPowder(tau: number, powderTau: number): number {
  return Math.exp(-tau) * (1 - Math.exp(-2 * powderTau))
}
