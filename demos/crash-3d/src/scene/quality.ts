// one quality level, ultra, on every device; every heavy knob lives here
export const QUALITY = {
  dpr: [1, 2] as [number, number],
  // clouds: raymarch resolution (fraction of the drawing buffer), samples per view ray, towards the key light and
  // towards the lamps under the deck; shape noise volume (n^3) and weather map (n^2) sizes
  cloudScale: 0.5, cloudSteps: 72, cloudLightSteps: 6, cloudUnderSteps: 3, cloudNoiseSize: 128, cloudWeatherSize: 512,
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
  // sky: scattering samples per view ray (run per vertex), the dome grid (azimuth segments x elevation rows, rows
  // crowd the horizon); shadow map of the key light on the rocket; radial samples per pixel of the god rays
  skySteps: 24, skyGrid: [192, 128] as [number, number], keyShadowMap: 2048, godRaysSamples: 60,
} as const
