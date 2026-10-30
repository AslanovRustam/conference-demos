import { useFrame, useThree } from '@react-three/fiber'
import { useEffect, useMemo } from 'react'
import { AdditiveBlending, BufferAttribute, BufferGeometry, Color, DoubleSide, Mesh, Points, ShaderMaterial, SphereGeometry, Vector3 } from 'three'
import { createRng } from '../../core/rng'
import { horizonDip } from '../env/atmosphere'
import { dirFromAzEl } from '../env/lightState'
import { QUALITY } from '../quality'
import { rig } from '../rig'
import { FAR_SKY_R } from './FarField'
import { airAt, cameraAltitudeM, milkyWayAt, starLimitAt } from './skyCurves'

// the starfield: QUALITY.starCount stars with a real magnitude distribution (each magnitude ~3x more stars than the
// one before) and blackbody tints, crowding towards the galactic plane; the milky way as a faint band of star clouds
// cut by a dust rift. on the pad only the brightest pierce the twilight, the full field comes out in the stratosphere.
// stars sink below the dipping horizon, dim and twinkle through the air near it

const STAR_R = FAR_SKY_R * 0.97
const BAND_R = FAR_SKY_R * 0.98
const STAR_GAIN = 2.2
const BAND_GAIN = 0.05
const WHITE = new Color(1, 1, 1)

// the galactic plane runs diagonally through the broadcast camera's sky (behind the rocket), its bright core low on
// the left of it
const BAND_A = dirFromAzEl(3.55, 0.5)
const BAND_B = dirFromAzEl(4.75, -0.15)
const GALACTIC_POLE = new Vector3().crossVectors(BAND_A, BAND_B).normalize()
const GALACTIC_CENTER = BAND_B.clone().lerp(BAND_A, 0.25).projectOnPlane(GALACTIC_POLE).normalize()

const starVertex = /* glsl */ `
attribute float aMag;
attribute float aSeed;
attribute vec3 color;
uniform float uLimit; // faintest magnitude drawn
uniform float uHorizon;
uniform float uAir;
uniform float uTime;
uniform float uDpr;
uniform float uGain;
varying vec3 vColor;

void main() {
  vec3 d = normalize(position);
  float el = asin(clamp(d.y, -1.0, 1.0));
  float above = smoothstep(uHorizon - 0.001, uHorizon + 0.004 + 0.04 * uAir, el);
  // extinction grows with the air mass towards the horizon
  float airmass = 1.0 / (sin(max(el - uHorizon, 0.0)) + 0.04);
  float ext = exp(-0.12 * uAir * airmass);
  float shown = smoothstep(uLimit + 0.5, uLimit - 0.5, aMag);
  // a compressed flux scale: 10^(-0.4 m) would leave the faint field invisible next to the bright stars
  float flux = pow(10.0, -0.24 * aMag);
  float twinkle = 1.0 + uAir * 0.5 * sin(uTime * (5.0 + 7.0 * fract(aSeed * 7.31)) + aSeed * 6.2832);
  vec3 c = color * flux * shown * above * ext * twinkle * uGain;
  vColor = c;
  gl_PointSize = (c.r + c.g + c.b > 0.0) ? (2.0 + 3.5 * sqrt(flux)) * uDpr : 0.0;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}
`

const starFragment = /* glsl */ `
varying vec3 vColor;
void main() {
  vec2 c = gl_PointCoord * 2.0 - 1.0;
  float r2 = dot(c, c);
  if (r2 > 1.0) discard;
  float a = exp(-r2 * 7.0) + 0.05 * exp(-r2 * 2.0);
  gl_FragColor = vec4(vColor * a, 1.0);
}
`

const bandVertex = /* glsl */ `
varying vec3 vDir;
void main() {
  vDir = position;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}
`

