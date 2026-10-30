import { BlendFunction, Effect, EffectAttribute } from 'postprocessing'
import { Color, Uniform, Vector2, type PerspectiveCamera, type Texture } from 'three'
import { lightState } from '../env/lightState'
import { sunStrength } from '../far/Sun'
import { fx } from '../fx'

// how much of the sun's disc the scene hides (the rocket in front of it): 16 depth taps in a disc around the sun,
// taken once per vertex of the full-screen triangle, not per pixel. taps off the screen count as open sky
const vertex = /* glsl */ `
uniform highp sampler2D sceneDepth;
uniform vec2 sun;
uniform float sunRadius;
varying float vOpen;

void mainSupport(const in vec2 uv) {
  float open = 0.0;
  for (int i = 0; i < 16; i++) {
    float a = float(i) * 2.39996;
    float r = sqrt((float(i) + 0.5) / 16.0) * sunRadius;
    vec2 q = sun + vec2(cos(a) / aspect, sin(a)) * r;
    bool inside = q.x >= 0.0 && q.x <= 1.0 && q.y >= 0.0 && q.y <= 1.0;
    float depth = texture2D(sceneDepth, clamp(q, 0.0, 1.0)).r;
    open += (!inside || depth > 0.9999999) ? 1.0 : 0.0;
  }
  vOpen = open / 16.0;
}
`

// procedural lens flare from the sun: veiling glare, a star of diffraction spikes from a six-blade iris, a faint
// anamorphic streak, a chromatic halo ring around the sun and a row of ghosts along the line through the screen
// center, all scaled by fx.sunVisible, the sun's brightness and what the rocket leaves of it
const fragment = /* glsl */ `
uniform vec2 sun;
uniform float strength;
uniform vec3 tint;
uniform float spin;
varying float vOpen;

// a soft disc with a brighter rim, r in units of its radius
float ghost(float r, float soft) {
  float body = 1.0 - smoothstep(1.0 - soft, 1.0, r);
  return body * (0.55 + 0.45 * smoothstep(0.5, 1.0, r));
}

vec3 spectrum(float x) {
  return clamp(vec3(abs(x * 6.0 - 3.0) - 1.0, 2.0 - abs(x * 6.0 - 2.0), 2.0 - abs(x * 6.0 - 4.0)), 0.0, 1.0);
}

void mainImage(const in vec4 inputColor, const in vec2 uv, out vec4 outputColor) {
  float k = strength * vOpen;
  if (k <= 0.0) {
    outputColor = vec4(0.0);
    return;
  }
  vec2 asp = vec2(aspect, 1.0);
  vec2 p = (uv - 0.5) * asp;
  vec2 s = (sun - 0.5) * asp;
  vec2 v = p - s;
  float d = length(v);
  vec3 c = vec3(0.0);

  // veiling glare around the sun
  c += tint * (0.12 * exp(-d * 18.0) + 0.03 * exp(-d * 4.0));

  // diffraction star: 12 spikes from 6 blades, two lengths, thin and tapering
  float ang = atan(v.y, v.x) + spin;
  float spikes = pow(abs(cos(ang * 6.0)), 300.0) * exp(-d * 26.0) + pow(abs(cos(ang * 6.0 + 1.5708)), 500.0) * exp(-d * 40.0) * 0.4;
  // fine streaks between them
  float fine = pow(abs(sin(ang * 37.0) * sin(ang * 23.0 + 1.3)), 6.0) * exp(-d * 18.0);
  c += tint * (spikes * 0.3 + fine * 0.12);

  // anamorphic streak
  c += vec3(0.45, 0.62, 1.0) * exp(-abs(v.y) * 300.0) * exp(-abs(v.x) * 2.5) * 0.2;

  // halo: a thin chromatic ring around the sun
  float ring = d / 0.36;
  float halo = exp(-pow((ring - 1.0) / 0.02, 2.0));
  c += spectrum(clamp((ring - 0.97) * 16.0, 0.0, 1.0)) * halo * 0.006;

  // ghosts on the line from the sun through the center
  vec2 axis = -s;
  c += vec3(0.30, 0.55, 1.00) * ghost(length(p - (s + axis * 0.55)) / 0.035, 0.4) * 0.03;
  c += vec3(0.55, 1.00, 0.70) * ghost(length(p - (s + axis * 0.80)) / 0.020, 0.3) * 0.025;
  c += vec3(1.00, 0.60, 0.30) * ghost(length(p - (s + axis * 1.25)) / 0.070, 0.6) * 0.02;
  c += vec3(0.70, 0.45, 1.00) * ghost(length(p - (s + axis * 1.55)) / 0.110, 0.5) * 0.012;
  c += vec3(0.35, 0.85, 1.00) * ghost(length(p - (s + axis * 1.90)) / 0.050, 0.3) * 0.02;
  c += vec3(1.00, 0.85, 0.50) * ghost(length(p - (s + axis * 2.30)) / 0.160, 0.7) * 0.01;
  // a big faint ring ghost reflected through the center
  float big = length(p - (s + axis * 2.0)) / 0.45;
  c += spectrum(clamp((big - 0.95) * 10.0, 0.0, 1.0)) * exp(-pow((big - 1.0) / 0.03, 2.0)) * 0.0025;

  outputColor = vec4(c * k, 1.0);
}
`

