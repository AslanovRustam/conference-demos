import { Effect } from 'postprocessing'
import { Uniform, Vector4 } from 'three'
import { fx } from '../fx'
import { QUALITY } from '../quality'

const fragment = /* glsl */ `
uniform vec4 sources[MAX_SOURCES]; // xy center (uv), z radius, w strength (screen heights)
uniform float rings[MAX_SOURCES]; // 1: shockwave ring at the radius, 0: heat haze disc
uniform int sourceCount;

float hash(vec2 p) {
  vec3 p3 = fract(vec3(p.xyx) * 0.1031);
  p3 += dot(p3, p3.yzx + 33.33);
  return fract((p3.x + p3.y) * p3.z);
}

float valueNoise(vec2 p) {
  vec2 i = floor(p);
  vec2 f = fract(p);
  vec2 u = f * f * (3.0 - 2.0 * f);
  return mix(mix(hash(i), hash(i + vec2(1.0, 0.0)), u.x), mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), u.x), u.y);
}

// boiling shimmer, -1..1 per axis: two layers rising at different speeds
vec2 shimmer(vec2 p) {
  vec2 a = p + vec2(0.0, -time * 2.2);
  vec2 b = p * 2.3 + vec2(time * 0.7, -time * 4.1);
  vec2 n = vec2(valueNoise(a) + 0.5 * valueNoise(b + 7.1), valueNoise(a + 13.7) + 0.5 * valueNoise(b + 21.3));
  return n / 0.75 - 1.0;
}

void mainUv(inout vec2 uv) {
  vec2 offset = vec2(0.0);
  for (int i = 0; i < MAX_SOURCES; i++) {
    if (i >= sourceCount) break;
    vec4 s = sources[i];
    // in radii of the source, round on screen
    vec2 d = (uv - s.xy) * vec2(aspect, 1.0) / s.z;
    float dist = length(d);
    if (rings[i] > 0.5) {
      // a lens-like band: pulls the picture in ahead of the front and pushes it out behind
      float band = (dist - 1.0) / RING_WIDTH;
      offset -= d / max(dist, 1e-4) * s.w * band * exp(-band * band) * 2.33;
    } else if (dist < 1.0) {
      float m = 1.0 - smoothstep(0.2, 1.0, dist);
      // shimmer cells keep one size on screen: fine near the camera, never sub-pixel far away
      offset += shimmer(d * s.z * HAZE_FREQ) * s.w * m * m;
    }
  }
  uv += offset * vec2(1.0 / aspect, 1.0);
}
`

// screen-space refraction from fx.distortion, read every frame (the first QUALITY.distortionSources with strength > 0).
// a source's radius is a fraction of the screen height and its strength the largest uv offset, also in screen
// heights. ring: false is heat haze, a shimmering disc; ring: true bends a band around the radius (a shockwave),
// RING_WIDTH radii wide. producers keep their own entries in fx.distortion: add on mount, update each frame,
// remove on unmount
export class DistortionEffect extends Effect {
  private sources: Vector4[]
  private rings: Float32Array
  private count: Uniform<number>

  constructor() {
    const n = QUALITY.distortionSources
    const sources = Array.from({ length: n }, () => new Vector4())
    const rings = new Float32Array(n)
    const count = new Uniform(0)
    super('DistortionEffect', fragment, {
      defines: new Map([
        ['MAX_SOURCES', String(n)],
        ['RING_WIDTH', '0.18'],
        // shimmer cells per screen height
        ['HAZE_FREQ', '45.0'],
      ]),
      uniforms: new Map<string, Uniform>([
        ['sources', new Uniform(sources)],
        ['rings', new Uniform(rings)],
        ['sourceCount', count],
      ]),
    })
    this.sources = sources
    this.rings = rings
    this.count = count
  }

  override update(): void {
    let k = 0
    for (const s of fx.distortion) {
      if (k >= this.sources.length) break
      if (!(s.strength > 0 && s.radius > 0)) continue
      this.sources[k].set(s.pos.x, s.pos.y, s.radius, s.strength)
      this.rings[k] = s.ring ? 1 : 0
      k++
    }
    this.count.value = k
  }
}
