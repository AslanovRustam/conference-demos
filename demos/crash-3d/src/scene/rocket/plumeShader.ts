import {
  AddEquation,
  CustomBlending,
  CylinderGeometry,
  DataTexture,
  DoubleSide,
  LinearFilter,
  OneFactor,
  RepeatWrapping,
  RGFormat,
  ShaderMaterial,
  Uniform,
  UnsignedByteType,
  Vector2,
  Vector3,
  ZeroFactor,
  type BufferGeometry,
} from 'three'
import { createRng } from '../../core/rng'
import { QUALITY } from '../quality'

// engine exhaust as an emissive volume: a raymarched cone drawn additively into the hdr buffer.
// plume space is the mesh's local space in meters: origin at the center of the nozzle exit plane, exhaust along -y.
// two layers: the jet (white-hot core, shock diamonds, blue-violet mixing layer; short, no noise) and the body
// (the long turbulent orange flame). a single motor draws both in one cone; an engine cluster draws a jet cone per
// nozzle and one body cone for the merged flame of all of them, which keeps the costly noise to one volume.
// altitude is not read here: callers pass `expand` (0 dense at the pad, 1 vacuum), so the capsule's small motors
// (task 13) reuse the material with their own scale and state

export const PLUME_REF_R = 0.75 // nozzle exit radius at scale 1, m

const LEN_SEA = 36 // visible length at full thrust and scale 1, m
const LEN_VAC = 60
const JET_LEN_SEA = 16 // the jet layer fades out by this many exit radii
const JET_LEN_VAC = 7
const BOUND_BODY = 1.9 // the bounding cone holds the flame out to this many flame radii
const BOUND_JET = 1.7

const NOISE_SIZE = 256
const EDDY = 4 // turbulence cell size at sea level, exit radii
const OCTAVE = 2.31 // frequency of the second noise octave
const FLOW_RATE = 10 // turbulence speed down the plume, noise cells per second; x0.45 at sea level, x0.05 in vacuum
const RIPPLE_RATE = 31 // mixing-layer ripple phase speed, radians per second
const MAX_STEP_S = 0.1 // a longer gap (hidden tab, first frame) does not fast-forward the flow
// the noise texture's second channel is the first one moved by this many texels: the next z slice
const NOISE_SLICE: [number, number] = [37, 17]

const clamp01 = (x: number) => Math.min(1, Math.max(0, x))
const lerp = (a: number, b: number, t: number) => a + (b - a) * t
const smoothstep = (e0: number, e1: number, x: number) => {
  const t = clamp01((x - e0) / (e1 - e0))
  return t * t * (3 - 2 * t)
}

export type PlumeLayers = 'all' | 'jet' | 'body'

// the merged flame of a ring of nozzles: `count` motors, their axes `spread` meters off the center
export interface PlumeCluster {
  spread: number
  count: number
}

export interface PlumeShape {
  r0: number // nozzle exit radius, m
  length: number // of this cone, m
  jet: [number, number, number] // jet radius at depth d below the exit: jet[0] + jet[1] * d + jet[2] * d^2, m
  bodyOffset: number // the body's radius is the jet radius plus this, m
  bound: [number, number] // bounding cone radius: bound[0] + bound[1] * d, m
}

// size of the flame: longer with thrust, much wider in vacuum where the exhaust expands freely.
// at sea level the jet first necks in a little (over-expanded nozzle), then mixing widens it downstream
export function plumeShape(scale: number, thrust: number, expand: number, layers: PlumeLayers = 'all', cluster?: PlumeCluster): PlumeShape {
  const e = clamp01(expand)
  const r0 = PLUME_REF_R * scale
  const full = scale * lerp(LEN_SEA, LEN_VAC, e) * (0.3 + 0.7 * clamp01(thrust))
  const length = layers === 'jet' ? Math.min(full, r0 * lerp(JET_LEN_SEA, JET_LEN_VAC, e)) : full
  // in exit radii: r0 * (j0 + j1 * u + j2 * u^2), u = d / r0
  const j0 = lerp(0.92, 1, e)
  const j1 = lerp(0.05, 0.4, e)
  const j2 = lerp(0.0012, 0, e)
  const jet: [number, number, number] = [r0 * j0, j1, j2 / r0]
  const bodyOffset = layers === 'jet' ? 0 : (cluster?.spread ?? 0)
  const k = layers === 'jet' ? BOUND_JET : BOUND_BODY
  // the radius is convex in d, so the chord between both ends of the cone contains it
  const b0 = k * (jet[0] + bodyOffset)
  const b1 = (k * (jet[0] + (jet[1] + jet[2] * length) * length + bodyOffset) - b0) / length
  return { r0, length, jet, bodyOffset, bound: [b0, b1] }
}