const bandFragment = /* glsl */ `
uniform vec3 uPole;
uniform vec3 uCenter;
uniform float uGain;
uniform float uHorizon;
uniform float uAir;
varying vec3 vDir;

float hash(vec3 p) {
  p = fract(p * 0.3183099 + 0.1);
  p *= 17.0;
  return fract(p.x * p.y * p.z * (p.x + p.y + p.z));
}

float noise(vec3 x) {
  vec3 i = floor(x);
  vec3 f = fract(x);
  f = f * f * (3.0 - 2.0 * f);
  return mix(
    mix(mix(hash(i), hash(i + vec3(1, 0, 0)), f.x), mix(hash(i + vec3(0, 1, 0)), hash(i + vec3(1, 1, 0)), f.x), f.y),
    mix(mix(hash(i + vec3(0, 0, 1)), hash(i + vec3(1, 0, 1)), f.x), mix(hash(i + vec3(0, 1, 1)), hash(i + vec3(1, 1, 1)), f.x), f.y),
    f.z);
}

float fbm(vec3 p) {
  float v = 0.0;
  float a = 0.5;
  for (int i = 0; i < 5; i++) {
    v += a * noise(p);
    p = p * 2.03 + 17.1;
    a *= 0.5;
  }
  return v / 0.96875;
}

void main() {
  vec3 d = normalize(vDir);
  float lat = asin(clamp(dot(d, uPole), -1.0, 1.0));
  vec3 side = cross(uPole, uCenter);
  float lon = atan(dot(d, side), dot(d, uCenter));
  float core = exp(-lon * lon / 0.3);
  float width = 0.06 + 0.12 * core;
  float band = exp(-lat * lat / (width * width));
  if (band < 0.004) {
    gl_FragColor = vec4(0.0, 0.0, 0.0, 1.0);
    return;
  }
  // star clouds at two scales, a dust rift along the plane that wanders and breaks up
  float clouds = fbm(d * 5.0);
  float grain = fbm(d * 24.0 + 3.1);
  float riftLat = 0.01 + 0.03 * (fbm(d * 3.0 + 9.0) - 0.5);
  float rift = exp(-pow((lat - riftLat) / (0.018 + 0.03 * core), 2.0)) * smoothstep(0.3, 0.7, fbm(d * 8.0 + 5.0));
  float lanes = smoothstep(0.45, 0.75, fbm(d * 14.0 + 1.7)) * band;
  float i = band * (0.25 + 0.75 * clouds * clouds * 1.6) * (0.6 + 0.8 * grain) * (1.0 - 0.8 * rift) * (1.0 - 0.45 * lanes) * (0.5 + 1.6 * core);
  vec3 col = mix(vec3(0.66, 0.75, 1.0), vec3(1.0, 0.84, 0.64), core * 0.8 + 0.2 * clouds);
  float el = asin(clamp(d.y, -1.0, 1.0));
  float above = smoothstep(uHorizon, uHorizon + 0.01 + 0.1 * uAir, el);
  gl_FragColor = vec4(col * i * above * uGain, 1.0);
}
`

// rough blackbody tint for a temperature, linear rgb with the brightest channel at 1, eased towards white
// (to the eye stars are only faintly colored)
function starTint(kelvin: number, out: Color): Color {
  const t = kelvin / 100
  const r = t <= 66 ? 255 : 329.7 * Math.pow(t - 60, -0.1332)
  const g = t <= 66 ? 99.47 * Math.log(t) - 161.1 : 288.1 * Math.pow(t - 60, -0.0755)
  const b = t >= 66 ? 255 : t <= 19 ? 0 : 138.5 * Math.log(t - 10) - 305
  out.setRGB(Math.min(255, Math.max(0, r)) / 255, Math.min(255, Math.max(0, g)) / 255, Math.min(255, Math.max(0, b)) / 255, 'srgb')
  const m = Math.max(out.r, out.g, out.b)
  out.multiplyScalar(1 / m)
  return out.lerp(WHITE, 0.35)
}

// spectral classes of naked-eye stars: [share, coolest K, hottest K]
const CLASSES: [number, number, number][] = [
  [0.12, 3000, 3800],
  [0.3, 3800, 5200],
  [0.25, 5200, 6500],
  [0.23, 6500, 10000],
  [0.1, 10000, 25000],
]

