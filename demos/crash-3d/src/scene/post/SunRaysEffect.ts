import { BlendFunction, GodRaysEffect, KernelSize } from 'postprocessing'
import type { Camera, Mesh, WebGLRenderer, WebGLRenderTarget } from 'three'
import { airAt } from '../far/skyCurves'
import { fx } from '../fx'
import { QUALITY } from '../quality'
import { rig } from '../rig'

const GAIN = 0.8 // ray strength at fx.sunVisible = 1 in thick air
const VACUUM = 0.35 // what is left in space, where only the lens makes them

// the shafts are lit air kilometres away: the rocket and the pad stand in front of them (depth < 1), only a trace of
// the glow lands on them
const fragment = /* glsl */ `
#ifdef FRAMEBUFFER_PRECISION_HIGH
uniform mediump sampler2D map;
#else
uniform lowp sampler2D map;
#endif
void mainImage(const in vec4 inputColor, const in vec2 uv, const in float depth, out vec4 outputColor) {
  outputColor = texture2D(map, uv) * (depth > 0.9999999 ? 1.0 : 0.12);
}
`

// postprocessing's god rays from the sun (far/Sun.tsx sunRaysSource), added on top: screen blending would dull the
// hdr highlights. they are shafts of lit air, so they thin out with altitude. while the sun is hidden (fx.sunVisible 0:
// below the horizon, behind the earth, off screen) the depth copy, the light pass, the blur and the radial samples are
// all skipped and the blend opacity is 0, so the effect adds nothing; only the one texture read in the merged pass remains
export class SunRaysEffect extends GodRaysEffect {
  constructor(camera: Camera, source: Mesh) {
    super(camera, source, {
      blendFunction: BlendFunction.ADD,
      samples: QUALITY.godRaysSamples,
      density: 0.96,
      decay: 0.95,
      weight: 0.4,
      exposure: 1.1,
      clampMax: 1,
      kernelSize: KernelSize.SMALL,
      resolutionScale: 0.5,
      blur: true,
    })
    this.setFragmentShader(fragment)
  }

  override update(renderer: WebGLRenderer, inputBuffer: WebGLRenderTarget, deltaTime?: number): void {
    const visible = Math.max(0, fx.sunVisible)
    const air = VACUUM + (1 - VACUUM) * airAt(rig.altM)
    this.blendMode.opacity.value = visible * air * GAIN
    if (visible > 0) super.update(renderer, inputBuffer, deltaTime)
  }
}