// how far the plume has opened up at a flight stage: dense below the clouds, a vacuum plume by 40 km (stage 3)
export function plumeExpansion(stageF: number): number {
  return smoothstep(1.4, 3.2, stageF)
}

const hash1 = (n: number) => {
  const s = Math.sin(n * 127.1 + 311.7) * 43758.5453
  return s - Math.floor(s)
}

function valueNoise1(x: number, seed: number): number {
  const i = Math.floor(x)
  const f = x - i
  const u = f * f * (3 - 2 * f)
  return lerp(hash1(i + seed * 101.3), hash1(i + 1 + seed * 101.3), u)
}

// smooth 0..1 flicker of a flame over time; different seeds flicker independently
export function flicker(t: number, seed = 0): number {
  return 0.62 * valueNoise1(t * 9, seed) + 0.38 * valueNoise1(t * 23 + 3.1, seed + 0.5)
}

// white noise for 3d value noise from one 2d fetch: red holds a random lattice, green the same lattice
// NOISE_SLICE texels further on, so (red, green) at one spot are two neighbouring z slices
export function bakeNoise(size = NOISE_SIZE, seed = 0x51ab): Uint8Array {
  const rng = createRng(seed)
  const red = Uint8Array.from({ length: size * size }, () => Math.floor(rng() * 256))
  const out = new Uint8Array(size * size * 2)
  const [ox, oy] = NOISE_SLICE
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const i = y * size + x
      out[i * 2] = red[i]
      out[i * 2 + 1] = red[((y + oy) % size) * size + ((x + ox) % size)]
    }
  }
  return out
}

// one noise texture shared by every plume material, freed with the last of them
let noiseTex: DataTexture | null = null
let noiseUsers = 0

function acquireNoise(): DataTexture {
  noiseUsers++
  if (!noiseTex) {
    const tex = new DataTexture(bakeNoise(), NOISE_SIZE, NOISE_SIZE, RGFormat, UnsignedByteType)
    tex.minFilter = LinearFilter
    tex.magFilter = LinearFilter
    tex.wrapS = RepeatWrapping
    tex.wrapT = RepeatWrapping
    tex.generateMipmaps = false
    tex.unpackAlignment = 1
    tex.needsUpdate = true
    noiseTex = tex
  }
  return noiseTex
}

function releaseNoise(): void {
  if (--noiseUsers > 0 || !noiseTex) return
  noiseTex.dispose()
  noiseTex = null
}

// a unit cone side with caps, y from 0 down to -1; the vertex shader stretches it over the bounding cone.
// the cone is straight, so one ring of sides is exact
export function plumeGeometry(): BufferGeometry {
  return new CylinderGeometry(1, 1, 1, QUALITY.plumeSegments, 1, false).translate(0, -0.5, 0)
}

const vertexShader = /* glsl */ `
uniform float uLength;
uniform vec2 uBound;
varying vec3 vPos;
varying vec3 vCam;

void main() {
  // 1.02 lets the flat polygon sides cover the round bounding cone
  float d = -position.y * uLength;
  float b = (uBound.x + uBound.y * d) * 1.02;
  vec3 p = vec3(position.x * b, position.y * uLength, position.z * b);
  vPos = p;
  vCam = (inverse(modelMatrix) * vec4(cameraPosition, 1.0)).xyz;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(p, 1.0);
}
`

