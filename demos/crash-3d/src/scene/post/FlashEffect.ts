import { BlendFunction, Effect } from 'postprocessing'
import { Color, Uniform } from 'three'
import { fx } from '../fx'

const fragment = /* glsl */ `
uniform float amount;
uniform vec3 color;

void mainImage(const in vec4 inputColor, const in vec2 uv, out vec4 outputColor) {
  outputColor = vec4(mix(inputColor.rgb, color, amount), inputColor.a);
}
`

// full-screen flash towards fx.flashColor by fx.flash; sits after tone mapping so a brand red
// flash lands on the exact brand color
export class FlashEffect extends Effect {
  private amount: Uniform<number>
  private color: Uniform<Color>

  constructor() {
    const amount = new Uniform(0)
    const color = new Uniform(new Color())
    super('FlashEffect', fragment, {
      blendFunction: BlendFunction.NORMAL,
      uniforms: new Map<string, Uniform>([
        ['amount', amount],
        ['color', color],
      ]),
    })
    this.amount = amount
    this.color = color
  }

  override update(): void {
    this.amount.value = Math.min(1, Math.max(0, fx.flash))
    this.color.value.copy(fx.flashColor)
  }
}