function buildStars(count: number): BufferGeometry {
  const rng = createRng(0x57a25)
  const pos = new Float32Array(count * 3)
  const col = new Float32Array(count * 3)
  const mag = new Float32Array(count)
  const seed = new Float32Array(count)
  const d = new Vector3()
  const c = new Color()
  const side = new Vector3().crossVectors(GALACTIC_POLE, GALACTIC_CENTER)
  for (let i = 0; i < count; i++) {
    // magnitude: N(<m) ~ 15 * 10^(0.49 (m - 1)) over the whole sky
    const n = (i + rng()) / count
    mag[i] = Math.max(-1.4, 1 + Math.log10(Math.max(n * count, 0.05) / 15) / 0.49)
    // direction: uniform, or (40%) close to the galactic plane
    if (rng() < 0.4) {
      const lon = rng() * Math.PI * 2
      const g = Math.sqrt(-2 * Math.log(Math.max(rng(), 1e-9))) * Math.cos(2 * Math.PI * rng())
      const lat = g * 0.22
      d.copy(GALACTIC_CENTER)
        .multiplyScalar(Math.cos(lon) * Math.cos(lat))
        .addScaledVector(side, Math.sin(lon) * Math.cos(lat))
        .addScaledVector(GALACTIC_POLE, Math.sin(lat))
    } else {
      const z = rng() * 2 - 1
      const a = rng() * Math.PI * 2
      const s = Math.sqrt(1 - z * z)
      d.set(s * Math.cos(a), z, s * Math.sin(a))
    }
    d.normalize().multiplyScalar(STAR_R)
    pos.set([d.x, d.y, d.z], i * 3)
    let pick = rng()
    let k = 0
    while (k < CLASSES.length - 1 && pick > CLASSES[k][0]) pick -= CLASSES[k++][0]
    const [, lo, hi] = CLASSES[k]
    starTint(lo + (hi - lo) * rng(), c)
    col.set([c.r, c.g, c.b], i * 3)
    seed[i] = rng()
  }
  const geo = new BufferGeometry()
  geo.setAttribute('position', new BufferAttribute(pos, 3))
  geo.setAttribute('color', new BufferAttribute(col, 3))
  geo.setAttribute('aMag', new BufferAttribute(mag, 1))
  geo.setAttribute('aSeed', new BufferAttribute(seed, 1))
  return geo
}

export function Stars() {
  const dpr = useThree((s) => s.viewport.dpr)
  const built = useMemo(() => {
    const starMat = new ShaderMaterial({
      vertexShader: starVertex,
      fragmentShader: starFragment,
      uniforms: {
        uLimit: { value: 0 },
        uHorizon: { value: 0 },
        uAir: { value: 1 },
        uTime: { value: 0 },
        uDpr: { value: 1 },
        uGain: { value: STAR_GAIN },
      },
      transparent: false, // opaque list: drawn by renderOrder before the near field (blending still adds)
      blending: AdditiveBlending,
      depthTest: false,
      depthWrite: false,
    })
    const stars = new Points(buildStars(QUALITY.starCount), starMat)
    stars.name = 'stars'
    stars.renderOrder = -90
    stars.frustumCulled = false
    const bandMat = new ShaderMaterial({
      vertexShader: bandVertex,
      fragmentShader: bandFragment,
      uniforms: {
        uPole: { value: GALACTIC_POLE },
        uCenter: { value: GALACTIC_CENTER },
        uGain: { value: 0 },
        uHorizon: { value: 0 },
        uAir: { value: 1 },
      },
      side: DoubleSide,
      transparent: false, // opaque list: drawn by renderOrder before the near field (blending still adds)
      blending: AdditiveBlending,
      depthTest: false,
      depthWrite: false,
    })
    const band = new Mesh(new SphereGeometry(BAND_R, 96, 48), bandMat)
    band.name = 'milky-way'
    band.renderOrder = -90
    band.frustumCulled = false
    return { stars, band }
  }, [])
  useEffect(
    () => () => {
      for (const o of [built.stars, built.band]) {
        o.geometry.dispose()
        o.material.dispose()
      }
    },
    [built],
  )

  useFrame(({ camera }) => {
    const altM = cameraAltitudeM(camera.position.y, rig.nearOffset)
    const horizon = -horizonDip(altM)
    const air = airAt(altM)
    const su = built.stars.material.uniforms
    su.uLimit.value = starLimitAt(rig.stageF)
    su.uHorizon.value = horizon
    su.uAir.value = air
    su.uTime.value = rig.vtime
    su.uDpr.value = dpr
    const band = milkyWayAt(rig.stageF)
    built.band.visible = band > 0
    const bu = built.band.material.uniforms
    bu.uGain.value = BAND_GAIN * band
    bu.uHorizon.value = horizon
    bu.uAir.value = air
  })

  return (
    <>
      <primitive object={built.band} />
      <primitive object={built.stars} />
    </>
  )
}
