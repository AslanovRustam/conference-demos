import { useFrame } from '@react-three/fiber'
import { Bloom, EffectComposer, ToneMapping, Vignette } from '@react-three/postprocessing'
import { ToneMappingMode, type VignetteEffect } from 'postprocessing'
import { useRef } from 'react'
import { fx } from './fx'

export default function Effects() {
  const vignette = useRef<VignetteEffect>(null)
  useFrame(() => {
    if (vignette.current) vignette.current.darkness = 0.6 + 0.35 * fx.focus
  })
  return (
    <EffectComposer multisampling={4}>
      <Bloom mipmapBlur luminanceThreshold={0.7} luminanceSmoothing={0.3} intensity={1.2} radius={0.75} />
      <Vignette ref={vignette} darkness={0.6} offset={0.3} />
      <ToneMapping mode={ToneMappingMode.NEUTRAL} />
    </EffectComposer>
  )
}
