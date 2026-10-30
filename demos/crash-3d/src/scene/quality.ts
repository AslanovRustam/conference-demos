// one quality level, ultra, on every device; every heavy knob lives here
export const QUALITY = {
  dpr: [1, 2] as [number, number],
  cloudScale: 0.5, cloudSteps: 72, cloudLightSteps: 6, cloudNoiseSize: 128,
  smokeParticles: 6000, debrisPieces: 320, starCount: 30000, meteorCount: 60,
  earthTextures: 'textures/earth/8k/', moonTexture: 'textures/moon/moon-4k.jpg',
  bloomLevels: 8, zoomBlur: true, godRays: true, dof: true, grain: true, lensFlare: true,
  // rocket: hull atlas width x height (around x along), tile size of the small atlases, pmrem face size
  rocketHullTexture: [2048, 4096] as [number, number], rocketTileTexture: 512, envMapSize: 512, anisotropy: 16,
} as const