const fragmentShader = /* glsl */ `
uniform sampler2D uNoise;
uniform float uR0;
uniform float uLength;
uniform vec3 uJet;
uniform float uBodyOffset;
uniform float uBodyGain;
uniform vec2 uBound;
uniform float uThrust;
uniform float uExpand;
uniform vec2 uFlow; // turbulence offset down the plume per noise octave, noise units
uniform float uRipple; // phase of the mixing-layer ripples
uniform float uIntensity;
uniform vec3 uSeed;
varying vec3 vPos;
varying vec3 vCam;

// emission per meter of the layers at full thrust (hdr, the bloom threshold is 1)
#define CORE_I 9.0
#define DIAMOND_I 10.0
#define EDGE_I 1.8
#define BODY_I 1.7
#define VACUUM_GAIN 0.6
// shock cell length in exit radii
#define DIAMOND_CELL 2.4

// ray interval inside the bounding cone, radius uBound.x + uBound.y * d at depth d = -y, between y = 0 and -uLength
vec2 bounds(vec3 ro, vec3 rd) {
  float t0 = -1e9;
  float t1 = 1e9;
  if (abs(rd.y) > 1e-6) {
    float ta = -ro.y / rd.y;
    float tb = (-uLength - ro.y) / rd.y;
    t0 = min(ta, tb);
    t1 = max(ta, tb);
  } else if (ro.y > 0.0 || ro.y < -uLength) {
    return vec2(1.0, 0.0);
  }
  // x^2 + z^2 = (c0 + c1 t)^2; the slab lies below the apex, so only the lower nappe counts and the
  // inside is one interval
  float c0 = uBound.x - uBound.y * ro.y;
  float c1 = -uBound.y * rd.y;
  float a = dot(rd.xz, rd.xz) - c1 * c1;
  float b = 2.0 * (dot(ro.xz, rd.xz) - c0 * c1);
  float c = dot(ro.xz, ro.xz) - c0 * c0;
  float disc = b * b - 4.0 * a * c;
  if (abs(a) < 1e-7) {
    if (abs(b) < 1e-9) {
      if (c > 0.0) return vec2(1.0, 0.0);
    } else {
      float t = -c / b;
      if (b > 0.0) t1 = min(t1, t); else t0 = max(t0, t);
    }
  } else if (a > 0.0) {
    if (disc < 0.0) return vec2(1.0, 0.0);
    float sq = sqrt(disc);
    t0 = max(t0, (-b - sq) / (2.0 * a));
    t1 = min(t1, (-b + sq) / (2.0 * a));
  } else if (disc >= 0.0) {
    // a < 0: inside before the first root or after the second
    float sq = sqrt(disc);
    float ra = (-b + sq) / (2.0 * a);
    float rb = (-b - sq) / (2.0 * a);
    if (t0 < min(t1, ra)) t1 = min(t1, ra); else t0 = max(t0, rb);
  }
  return vec2(t0, t1);
}

#ifdef BODY
// 3d value noise from one fetch: bilinear filtering blends x and y, red and green are two z slices
float noise3(vec3 x) {
  vec3 p = floor(x);
  vec3 f = fract(x);
  f = f * f * (3.0 - 2.0 * f);
  vec2 uv = p.xy + NOISE_SLICE * p.z + f.xy;
  vec2 rg = textureLod(uNoise, (uv + 0.5) / NOISE_SIZE, 0.0).rg;
  return mix(rg.x, rg.y, f.z);
}
#endif

vec3 emission(vec3 p) {
  float d = -p.y;
  float r = length(p.xz);
  float s = d / uLength;
  float rj = uJet.x + (uJet.y + uJet.z * d) * d;
  float win = 1.0 - smoothstep(0.8, 1.0, r / (uBound.x + uBound.y * d));
  vec3 col = vec3(0.0);

#ifdef JET
  float sea = 1.0 - uExpand;
  float hot = uThrust * uThrust; // the core and diamonds need full chamber pressure
  float fade = 1.0 - smoothstep(0.65, 1.0, s); // a jet cone ends softly
  float k = r / rj;
  // white-hot core from the exit to the first mach disk; it keeps its width even where the vacuum jet fans out
  float kc = r / (uR0 * 0.92 + 0.08 * d);
  float core = exp(-4.0 * kc * kc - d / (uR0 * mix(2.0, 2.6, uExpand)));
  // shock diamonds: the jet boundary pinches into a chain of bright lozenges with crisp sides, fading
  // downstream; sea level only. the exit plane is the widest point of the first, half cell
  float cell = uR0 * DIAMOND_CELL;
  float tri = 1.0 - abs(2.0 * fract(d / cell + 0.5) - 1.0);
  float dk = r / (0.45 * rj * tri + 0.03 * uR0);
  dk *= dk;
  float diamond = exp(-dk * dk - d / (cell * 2.4)) * smoothstep(0.0, 0.6, tri) * sea * sea;
  // blue-violet mixing layer on the jet boundary, rippling
  float e = (k - 1.0) / 0.3;
  float ripple = 0.8 + 0.2 * sin(d / uR0 * 2.1 - uRipple + uSeed.x * 6.28);
  float edge = exp(-e * e - d / (uR0 * mix(6.0, 3.0, uExpand))) * ripple * min(uR0 * uR0 / (rj * rj), 1.0)
    * mix(1.0, 0.25, uExpand);
  col += fade * ((core * hot * CORE_I) * vec3(1.0, 0.93, 0.82)
    + (diamond * hot * DIAMOND_I) * vec3(1.0, 0.8, 0.58)
    + (edge * uThrust * EDGE_I) * vec3(0.42, 0.32, 1.0));
#endif

#ifdef BODY
  // the merged flame is the jet radius plus the spread of the cluster
  float rb = rj + uBodyOffset;
  float rough = smoothstep(0.03, 0.3, s);
  // turbulence: value-noise fbm streaming down the plume. at sea level round eddies stretched along the flow;
  // in vacuum streaks along the streamlines, which fan out from the nozzle (across: r / rb holds along one).
  // the noise repeats every NOISE_SIZE along y, so the wrapped flow offsets never show a seam
  float eddy = uR0 * EDDY;
  vec3 q = mix(vec3(p.x / eddy, d * 0.45 / eddy, p.z / eddy), vec3(p.x / rb * 4.0, d * 0.05 / eddy, p.z / rb * 4.0), uExpand)
    + uSeed * 40.0;
  float n = noise3(q - vec3(0.0, uFlow.x, 0.0)) * 0.62
    + noise3(q * OCTAVE + 0.37 - vec3(0.0, uFlow.y, 0.0)) * 0.38;
  n = smoothstep(0.22, 0.78, n); // value-noise fbm bunches around 0.5: stretch it for contrast
  float rbn = rb * (1.0 + mix(0.7, 0.25, uExpand) * (n - 0.5) * rough);
  float kn = r / rbn;
  // thinner as it widens: the exit area of every merged motor spread over the flame
  float area = uBodyGain * uR0 * uR0 / (rbn * rbn);
  // dense and round at sea level; in vacuum a faint bell with a brighter rim
  float rim = (kn - 0.95) / 0.22;
  float shape = mix(exp(-2.2 * kn * kn), 0.3 * exp(-1.6 * kn * kn) + exp(-rim * rim), uExpand);
  float body = shape * area
    // at sea level the afterburning starts a few radii down, in vacuum right at the exit
    * smoothstep(0.0, 1.0, d / (uR0 * mix(8.0, 0.6, uExpand)))
    * (1.0 - smoothstep(0.4, 1.0, s))
    * mix(1.0, 0.15 + 1.7 * n, rough)
    * mix(1.0, VACUUM_GAIN, uExpand);
  vec3 bodyCol = mix(
    mix(vec3(1.0, 0.55, 0.18), vec3(1.0, 0.24, 0.05), smoothstep(0.05, 0.6, s)),
    mix(vec3(1.0, 0.5, 0.2), vec3(0.45, 0.3, 1.0), smoothstep(0.02, 0.45, s)),
    uExpand);
  col += (body * uThrust * BODY_I) * bodyCol;
#endif

  return col * win;
}

void main() {
  vec3 ro = vCam;
  vec3 rd = normalize(vPos - vCam);
  vec2 seg = bounds(ro, rd);
  // from outside the front faces draw the volume, from inside only back faces face the camera
  bool inside = seg.x <= 0.0;
  if (gl_FrontFacing == inside) discard;
  seg.x = max(seg.x, 0.0);
  if (seg.y <= seg.x) discard;

  float dt = (seg.y - seg.x) / float(STEPS);
  // interleaved gradient noise: a stable per-pixel offset turns step banding into fine grain
  float jitter = fract(52.9829189 * fract(dot(gl_FragCoord.xy, vec2(0.06711056, 0.00583715))));
  vec3 sum = vec3(0.0);
  for (int i = 0; i < STEPS; i++) {
    sum += emission(ro + rd * (seg.x + (float(i) + jitter) * dt));
  }
  gl_FragColor = vec4(sum * dt * uIntensity, 1.0);
}
`

