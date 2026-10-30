import { BlendFunction, Effect, EffectAttribute } from 'postprocessing'
import { Uniform, Vector2 } from 'three'
import { fx } from '../fx'

const fragment = /* glsl */ `
uniform float strength;
uniform vec2 center;

void mainImage(const in vec4 inputColor, const in vec2 uv, out vec4 outputColor) {
  if (strength <= 0.0) {
    outputColor = inputColor;
    return;
  }
  // average along the line towards the center; jitter turns banding into fine noise
  vec2 toCenter = (center - uv) * strength;
  float jitter = fract(sin(dot(uv, vec2(12.9898, 78.233))) * 43758.5453);
  vec4 sum = inputColor;
  float total = 1.0;
  for (int i = 1; i < SAMPLES; i++) {
    float t = (float(i) + jitter) / float(SAMPLES);
    float w = 1.0 - 0.5 * t;
    sum += texture2D(inputBuffer, uv + toCenter * t) * w;
    total += w;
  }
  outputColor = sum / total;
}
`

// radial blur from the screen center; strength is the streak length as a fraction of the
// distance to the center, read from fx.zoomBlur + fx.zoomPulse every frame (0 = off, no extra samples)
export class ZoomBlurEffect extends Effect {
  private strength: Uniform<number>

  constructor({ samples = 24 }: { samples?: number } = {}) {
    const strength = new Uniform(0)
    super('ZoomBlurEffect', fragment, {
      // samples the input at other pixels, so it never shares a pass with another convolution
      attributes: EffectAttribute.CONVOLUTION,
      blendFunction: BlendFunction.NORMAL,
      defines: new Map([['SAMPLES', String(samples)]]),
      uniforms: new Map<string, Uniform>([
        ['strength', strength],
        ['center', new Uniform(new Vector2(0.5, 0.5))],
      ]),
    })
    this.strength = strength
  }

  override update(): void {
    this.strength.value = Math.max(0, fx.zoomBlur) + Math.max(0, fx.zoomPulse)
  }
}
