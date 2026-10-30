import { CLOUD_BASE_M, CLOUD_TOP_M } from '../rig'
import { EARTH_R_M } from './cloudMath'

// the volumetric cloud deck: a raymarch at reduced resolution (march*), then a depth-aware upsample and composite
// in the post chain (composite*). glsl mirrors of cloudMath.ts: sphereHits, slab, altitudeOf, hg, remap

const f = (x: number) => x.toFixed(6)

// world scale of the noise (the textures repeat this often), meters
export const SHAPE_TILE_M = 9000
export const DETAIL_TILE_M = 900
export const WEATHER_TILE_M = 64000
export const MAX_MARCH_M = 40000 // the march stops this far past where it enters the deck
export const UNDER_LIGHTS = 4 // the flame, the pad's glow, two searchlights

export interface MarchDefines {
  steps: number
  lightSteps: number
  underSteps: number
  noiseSize: number
  weatherSize: number
}

export function marchDefines(d: MarchDefines): Record<string, string | number> {
  return {
    STEPS: d.steps,
    LIGHT_STEPS: d.lightSteps,
    UNDER_STEPS: d.underSteps,
    UNDER_LIGHTS,
    BASE: f(CLOUD_BASE_M),
    TOP: f(CLOUD_TOP_M),
    EARTH_R: f(EARTH_R_M),
    SHAPE_TILE: f(SHAPE_TILE_M),
    DETAIL_TILE: f(DETAIL_TILE_M),
    WEATHER_TILE: f(WEATHER_TILE_M),
    SHAPE_VOXEL: f(SHAPE_TILE_M / d.noiseSize),
    DETAIL_VOXEL: f(DETAIL_TILE_M / d.noiseSize),
    WEATHER_TEXEL: f(WEATHER_TILE_M / d.weatherSize),
    MAX_MARCH: f(MAX_MARCH_M),
  }
}

export const marchVertex = /* glsl */ `
out vec2 vUv;
void main() {
  vUv = position.xy * 0.5 + 0.5;
  gl_Position = vec4(position.xy, 0.0, 1.0);
}
`

