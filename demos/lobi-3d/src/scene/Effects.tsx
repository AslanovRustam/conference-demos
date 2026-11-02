import { useFrame } from '@react-three/fiber'
import { Bloom, EffectComposer, SMAA, ToneMapping, Vignette } from '@react-three/postprocessing'
import { ToneMappingMode, type VignetteEffect } from 'postprocessing'
import { useRef } from 'react'
import { params } from '../state/params'
import { fx } from './fx'

/** `smaa`: edge smoothing, dropped by LobbyCanvas when the device cannot hold the frame rate */
export default function Effects({ smaa }: { smaa: boolean }) {
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
    // no MSAA: on integrated GPUs it caused regular half-second stalls. SMAA smooths the edges
    // (chrome rims, chip edges, cabinet silhouettes) after tone mapping, at the cost of three
    // full-screen passes, which is why it is the first thing a slow device gives up
    <EffectComposer multisampling={0}>
      <Bloom mipmapBlur levels={4} resolutionScale={0.4} luminanceThreshold={1.1} luminanceSmoothing={0.3} intensity={0.85} radius={0.75} />
      <Vignette ref={vignette} darkness={0.6} offset={0.3} />
      <ToneMapping mode={ToneMappingMode.NEUTRAL} />
      {smaa && <SMAA />}
    </EffectComposer>
  )
}