export interface PlumeUniforms {
  uNoise: Uniform<DataTexture>
  uR0: Uniform<number>
  uLength: Uniform<number>
  uJet: Uniform<Vector3>
  uBodyOffset: Uniform<number>
  uBodyGain: Uniform<number>
  uBound: Uniform<Vector2>
  uThrust: Uniform<number>
  uExpand: Uniform<number>
  uFlow: Uniform<Vector2>
  uRipple: Uniform<number>
  uIntensity: Uniform<number>
  uSeed: Uniform<Vector3>
}

export interface PlumeOptions {
  scale: number // 1 fits a 0.75 m nozzle exit radius
  layers?: PlumeLayers // default 'all'
  cluster?: PlumeCluster // body layer only: the merged flame of a ring of nozzles
  seed?: number // varies the turbulence and ripples between nozzles
}

interface PlumeConfig {
  scale: number
  layers: PlumeLayers
  cluster?: PlumeCluster
  time: number | null // of the last setPlume, for the phases advanced there
}

export type PlumeMaterial = ShaderMaterial & { uniforms: PlumeUniforms; userData: { plume: PlumeConfig } }

// additive hdr flame; update it every frame with setPlume
export function plumeMaterial(opts: PlumeOptions): PlumeMaterial {
  const layers = opts.layers ?? 'all'
  const rng = createRng(0x9e37 + (opts.seed ?? 0))
  const uniforms: PlumeUniforms = {
    uNoise: new Uniform(acquireNoise()),
    uR0: new Uniform(0),
    uLength: new Uniform(1),
    uJet: new Uniform(new Vector3()),
    uBodyOffset: new Uniform(0),
    uBodyGain: new Uniform(opts.cluster?.count ?? 1),
    uBound: new Uniform(new Vector2()),
    uThrust: new Uniform(0),
    uExpand: new Uniform(0),
    uFlow: new Uniform(new Vector2()),
    uRipple: new Uniform(0),
    uIntensity: new Uniform(1),
    uSeed: new Uniform(new Vector3(rng(), rng(), rng())),
  }
  const defines: Record<string, string | number> = {
    STEPS: layers === 'jet' ? QUALITY.plumeJetSteps : QUALITY.plumeSteps,
    NOISE_SIZE: NOISE_SIZE.toFixed(1),
    NOISE_SLICE: `vec2(${NOISE_SLICE[0].toFixed(1)}, ${NOISE_SLICE[1].toFixed(1)})`,
    EDDY: EDDY.toFixed(1),
    OCTAVE: OCTAVE.toFixed(2),
  }
  if (layers !== 'body') defines.JET = 1
  if (layers !== 'jet') defines.BODY = 1
  const mat = new ShaderMaterial({
    uniforms: uniforms as unknown as ShaderMaterial['uniforms'],
    vertexShader,
    fragmentShader,
    defines,
    transparent: true,
    depthWrite: false,
    side: DoubleSide,
    // pure additive light: color adds up, the target's alpha stays
    blending: CustomBlending,
    blendEquation: AddEquation,
    blendSrc: OneFactor,
    blendDst: OneFactor,
    blendSrcAlpha: ZeroFactor,
    blendDstAlpha: OneFactor,
    toneMapped: false,
  }) as PlumeMaterial
  mat.userData.plume = { scale: opts.scale, layers, cluster: opts.cluster, time: null } satisfies PlumeConfig
  let released = false
  mat.addEventListener('dispose', () => {
    if (released) return
    released = true
    releaseNoise()
  })
  setPlume(mat, { thrust: 0, expand: 0, time: 0 })
  mat.userData.plume.time = null
  return mat
}

