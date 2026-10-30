import { useFrame, useThree } from '@react-three/fiber'
import { Bloom, ChromaticAberration, DepthOfField, EffectComposer, Noise, SMAA, ToneMapping, Vignette, wrapEffect } from '@react-three/postprocessing'
import { BlendFunction, ToneMappingMode, type ChromaticAberrationEffect, type DepthOfFieldEffect } from 'postprocessing'
import { use, useEffect, useMemo, useRef } from 'react'
import { Vector2, type PerspectiveCamera } from 'three'
import { loadCloudNoise } from '../clouds/noise'
import { sunRaysSource } from '../far/Sun'
import { fx } from '../fx'
import { QUALITY } from '../quality'
import { CloudsEffect } from './CloudsEffect'
import { DistortionEffect } from './DistortionEffect'
import { FlashEffect } from './FlashEffect'
import { LensFlareEffect } from './LensFlareEffect'
import { SunRaysEffect } from './SunRaysEffect'
import { ZoomBlurEffect } from './ZoomBlurEffect'

const Distortion = wrapEffect(DistortionEffect)
const ZoomBlur = wrapEffect(ZoomBlurEffect)
const Flash = wrapEffect(FlashEffect)

// uv offset at fx.chroma = 1; zero offset switches the effect off (a constant sub-pixel fringe steps on edges)
const CHROMA_MAX = 0.008

// the sun's lens effects: god rays and the flare, both idle while the sun is hidden
function SunLens() {
  const camera = useThree((s) => s.camera) as PerspectiveCamera
  const rays = useMemo(() => (QUALITY.godRays ? new SunRaysEffect(camera, sunRaysSource()) : null), [camera])
  const flare = useMemo(() => (QUALITY.lensFlare ? new LensFlareEffect(camera) : null), [camera])
  useEffect(
    () => () => {
      rays?.dispose()
      flare?.dispose()
    },
    [rays, flare],
  )
  return (
    <>
      {rays && <primitive object={rays} dispose={null} />}
      {flare && <primitive object={flare} dispose={null} />}
    </>
  )
}

// the volumetric cloud deck; suspends the scene until its noise is generated (part of loading)
function Clouds() {
  const noise = use(loadCloudNoise())
  const camera = useThree((s) => s.camera)
  const scene = useThree((s) => s.scene)
  const clouds = useMemo(() => new CloudsEffect(noise), [noise])
  useEffect(() => {
    clouds.mainCamera = camera
    clouds.mainScene = scene
  }, [clouds, camera, scene])
  useEffect(() => () => clouds.dispose(), [clouds])
  return <primitive object={clouds} dispose={null} />
}

// a focus pull on every camera cut: the blur opens on the live camera's subject and closes over DOF_FADE_S
const BOKEH_MAX = 6
const FOCUS_RANGE_M = 40

function Focus() {
  const dof = useRef<DepthOfFieldEffect>(null)
  useFrame(() => {
    if (dof.current) dof.current.bokehScale = fx.dofPulse * BOKEH_MAX
  })
  return <DepthOfField ref={dof} target={fx.focus} worldFocusRange={FOCUS_RANGE_M} bokehScale={0} resolutionScale={0.5} />
}

// hdr chain; tone mapping turns it into display colors near the end.
// scene effects go before ToneMapping: clouds first (task 11, ahead of the distortion, so the haze bends them too),
// then the sun's rays and flare (before the bloom, so it spreads their hot cores), dof
export function Effects() {
  const ca = useRef<ChromaticAberrationEffect>(null)
  const caOffset = useMemo(() => new Vector2(), [])

  useFrame(() => {
    const o = Math.min(1, Math.max(0, fx.chroma) + Math.max(0, fx.chromaPulse)) * CHROMA_MAX
    ca.current?.offset.set(o, o * 0.6)
  })

  return (
    // no msaa: multisampled float targets are costly on integrated gpus, SMAA smooths edges instead
    <EffectComposer multisampling={0}>
      <Clouds />
      {/* heat haze and shockwave rings bend the scene itself, before any lens effect */}
      <Distortion />
      {QUALITY.dof && <Focus />}
      {QUALITY.zoomBlur && <ZoomBlur />}
      <SunLens />
      <Bloom mipmapBlur levels={QUALITY.bloomLevels} luminanceThreshold={2.5} luminanceSmoothing={0.4} intensity={0.9} radius={0.75} />
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
