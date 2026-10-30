// one quality level, ultra, on every device; every heavy knob lives here
export const QUALITY = {
  dpr: [1, 2] as [number, number],
  cloudScale: 0.5, cloudSteps: 72, cloudLightSteps: 6, cloudNoiseSize: 128,
  smokeParticles: 6000, debrisPieces: 320, starCount: 30000, meteorCount: 60,
  earthTextures: 'textures/earth/8k/', moonTexture: 'textures/moon/moon-4k.jpg',
  bloomLevels: 8, zoomBlur: true, godRays: true, dof: true, grain: true, lensFlare: true,
  // rocket: hull atlas width x height (around x along), tile size of the small atlases, logo decal width,
  // per-pixel noise fields (roughness, soot; the mottle is twice as coarse) at 1/n of the atlas, pmrem face size
  rocketHullTexture: [2048, 4096] as [number, number], rocketTileTexture: 512, rocketLogoTexture: 2048,
  rocketNoiseDownscale: 4, envMapSize: 512, anisotropy: 16,
  // engine plume: raymarch samples per pixel through the turbulent flame and through each nozzle's jet,
  // sides of the bounding cones; screen distortion sources (heat haze, shockwave rings) the post pass takes per frame
  plumeSteps: 24, plumeJetSteps: 20, plumeSegments: 48, distortionSources: 8,
  // launch pad: hardstand atlas (the noise fields are painted at half of it), mount deck, tiling concrete and soil;
  // floodlights used from the layout (4-6 spot lights), how many of them cast shadows and their map size;
  // lattice bay height of the service tower (smaller: more beams); far-away lights of the complex.
  // smoke: steam vents get this share of smokeParticles, the exhaust clouds the rest.
  padTexture: 2048, padDeckTexture: 1024, padTileTexture: 512,
  floodlights: 6, floodShadows: 4, floodShadowMap: 2048, beamSegments: 40,
  towerBay: 4, distantLights: 520, steamShare: 0.22,
  // wet apron: the mirrored scene pass (only while the apron is in view) at this fraction of the drawing buffer
  padReflection: { enabled: true, scale: 0.5 },
} as const
