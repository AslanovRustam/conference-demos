import { useFrame } from '@react-three/fiber'
import { Bloom, EffectComposer, ToneMapping, Vignette } from '@react-three/postprocessing'
import { ToneMappingMode, type VignetteEffect } from 'postprocessing'
import { useRef } from 'react'
import { params } from '../state/params'
import { fx } from './fx'

export default function Effects() {
  const vignette = useRef<VignetteEffect>(null)
  useFrame(() => {
    if (vignette.current) vignette.current.darkness = 0.6 + 0.35 * fx.focus
  })
  if (params.quality === 'low') {
    return (
      <EffectComposer multisampling={0}>
        <ToneMapping mode={ToneMappingMode.NEUTRAL} />
      </EffectComposer>
    )
  }
  return (
    // no MSAA: on integrated GPUs it caused regular half-second stalls, and bloom hides the edges anyway
    <EffectComposer multisampling={0}>
      <Bloom mipmapBlur levels={4} resolutionScale={0.4} luminanceThreshold={1.1} luminanceSmoothing={0.3} intensity={0.85} radius={0.75} />
      <Vignette ref={vignette} darkness={0.6} offset={0.3} />
      <ToneMapping mode={ToneMappingMode.NEUTRAL} />
    </EffectComposer>
  )
}
