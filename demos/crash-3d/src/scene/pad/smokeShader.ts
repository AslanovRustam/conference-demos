import {
  BufferAttribute,
  Color,
  CustomBlending,
  DataTexture,
  InstancedBufferGeometry,
  InstancedInterleavedBuffer,
  InterleavedBufferAttribute,
  LinearFilter,
  LinearMipmapLinearFilter,
  OneFactor,
  OneMinusSrcAlphaFactor,
  RepeatWrapping,
  RGFormat,
  ShaderMaterial,
  UnsignedByteType,
  Vector2,
  Vector3,
} from 'three'

// soft lit smoke and steam: one instanced quad per puff, turned to the camera in the vertex shader.
// the gpu moves every puff from its birth state (origin, velocity, drag, buoyancy, wind), so the cpu only writes
// a puff once, when it is born. light is gathered per puff in the vertex shader (the flame as a line light along the
// exhaust, the spot lights with their cones, a night ambient); the fragment shader shades a noisy sphere with it,
// premultiplied alpha. space: pad space (the mesh sits in the pad group)

export const PUFF_STRIDE = 16 // floats per puff

// per puff, four vec4s:
// a: origin xyz, birth time (rig.vtime)
// b: velocity xyz (m/s), life (s)
// c: size at birth, size at death (m), heat (glow of fresh exhaust, 0 for steam), seed 0..1
// d: drag (1/s), buoyancy (rise, m/s), spin (rad/s), opacity
export function puffGeometry(capacity: number): { geometry: InstancedBufferGeometry; buffer: InstancedInterleavedBuffer } {
  const geometry = new InstancedBufferGeometry()
  geometry.setAttribute('position', new BufferAttribute(new Float32Array([-1, -1, 0, 1, -1, 0, 1, 1, 0, -1, 1, 0]), 3))
  geometry.setIndex([0, 1, 2, 0, 2, 3])
  const data = new Float32Array(capacity * PUFF_STRIDE)
  // dead until written: born long ago with no life
  for (let i = 0; i < capacity; i++) data[i * PUFF_STRIDE + 3] = -1e9
  const buffer = new InstancedInterleavedBuffer(data, PUFF_STRIDE, 1)
  geometry.setAttribute('aA', new InterleavedBufferAttribute(buffer, 4, 0))
  geometry.setAttribute('aB', new InterleavedBufferAttribute(buffer, 4, 4))
  geometry.setAttribute('aC', new InterleavedBufferAttribute(buffer, 4, 8))
  geometry.setAttribute('aD', new InterleavedBufferAttribute(buffer, 4, 12))
  geometry.instanceCount = capacity
  return { geometry, buffer }
}

// tileable billow noise in red (puffy cauliflower lumps), plain fractal noise in green
export function bakeSmokeNoise(size = 128): Uint8Array {
  const period = 8
  const hash = (x: number, y: number, p: number, s: number) => {
    x = ((x % p) + p) % p
    y = ((y % p) + p) % p
    let h = (Math.imul(x, 374761393) + Math.imul(y, 668265263) + Math.imul(s, 1013904223)) | 0
    h = Math.imul(h ^ (h >>> 13), 1274126177)
    h ^= h >>> 16
    return (h >>> 0) / 4294967296
  }
  const vnoise = (x: number, y: number, p: number, s: number) => {
    const ix = Math.floor(x)
    const iy = Math.floor(y)
    const fx = x - ix
    const fy = y - iy
    const sx = fx * fx * (3 - 2 * fx)
    const sy = fy * fy * (3 - 2 * fy)
    const a = hash(ix, iy, p, s)
    const b = hash(ix + 1, iy, p, s)
    const c = hash(ix, iy + 1, p, s)
    const d = hash(ix + 1, iy + 1, p, s)
    return a + (b - a) * sx + (c - a) * sy + (a - b - c + d) * sx * sy
  }
  const out = new Uint8Array(size * size * 2)
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      let billow = 0
      let plain = 0
      let amp = 0.5
      let norm = 0
      for (let o = 0; o < 4; o++) {
        const f = 1 << o
        const u = (x / size) * period * f
        const v = (y / size) * period * f
        billow += amp * (1 - Math.abs(2 * vnoise(u, v, period * f, 7 + o) - 1))
        plain += amp * vnoise(u + 3.1, v + 1.7, period * f, 31 + o)
        norm += amp
        amp *= 0.5
      }
      const i = (y * size + x) * 2
      out[i] = Math.round((billow / norm) * 255)
      out[i + 1] = Math.round((plain / norm) * 255)
    }
  }
  return out
}