export const marchFragment = /* glsl */ `
precision highp float;
precision highp sampler3D;

in vec2 vUv;
layout(location = 0) out vec4 outAll; // light scattered towards the camera, transmittance: the whole ray
layout(location = 1) out vec4 outFront; // the same up to the near effects (plume, pad smoke)

#define PI 3.141592653589793
#define LOG_C 120.0 // m: the march spaces its samples evenly in log(t + LOG_C)
#define SIGMA 0.06 // extinction per meter at density 1
#define TOP_MIN 0.42 // flattest clouds reach this far up the deck
#define SHAPE_V 1.8 // the lumps are this much flatter than wide
#define DETAIL_ERODE 0.5
#define POWDER_M 70.0
#define LIGHT_STEP 30.0 // first step towards the key light, doubling after each
#define FINE_DT 80.0 // view steps shorter than this shade with the fine noise
#define THIN 0.08 // density under which a sample estimates its shadows instead of marching them
#define THIN_KEY 0.15 // the deck's average density on the way to the key light, for those
#define UNDER_REACH 520.0 // how far the shadow march towards the lights under the deck goes
#define PAD_BANK 0.75 // coverage of the bank that always sits over the pad
#define PAD_BANK_K 1.6e-7 // 1 / its radius^2 (2.5 km)
#define CLEAR_MIST 0.12 // what the column keeps of the cloud as mist...
#define CLEAR_CLUMPS 1.3 // ...and as torn clumps
#define CLEAR_K 1.6e-5 // 1 / the column radius^2 (250 m)
#define CLEAR_TOP vec2(50.0, 220.0) // over the nozzles: cleared around the whole rocket, closing over its nose

uniform sampler2D tDepth;
uniform sampler3D tShape;
uniform sampler2D tWeather;
uniform sampler2D tBlue;
uniform float uFrame; // the jitter walks the golden ratio from frame to frame: the grain changes, never repeats
uniform mat4 uProjInv;
uniform mat4 uCamWorld;
uniform float uNear;
uniform float uFar;

uniform float uCamAlt; // camera altitude over the pad (world y + nearOffset)
uniform vec2 uWeatherOff; // camera xz + drift, wrapped to each tile
uniform vec2 uShapeOff;
uniform vec3 uDetailOff;
uniform vec2 uAxis; // the launch axis (x = z = 0), camera-relative
uniform float uRocketAlt;
uniform vec2 uCover; // weather coverage mapped from x..y onto 0..1
uniform float uAirFade; // 1 / the distance over which far clouds dissolve into the sky behind them

uniform vec3 uKeyDir;
uniform vec3 uKeyCol;
uniform vec3 uAmbTop;
uniform vec3 uAmbBottom;

uniform vec3 uLightPos[UNDER_LIGHTS]; // camera-relative
uniform vec3 uLightCol[UNDER_LIGHTS]; // color * intensity (candela)
uniform vec3 uLightDir[UNDER_LIGHTS]; // spot direction
// cos of the outer and inner cone ((-2, -1): all round), softening (m^2 added to the squared distance: no hot spot
// at the lamp), phase anisotropy (0: the flat glow of light scattered many times)
uniform vec4 uLightShape[UNDER_LIGHTS];
uniform vec3 uUnderAim; // the under light the shadow march aims at
uniform float uUnderOn;

uniform vec3 uFxA; // the plume's axis, camera-relative
uniform vec3 uFxB;
uniform float uFxBelow; // 1: the camera is under the deck, every near effect is in front of every cloud

float remap(float x, float lo, float hi, float nlo, float nhi) {
  return nlo + (x - lo) * (nhi - nlo) / (hi - lo);
}

// blue noise: a per-pixel offset of the first sample turns step banding into fine, even grain
float blue(vec2 p) {
  ivec2 size = textureSize(tBlue, 0);
  return texelFetch(tBlue, ivec2(p) % size, 0).r + 0.5 / 256.0;
}

// roots of the ray against the sphere at altitude a (near, far); (-1e30, -1e30) when it misses
vec2 sphereHits(float h, float mu, float a) {
  float r = EARTH_R + h;
  float b = r * mu;
  float c = (h - a) * (2.0 * EARTH_R + h + a);
  float disc = b * b - c;
  if (disc < 0.0) return vec2(-1e30);
  float s = sqrt(disc);
  float q = b > 0.0 ? -b - s : -b + s;
  float t2 = q != 0.0 ? c / q : -b;
  return vec2(min(q, t2), max(q, t2));
}

// first stretch of the ray inside the deck (t0, t1); t1 <= t0: none
vec2 slab(float h, float mu) {
  vec2 b = sphereHits(h, mu, BASE);
  vec2 t = sphereHits(h, mu, TOP);
  if (h < BASE) return vec2(b.y, t.y);
  bool hitsBase = b.x >= 0.0;
  if (h <= TOP) return vec2(0.0, hitsBase ? b.x : t.y);
  if (t.x <= 0.0) return vec2(0.0, -1.0);
  return vec2(t.x, hitsBase ? b.x : t.y);
}

float altitudeOf(vec3 p) {
  float r = EARTH_R + uCamAlt + p.y;
  return uCamAlt + p.y + dot(p.xz, p.xz) / (2.0 * r);
}

float hg(float c, float g) {
  float g2 = g * g;
  return (1.0 - g2) / (4.0 * PI * pow(1.0 + g2 - 2.0 * g * c, 1.5));
}

// a strong forward lobe (silver linings looking into the light) and a weak back lobe; k < 1 flattens both
// for the light that has scattered many times
float phase(float c, float k) {
  return mix(hg(c, 0.8 * k), hg(c, -0.3 * k), 0.35);
}

// coverage (with the bank over the pad) and how far up the deck the cloud reaches
vec2 weatherAt(vec3 p, float lod) {
  vec2 w = textureLod(tWeather, (p.xz + uWeatherOff) / WEATHER_TILE, lod).rg;
  vec2 a = p.xz - uAxis;
  float pad = PAD_BANK * exp(-dot(a, a) * PAD_BANK_K);
  float cover = max(smoothstep(uCover.x, uCover.y, w.r), pad);
  return vec2(cover, mix(TOP_MIN, 1.0, max(w.g, pad)));
}

// the deck without its fine detail, for a weather sample w: the shape noise cut by the coverage into lumps with
// flat bottoms and rounded tops. lod in voxels of the shape noise
float baseDensity(vec3 p, float alt, vec2 w, float lod) {
  float h = (alt - BASE) / (TOP - BASE);
  if (h <= 0.0 || h >= 1.0 || w.x <= 0.0) return 0.0;
  float prof = smoothstep(0.0, 0.07, h) * (1.0 - smoothstep(w.y * 0.55, w.y, h));
  if (prof <= 0.0) return 0.0;
  vec2 s = textureLod(tShape, vec3(p.x + uShapeOff.x, alt * SHAPE_V, p.z + uShapeOff.y) / SHAPE_TILE, max(0.0, lod)).rg;
  float shape = remap(s.r, s.g - 1.0, 1.0, 0.0, 1.0) * prof;
  return max(0.0, remap(shape, 1.0 - w.x, 1.0, 0.0, 1.0) * w.x);
}

// 0..1, the column the plume punched behind the rocket: up the launch axis, closing over the rocket's nose
float columnAt(vec3 p, float alt) {
  vec2 a = p.xz - uAxis;
  return exp(-dot(a, a) * CLEAR_K) * (1.0 - smoothstep(uRocketAlt + CLEAR_TOP.x, uRocketAlt + CLEAR_TOP.y, alt));
}

// what the column leaves of the cloud: a thin mist with torn clumps and wisps (torn: 0..1 from the fine noise)
float columnKeep(float column, float torn) {
  return mix(1.0, CLEAR_MIST + CLEAR_CLUMPS * torn, smoothstep(0.15, 0.6, column));
}

// full density for a weather sample w: the base eroded by the fine noise (wispy at the bottom, billowy higher up),
// torn apart in the column
float densityW(vec3 p, float alt, vec2 w, float lod) {
  float d = baseDensity(p, alt, w, lod);
  if (d <= 0.0) return 0.0;
  float h = (alt - BASE) / (TOP - BASE);
  float lodD = lod + log2(SHAPE_VOXEL / DETAIL_VOXEL);
  vec2 n = vec2(0.5);
  if (lodD < 4.5) {
    n = textureLod(tShape, (vec3(p.x, alt, p.z) + uDetailOff) / DETAIL_TILE, max(0.0, lodD)).rg;
    float wisp = mix(n.g, 1.0 - n.g, clamp(h * 4.0, 0.0, 1.0));
    d = remap(d, wisp * DETAIL_ERODE * (1.0 - smoothstep(2.5, 4.5, lodD)), 1.0, 0.0, 1.0);
    if (d <= 0.0) return 0.0;
  }
  float column = columnAt(p, alt);
  if (column > 0.01) d *= columnKeep(column, smoothstep(0.6, 0.66, n.r * 0.6 + n.g * 0.4));
  return d;
}

// full density at a camera-relative point; w returns its weather sample for the light marches from there
float density(vec3 p, float alt, float lod, out vec2 w) {
  w = weatherAt(p, max(0.0, lod + log2(SHAPE_VOXEL / WEATHER_TEXEL)));
  return densityW(p, alt, w, lod);
}

// the same without the fine noise, for the light marches (the column at its average)
float coarseDensity(vec3 p, float alt, vec2 w, float lod) {
  float d = baseDensity(p, alt, w, lod);
  if (d <= 0.0) return 0.0;
  float column = columnAt(p, alt);
  return column > 0.01 ? d * columnKeep(column, 0.3) : d;
}

float lodFor(float step) {
  return log2(max(step, 1.0) / SHAPE_VOXEL);
}

// density integral (density * m) towards the key light, in doubling steps from about a quarter of the view step,
// until the ray leaves the deck. the weather is taken from where the march starts (the light path is short next to
// the banks); near the camera the first step sees the fine noise too, so wisps and billows shade themselves
float keyDepth(vec3 p, vec2 w, float dt) {
  float tau = 0.0;
  float s = max(LIGHT_STEP, dt * 0.25);
  float acc = 0.0;
  for (int k = 0; k < LIGHT_STEPS; k++) {
    vec3 q = p + uKeyDir * (acc + 0.5 * s);
    float a = altitudeOf(q);
    if (a >= TOP || a <= BASE) break;
    tau += (k == 0 && dt < FINE_DT ? densityW(q, a, w, lodFor(s)) : coarseDensity(q, a, w, lodFor(s))) * s;
    acc += s;
    s *= 2.0;
  }
  return tau;
}

// density integral towards the strongest light under the deck (or in it)
float underDepth(vec3 p, vec2 w, float dt) {
  vec3 to = uUnderAim - p;
  float len = length(to);
  vec3 l = to / max(len, 1e-3);
  float s = min(len, UNDER_REACH) / float(UNDER_STEPS);
  float tau = 0.0;
  for (int k = 0; k < UNDER_STEPS; k++) {
    vec3 q = p + l * (s * (float(k) + 0.5));
    float a = altitudeOf(q);
    tau += (k == 0 && dt < FINE_DT ? densityW(q, a, w, lodFor(s)) : coarseDensity(q, a, w, lodFor(s))) * s;
  }
  return tau;
}

// schlick's cheap stand-in for henyey-greenstein (no pow), for the lamps' phase, which changes at every sample
float schlick(float c, float g) {
  float k = 1.55 * g - 0.55 * g * g * g;
  float q = 1.0 + k * c;
  return (1.0 - k * k) / (4.0 * PI * q * q);
}

// light from the lamps under the deck: inverse square, spot cones, phase towards the camera; dark lamps skipped
vec3 underLight(vec3 p, vec3 dir) {
  vec3 sum = vec3(0.0);
  for (int k = 0; k < UNDER_LIGHTS; k++) {
    vec3 col = uLightCol[k];
    if (col.r + col.g + col.b <= 0.0) continue;
    vec3 to = uLightPos[k] - p;
    float d2 = dot(to, to);
    vec3 l = to * inversesqrt(max(d2, 1e-6));
    vec4 shape = uLightShape[k];
    float cone = smoothstep(shape.x, shape.y, dot(-l, uLightDir[k]));
    float c = -dot(dir, l);
    sum += col * (cone / (d2 + shape.z) * (0.65 * schlick(c, 0.8 * shape.w) + 0.35 * schlick(c, -0.3 * shape.w)));
  }
  return sum;
}

// closest approach of the view ray to the segment a-b, as a distance along the ray
float closestOnRay(vec3 dir, vec3 a, vec3 b) {
  vec3 u = b - a;
  float uu = max(dot(u, u), 1e-6);
  float du = dot(dir, u);
  float da = dot(dir, a);
  float denom = max(uu - du * du, 1e-6);
  float s = clamp((da * du - dot(a, u)) / denom, 0.0, 1.0);
  return max(0.0, dot(a + u * s, dir));
}

void main() {
  vec4 v = uProjInv * vec4(vUv * 2.0 - 1.0, 1.0, 1.0);
  vec3 viewDir = normalize(v.xyz / v.w);
  vec3 dir = normalize(mat3(uCamWorld) * viewDir);

  // the scene stops the ray; the far field (sky, stars, earth) draws no depth: infinitely far
  float depth = texture(tDepth, vUv).r;
  float tScene = 1e9;
  if (depth < 1.0) {
    float viewZ = (uNear * uFar) / ((uFar - uNear) * depth - uFar);
    tScene = viewZ / viewDir.z;
  }

  vec2 seg = slab(uCamAlt, dir.y);
  float t0 = seg.x;
  float t1 = min(min(seg.y, tScene), t0 + MAX_MARCH);
  outAll = vec4(0.0, 0.0, 0.0, 1.0);
  outFront = vec4(0.0, 0.0, 0.0, 1.0);
  if (t1 <= t0) return;

  // where the near effects are along this ray: compositing puts the clouds in front of them up to there
  float tc = closestOnRay(dir, uFxA, uFxB);
  if (uFxBelow > 0.5) tc = min(tc, t0);

  float jitter = fract(blue(gl_FragCoord.xy) + uFrame * 0.6180340);
  float s0 = log(t0 + LOG_C);
  float ds = (log(t1 + LOG_C) - s0) / float(STEPS);
  float cosK = dot(dir, uKeyDir);
  float viewPowder = 0.6 * (0.5 - 0.5 * cosK);
  // the key light's phase per scattering octave: the same all along the ray
  vec3 phaseK = vec3(phase(cosK, 1.0), phase(cosK, 0.5), phase(cosK, 0.25));

  vec3 S = vec3(0.0);
  float T = 1.0;
  float Tc = 1.0;
  vec3 S1 = vec3(0.0);
  float T1 = 1.0;
  bool captured = tc <= t0;

  for (int i = 0; i < STEPS; i++) {
    float t = exp(s0 + (float(i) + jitter) * ds) - LOG_C;
    if (!captured && t > tc) {
      S1 = S;
      T1 = T;
      captured = true;
    }
    float dt = (t + LOG_C) * ds;
    vec3 p = dir * t;
    float alt = altitudeOf(p);
    vec2 w;
    float d = density(p, alt, lodFor(dt) - 0.5, w);
    if (d <= 0.002) continue;

    float sig = d * SIGMA;
    float h = (alt - BASE) / (TOP - BASE);

    // thin mist and the very edges skip the shadow marches: towards the key light they see the rest of the deck at
    // a fraction of its density, towards the lamps clear air (the column, the deck's base)
    bool thin = d < THIN;

    // the key light (moon, then the sun) through the cloud above, with a few octaves of multiple scattering
    float tk = (thin ? THIN_KEY * max(TOP - alt, 0.0) / max(uKeyDir.y, 0.15) : keyDepth(p, w, dt)) * SIGMA;
    float e = dot(vec3(1.0, 0.5, 0.25) * exp(-tk * vec3(1.0, 0.3, 0.09)), phaseK);
    // powder: thin edges hold little scattered light, so the sunlit side shows dark rims around bright cores
    e *= mix(1.0, 1.0 - exp(-sig * POWDER_M), viewPowder);
    vec3 L = uKeyCol * e;

    if (uUnderOn > 0.5) {
      float tu = thin ? 0.0 : underDepth(p, w, dt) * SIGMA;
      L += underLight(p, dir) * (0.6 * exp(-tu) + 0.4 * exp(-tu * 0.2));
    }
    L += uAmbTop * (0.25 + 0.75 * h) + uAmbBottom * (1.0 - h);

    // energy-conserving step (albedo 1), dissolving into the sky with distance
    float ts = exp(-sig * dt);
    float air = exp(-t * uAirFade);
    S += T * air * (1.0 - ts) * L;
    T *= 1.0 - (1.0 - ts) * air;
    // stop once the cloud itself is opaque, however much of it the far air has dissolved
    Tc *= ts;
    if (Tc < 0.004) break;
  }
  if (!captured) {
    S1 = S;
    T1 = T;
  }
  outAll = vec4(S, T);
  outFront = vec4(S1, T1);
}
`