export interface PlumeState {
  thrust: number // 0..1
  expand: number // 0 sea level .. 1 vacuum, see plumeExpansion
  time: number // s, drives the turbulence; only its steps count, so any clock works
  intensity?: number // overall gain, e.g. flicker; 1 by default
}

export function setPlume(mat: PlumeMaterial, s: PlumeState): void {
  const u = mat.uniforms
  const cfg = mat.userData.plume
  const shape = plumeShape(cfg.scale, s.thrust, s.expand, cfg.layers, cfg.cluster)
  // the phases advance here in doubles and wrap at their periods: the turbulence slows down while the plume
  // opens up, and a speed change must not jump the pattern (time * speed would), nor may hours of uptime cost
  // the shader its precision
  const dt = cfg.time === null ? 0 : Math.min(MAX_STEP_S, Math.max(0, s.time - cfg.time))
  cfg.time = s.time
  const speed = FLOW_RATE * lerp(0.45, 0.05, clamp01(s.expand))
  const flow = u.uFlow.value
  flow.set((flow.x + dt * speed) % NOISE_SIZE, (flow.y + dt * speed * OCTAVE) % NOISE_SIZE)
  u.uRipple.value = (u.uRipple.value + dt * RIPPLE_RATE) % (Math.PI * 2)
  u.uR0.value = shape.r0
  u.uLength.value = shape.length
  u.uJet.value.set(...shape.jet)
  u.uBodyOffset.value = shape.bodyOffset
  u.uBound.value.set(...shape.bound)
  u.uThrust.value = clamp01(s.thrust)
  u.uExpand.value = clamp01(s.expand)
  u.uIntensity.value = s.intensity ?? 1
}