export function smokeNoiseTexture(): DataTexture {
  const size = 128
  const tex = new DataTexture(bakeSmokeNoise(size), size, size, RGFormat, UnsignedByteType)
  tex.wrapS = RepeatWrapping
  tex.wrapT = RepeatWrapping
  tex.magFilter = LinearFilter
  tex.minFilter = LinearMipmapLinearFilter
  tex.generateMipmaps = true
  tex.unpackAlignment = 1
  tex.needsUpdate = true
  return tex
}

const vertexShader = (floods: number) => /* glsl */ `
#define FLOODS ${floods}
attribute vec4 aA;
attribute vec4 aB;
attribute vec4 aC;
attribute vec4 aD;

uniform float uTime;
uniform float uCut;
uniform float uGround;
uniform vec3 uWind;
uniform vec3 uFlameA;
uniform vec3 uFlameB;
uniform vec3 uFlameCol;
uniform vec2 uFlameReach; // gain of the 1/d^2 core and of the 1/d tail of the flame light
uniform vec3 uFloodPos[FLOODS];
uniform vec3 uFloodDir[FLOODS];
uniform vec3 uFloodCol[FLOODS];
uniform vec2 uFloodCone[FLOODS];

varying vec2 vUv;
varying vec4 vShape; // noise offset, opacity, glow
varying vec3 vFlame;
varying vec3 vFlameDir;
varying vec3 vFlood;
varying vec3 vFloodDir;
varying vec2 vFade; // corner height above the ground, fade length

void main() {
  float age = uTime - aA.w;
  float life = aB.w;
  if (age < 0.0 || age >= life) {
    gl_Position = vec4(0.0, 0.0, 2.0, 1.0);
    return;
  }
  float t = age / life;
  float drag = aD.x;
  vec3 p = aA.xyz + aB.xyz * ((1.0 - exp(-drag * age)) / drag);
  // warm gas keeps rising; the wind takes over higher up
  p.y += aD.y * age;
  float h = max(p.y - uGround, 0.0);
  p += uWind * age * (0.3 + 0.7 * smoothstep(0.0, 50.0, h));
  // slow churning
  float s = aC.w * 43.7;
  float size = mix(aC.x, aC.y, 1.0 - pow(1.0 - t, 2.4));
  p.x += sin(age * 0.53 + s) * 0.06 * size;
  p.z += cos(age * 0.47 + s * 1.3) * 0.06 * size;
  p.y = max(p.y, uGround + size * 0.18);

  // the flame: the nearest point of a line down the exhaust
  vec3 ab = uFlameB - uFlameA;
  float k = clamp(dot(p - uFlameA, ab) / max(dot(ab, ab), 1e-4), 0.0, 1.0);
  vec3 lf = uFlameA + ab * k - p;
  // the plume is a long, very bright volume: past a few meters it still lights like a line, falling as 1/d
  float d2 = dot(lf, lf);
  vFlame = uFlameCol * (uFlameReach.x / (d2 + 60.0) + uFlameReach.y / (sqrt(d2) + 40.0));
  // spot lights
  vec3 flood = vec3(0.0);
  vec3 fdir = vec3(0.0, 1e-4, 0.0);
  for (int i = 0; i < FLOODS; i++) {
    vec3 l = uFloodPos[i] - p;
    float d2 = dot(l, l);
    vec3 ln = l * inversesqrt(d2);
    float spot = smoothstep(uFloodCone[i].x, uFloodCone[i].y, dot(-ln, uFloodDir[i]));
    vec3 e = uFloodCol[i] * (spot / d2);
    flood += e;
    fdir += ln * (e.r + e.g + e.b);
  }
  vFlood = flood;
  mat3 toView = mat3(viewMatrix);
  vFlameDir = normalize(toView * (lf + vec3(0.0, 1e-4, 0.0)));
  vFloodDir = normalize(toView * fdir);

  // opacity: quick fade in, long fade out; exhaust from the last round thins away after a reset
  float a = aD.w * smoothstep(0.0, 0.05, t) * (1.0 - smoothstep(0.4, 1.0, t));
  if (aA.w < uCut && aC.z > 0.0) a *= 1.0 - smoothstep(0.0, 2.0, uTime - uCut);
  float glow = aC.z * exp(-age * 2.0);

  vec4 mv = modelViewMatrix * vec4(p, 1.0);
  float ang = aC.w * 6.2832 + aD.z * age;
  vec2 cs = vec2(cos(ang), sin(ang));
  vec2 c = position.xy;
  vec2 rc = vec2(c.x * cs.x - c.y * cs.y, c.x * cs.y + c.y * cs.x);
  mv.xy += rc * size * 0.5;
  // a puff the camera is inside of would fill the screen
  a *= smoothstep(0.4, 1.2, -mv.z / size);
  vUv = c * 0.5 + 0.5;
  vShape = vec4(fract(aC.w * vec2(17.31, 29.17)), a, glow);
  // height of this corner above the ground: the billboard axes in pad space
  vec3 right = vec3(viewMatrix[0][0], viewMatrix[1][0], viewMatrix[2][0]);
  vec3 up = vec3(viewMatrix[0][1], viewMatrix[1][1], viewMatrix[2][1]);
  float cy = p.y + (right.y * rc.x + up.y * rc.y) * size * 0.5;
  vFade = vec2(cy - uGround, max(size * 0.22, 0.5));
  gl_Position = projectionMatrix * mv;
}
`