const SUN_RADIUS_DEG = 0.6 // occlusion probe radius, a little over the disc
const WHITE = new Color(1, 1, 1)

// procedural lens flare from fx.sunScreen with strength fx.sunVisible; reads the scene depth (in the vertex
// stage only) so the rocket in front of the sun puts the flare out
export class LensFlareEffect extends Effect {
  private sunUv: Uniform<Vector2>
  private strength: Uniform<number>
  private tint: Uniform<Color>
  private spin: Uniform<number>
  private sunRadius: Uniform<number>
  private depth: Uniform<Texture | null>
  private camera: PerspectiveCamera

  constructor(camera: PerspectiveCamera) {
    const sunUv = new Uniform(new Vector2())
    const strength = new Uniform(0)
    const tint = new Uniform(new Color())
    const spin = new Uniform(0)
    const sunRadius = new Uniform(0.01)
    const depth = new Uniform<Texture | null>(null)
    super('LensFlareEffect', fragment, {
      vertexShader: vertex,
      attributes: EffectAttribute.DEPTH,
      blendFunction: BlendFunction.ADD,
      uniforms: new Map<string, Uniform>([
        ['sun', sunUv],
        ['strength', strength],
        ['tint', tint],
        ['spin', spin],
        ['sunRadius', sunRadius],
        ['sceneDepth', depth],
      ]),
    })
    this.sunUv = sunUv
    this.strength = strength
    this.tint = tint
    this.spin = spin
    this.sunRadius = sunRadius
    this.depth = depth
    this.camera = camera
  }

  override setDepthTexture(depthTexture: Texture): void {
    this.depth.value = depthTexture
  }

  override update(): void {
    const k = Math.max(0, fx.sunVisible)
    // a dim red sun on the horizon flares less than the white sun in space
    this.strength.value = this.depth.value ? k * (0.35 + 0.65 * sunStrength()) : 0
    if (k <= 0) return
    this.sunUv.value.copy(fx.sunScreen)
    const c = lightState.sunColor
    const m = Math.max(c.r, c.g, c.b, 1e-4)
    this.tint.value.setRGB(c.r / m, c.g / m, c.b / m).lerp(WHITE, 0.25)
    // the star turns a little as the sun crosses the frame
    this.spin.value = (fx.sunScreen.x - 0.5) * 0.4
    const fov = this.camera.fov ?? 40
    this.sunRadius.value = (Math.tan((SUN_RADIUS_DEG * Math.PI) / 180) / Math.tan((fov * Math.PI) / 360)) * 0.5
  }
}
