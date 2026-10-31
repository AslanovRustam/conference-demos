import { params } from '../platform/params'

export type QualityTier = 'ultra' | 'medium' | 'low'

// every heavy knob lives here, per tier. ultra is the look on a discrete gpu; medium keeps the look on a laptop's
// integrated gpu (no wet-apron mirror, fewer cloud samples, smoke and shadows); low is for phones
const ULTRA = {
  dpr: [1, 2] as [number, number],
  // clouds: raymarch resolution (fraction of the drawing buffer), samples per view ray, towards the key light and
  // towards the lamps under the deck; shape noise volume (n^3) and weather map (n^2) sizes
  cloudScale: 0.5, cloudSteps: 72, cloudLightSteps: 6, cloudUnderSteps: 3, cloudNoiseSize: 128, cloudWeatherSize: 512,
  smokeParticles: 6000, debrisPieces: 320, starCount: 30000, meteorCount: 60,
  earthTextures: 'textures/earth/8k/', moonTexture: 'textures/moon/moon-4k.jpg',
  bloomLevels: 8, zoomBlur: true, godRays: true, grain: true, lensFlare: true,
  // edge smoothing (smaa: three passes, fxaa: one) and the colour fringe of the warp and the blast (its own pass)
  antialias: 'smaa' as 'smaa' | 'fxaa', chroma: true,
  // rocket: hull atlas width x height (around x along), tile size of the small atlases, logo decal width,
  // per-pixel noise fields (roughness, soot; the mottle is twice as coarse) at 1/n of the atlas, pmrem face size
  rocketHullTexture: [2048, 4096] as [number, number], rocketTileTexture: 512, rocketLogoTexture: 2048,
  rocketNoiseDownscale: 4, envMapSize: 512, anisotropy: 16,
  // engine plume: raymarch samples per pixel through the turbulent flame and through each nozzle's jet,
  // sides of the bounding cones; screen distortion sources (heat haze, shockwave rings) the post pass takes per frame
  plumeSteps: 24, plumeJetSteps: 20, plumeSegments: 48, distortionSources: 8,
  // launch pad: hardstand atlas (the noise fields are painted at half of it), mount deck, tiling concrete and soil;
  // floodlights used from the layout (6 spot lights), how many of them cast shadows and their map size;
  // lattice bay height of the service tower (smaller: more beams); far-away lights of the complex.
  // smoke: steam vents get this share of smokeParticles, the exhaust clouds the rest.
  padTexture: 2048, padDeckTexture: 1024, padTileTexture: 512,
  floodlights: 6, floodShadows: 4, floodShadowMap: 2048, beamSegments: 40,
  towerBay: 4, distantLights: 520, steamShare: 0.22,
  // wet apron: the mirrored scene pass (only while the apron is in view) at this fraction of the drawing buffer
  padReflection: { enabled: true, scale: 0.5 },
  // sky: scattering samples per view ray (run per vertex), the dome grid (azimuth segments x elevation rows, rows
  // crowd the horizon); shadow map of the key light on the rocket; radial samples per pixel of the god rays
  skySteps: 24, skyGrid: [192, 128] as [number, number], keyShadowMap: 2048, godRaysSamples: 60,
}

export type Quality = typeof ULTRA

const MEDIUM: Quality = {
  ...ULTRA,
  // an integrated gpu is starved by full-screen passes: fewer pixels for the 3d (the dom hud stays sharp), one-pass
  // edge smoothing, no fringe pass
  dpr: [0.7, 0.7], antialias: 'fxaa', chroma: false,
  cloudScale: 0.25, cloudSteps: 32, cloudLightSteps: 4, cloudUnderSteps: 2,
  smokeParticles: 2500, debrisPieces: 160, starCount: 15000, meteorCount: 40,
  bloomLevels: 4, grain: false,
  rocketNoiseDownscale: 8, envMapSize: 256, anisotropy: 2,
  plumeSteps: 16, plumeJetSteps: 12,
  floodShadows: 2, floodShadowMap: 1024, distantLights: 260,
  padReflection: { enabled: false, scale: 0.5 },
  skySteps: 16, skyGrid: [128, 96], keyShadowMap: 1024, godRaysSamples: 32,
}

const LOW: Quality = {
  ...MEDIUM,
  // phones have 2-3 device pixels per css pixel: 1-1.25 of them is still sharp enough on a small screen
  dpr: [1, 1.25],
  cloudScale: 0.2, cloudSteps: 24, cloudLightSteps: 3, cloudUnderSteps: 1,
  smokeParticles: 1400, debrisPieces: 100, starCount: 8000, meteorCount: 30,
  bloomLevels: 4, godRays: false, lensFlare: false,
  rocketHullTexture: [1024, 2048], rocketLogoTexture: 1024,
  plumeSteps: 12, plumeJetSteps: 8,
  floodShadows: 0, keyShadowMap: 1024,
  skySteps: 12,
}

export const QUALITY_TIERS: Record<QualityTier, Quality> = { ultra: ULTRA, medium: MEDIUM, low: LOW }

const DISCRETE = /nvidia|geforce|rtx|gtx|quadro|radeon rx|radeon pro|arc a\d/i

// the tier for a gpu: a discrete card gets ultra, an integrated laptop gpu medium, a phone or tablet low;
// an unknown gpu plays safe. a debug override (?debug=1&quality=) wins
export function tierFor(renderer: string, touch: boolean, override: QualityTier | null = null): QualityTier {
  if (override) return override
  if (touch) return 'low'
  return DISCRETE.test(renderer) ? 'ultra' : 'medium'
}

// the gpu's name from a throwaway context; null outside a browser (tests run ultra)
function detectRenderer(): string | null {
  if (typeof document === 'undefined') return null
  try {
    const gl = document.createElement('canvas').getContext('webgl2')
    if (!gl) return ''
    const info = gl.getExtension('WEBGL_debug_renderer_info')
    const name = String(info ? gl.getParameter(info.UNMASKED_RENDERER_WEBGL) : gl.getParameter(gl.RENDERER))
    gl.getExtension('WEBGL_lose_context')?.loseContext()
    return name
  } catch {
    return ''
  }
}

function pickTier(): QualityTier {
  const renderer = detectRenderer()
  if (renderer === null) return params.quality ?? 'ultra'
  const touch = typeof matchMedia !== 'undefined' && matchMedia('(pointer: coarse)').matches
  return tierFor(renderer, touch, params.quality)
}

export const QUALITY_TIER: QualityTier = pickTier()
export const QUALITY: Quality = QUALITY_TIERS[QUALITY_TIER]