const fragmentShader = /* glsl */ `
uniform sampler2D uNoise;
uniform vec3 uAlbedo;
uniform vec3 uGlowCol;
uniform vec3 uAmbient;

varying vec2 vUv;
varying vec4 vShape;
varying vec3 vFlame;
varying vec3 vFlameDir;
varying vec3 vFlood;
varying vec3 vFloodDir;
varying vec2 vFade;

void main() {
  vec2 c = vUv * 2.0 - 1.0;
  float r2 = dot(c, c);
  if (r2 >= 1.0) discard;
  float n1 = texture2D(uNoise, vUv * 0.55 + vShape.xy).r;
  float n2 = texture2D(uNoise, vUv * 1.3 + vShape.yx + 0.37).g;
  float n = n1 * 0.7 + n2 * 0.3;
  // a soft round edge eaten into lumps by the noise
  float edge = 1.0 - sqrt(r2);
  float dens = smoothstep(0.0, 0.5, edge * (0.45 + 1.1 * n) - 0.12);
  float alpha = dens * vShape.z * smoothstep(0.0, 1.0, vFade.x / vFade.y);
  if (alpha < 0.002) discard;
  // a lumpy sphere normal facing the camera
  vec3 nrm = normalize(vec3(c * 1.15 + (vec2(n1, n2) - 0.5) * 1.1, sqrt(max(1.0 - r2, 0.0)) + 0.2));
  float wf = clamp(dot(nrm, vFlameDir) * 0.65 + 0.4, 0.0, 1.0);
  float wl = clamp(dot(nrm, vFloodDir) * 0.6 + 0.45, 0.0, 1.0);
  // thick middles shade themselves a little
  float self = mix(1.0, 0.7, dens * dens);
  // the spill of light all around: soft, a little brighter on tops facing the sky
  float sky = 0.75 + 0.25 * dot(nrm, normalize(mat3(viewMatrix) * vec3(0.0, 1.0, 0.0)));
  vec3 col = uAlbedo * (vFlame * wf + vFlood * wl * self + uAmbient * sky);
  col += uGlowCol * (vShape.w * dens * dens * (0.5 + n));
  gl_FragColor = vec4(col * alpha, alpha);
}
`

export type SmokeMaterial = ShaderMaterial

export function smokeMaterial(floods: number, noise: DataTexture): SmokeMaterial {
  const n = Math.max(1, floods)
  return new ShaderMaterial({
    vertexShader: vertexShader(n),
    fragmentShader,
    uniforms: {
      uTime: { value: 0 },
      uCut: { value: -1e9 },
      uGround: { value: 0 },
      uWind: { value: new Vector3(1.6, 0, -0.9) },
      uFlameA: { value: new Vector3() },
      uFlameB: { value: new Vector3() },
      uFlameCol: { value: new Color(0, 0, 0) },
      uFlameReach: { value: new Vector2(6, 0.6) },
      uFloodPos: { value: Array.from({ length: n }, () => new Vector3()) },
      uFloodDir: { value: Array.from({ length: n }, () => new Vector3(0, -1, 0)) },
      uFloodCol: { value: Array.from({ length: n }, () => new Color(0, 0, 0)) },
      uFloodCone: { value: Array.from({ length: n }, () => new Vector2(0.9, 0.95)) },
      // the spill of every floodlight around the pad: shadowed smoke reads grey-blue, never brown
      uAmbient: { value: new Color(0.34, 0.38, 0.48) },
      uNoise: { value: noise },
      // diffuse albedo over pi: bright water vapor
      uAlbedo: { value: new Color(0.78, 0.78, 0.8).multiplyScalar(1 / Math.PI) },
      uGlowCol: { value: new Color(7, 2.4, 0.55) },
    },
    transparent: true,
    depthWrite: false,
    blending: CustomBlending,
    blendSrc: OneFactor,
    blendDst: OneMinusSrcAlphaFactor,
    blendSrcAlpha: OneFactor,
    blendDstAlpha: OneMinusSrcAlphaFactor,
  })
}