// the composite in the effect pass: four taps of the reduced targets weighted by how close their depth is to this
// pixel's (an edge never borrows clouds from the other side), then the near effects (tFx: their light and coverage,
// drawn on their own) go between the clouds in front of them and the clouds behind them
export const compositeFragment = /* glsl */ `
uniform sampler2D tAll;
uniform sampler2D tFront;
uniform sampler2D tFx;
uniform vec2 lowSize;
uniform float cloudsOn;

float cloudDist(float d) {
  return d >= 1.0 ? 1e7 : -getViewZ(d);
}

void tap(vec2 cell, vec2 w2, float z, inout vec4 sumAll, inout vec4 sumFront, inout float wsum, inout float best, inout vec2 bestUv) {
  vec2 tuv = (cell + 0.5) / lowSize;
  float zk = cloudDist(readDepth(tuv));
  float rel = abs(zk - z) / max(min(zk, z), 1e-3);
  float w = w2.x * w2.y * exp(-rel * 12.0) + 1e-6 * w2.x * w2.y;
  sumAll += texture2D(tAll, tuv) * w;
  sumFront += texture2D(tFront, tuv) * w;
  wsum += w;
  if (rel < best) {
    best = rel;
    bestUv = tuv;
  }
}

void mainImage(const in vec4 inputColor, const in vec2 uv, const in float depth, out vec4 outputColor) {
  if (cloudsOn <= 0.0) {
    outputColor = inputColor;
    return;
  }
  float z = cloudDist(depth);
  vec2 pos = uv * lowSize - 0.5;
  vec2 c = floor(pos);
  vec2 fr = pos - c;
  vec4 whole = vec4(0.0);
  vec4 front = vec4(0.0);
  float wsum = 0.0;
  float best = 1e9;
  vec2 bestUv = uv;
  tap(c, vec2(1.0 - fr.x, 1.0 - fr.y), z, whole, front, wsum, best, bestUv);
  tap(c + vec2(1.0, 0.0), vec2(fr.x, 1.0 - fr.y), z, whole, front, wsum, best, bestUv);
  tap(c + vec2(0.0, 1.0), vec2(1.0 - fr.x, fr.y), z, whole, front, wsum, best, bestUv);
  tap(c + vec2(1.0, 1.0), vec2(fr.x, fr.y), z, whole, front, wsum, best, bestUv);
  if (best > 0.25) {
    // no tap shares this pixel's depth (a thin edge): take the closest one as it is
    whole = texture2D(tAll, bestUv);
    front = texture2D(tFront, bestUv);
  } else {
    whole /= wsum;
    front /= wsum;
  }
  vec4 fx = texture2D(tFx, uv);
  float A = clamp(fx.a, 0.0, 1.0);
  vec3 C = fx.rgb;
  // clouds in front of the effects, the effects, the clouds behind them over what lies behind
  vec3 color = front.rgb * A + front.a * C + (1.0 - A) * whole.rgb + whole.a * max(inputColor.rgb - C, 0.0);
  outputColor = vec4(mix(inputColor.rgb, color, cloudsOn), inputColor.a);
}
`
