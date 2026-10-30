import { useFrame } from '@react-three/fiber'
import { Bloom, ChromaticAberration, EffectComposer, Noise, SMAA, ToneMapping, Vignette, wrapEffect } from '@react-three/postprocessing'
import { BlendFunction, ToneMappingMode, type ChromaticAberrationEffect } from 'postprocessing'
import { useMemo, useRef } from 'react'
import { Vector2 } from 'three'
import { fx } from '../fx'
import { QUALITY } from '../quality'
import { DistortionEffect } from './DistortionEffect'
import { FlashEffect } from './FlashEffect'
import { ZoomBlurEffect } from './ZoomBlurEffect'

const Distortion = wrapEffect(DistortionEffect)
const ZoomBlur = wrapEffect(ZoomBlurEffect)
const Flash = wrapEffect(FlashEffect)

// uv offset at fx.chroma = 1; zero offset switches the effect off (a constant sub-pixel fringe steps on edges)
const CHROMA_MAX = 0.008

// hdr chain; tone mapping turns it into display colors near the end.
// scene effects from later tasks go before ToneMapping: clouds first (ahead of the distortion, so the haze
// bends them too), then lens flare, god rays, dof
export function Effects() {
  const ca = useRef<ChromaticAberrationEffect>(null)
  const caOffset = useMemo(() => new Vector2(), [])

  useFrame(() => {
    const o = Math.max(0, fx.chroma) * CHROMA_MAX
    ca.current?.offset.set(o, o * 0.6)
  })

  return (
    // no msaa: multisampled float targets are costly on integrated gpus, SMAA smooths edges instead
    <EffectComposer multisampling={0}>
      {/* heat haze and shockwave rings bend the scene itself, before any lens effect */}
      <Distortion />
      {QUALITY.zoomBlur && <ZoomBlur />}
      <Bloom mipmapBlur levels={QUALITY.bloomLevels} luminanceThreshold={1} luminanceSmoothing={0.2} intensity={0.9} radius={0.75} />
      <ChromaticAberration ref={ca} offset={caOffset} radialModulation modulationOffset={0.2} />
      <Vignette darkness={0.55} offset={0.3} />
      {QUALITY.grain && <Noise premultiply blendFunction={BlendFunction.ADD} opacity={0.06} />}
      <ToneMapping mode={ToneMappingMode.AGX} />
      {/* display-referred from here on */}
      <Flash />
      <SMAA />
    </EffectComposer>
  )
}
