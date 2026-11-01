export type Quality = 'low' | 'medium' | 'high'

const query = typeof location === 'undefined' ? new URLSearchParams() : new URLSearchParams(location.search)

/** integrated laptop graphics manage the medium tier at 60 FPS but not mirror floor + refraction */
function integratedGpu() {
  try {
    const gl = document.createElement('canvas').getContext('webgl2')
    const info = gl?.getExtension('WEBGL_debug_renderer_info')
    const name = info ? String(gl!.getParameter(info.UNMASKED_RENDERER_WEBGL)) : ''
    gl?.getExtension('WEBGL_lose_context')?.loseContext()
    return /Intel.*(UHD|HD Graphics|Iris)/i.test(name)
  } catch {
    return false
  }
}

function detectQuality(): Quality {
  const forced = query.get('quality')
  if (forced === 'low' || forced === 'medium' || forced === 'high') return forced
  if (typeof window === 'undefined') return 'high'
  const touch = window.matchMedia('(pointer: coarse)').matches
  const small = Math.min(window.screen.width, window.screen.height) < 700
  return touch || small || integratedGpu() ? 'medium' : 'high'
}

export const params = {
  /** running inside the lobby iframe: no splash screen, show an exit button */
  embed: query.get('embed') === '1',
  presenter: query.get('presenter') === '1',
  quality: detectQuality(),
  /** refractive gems (extra render pass); `?refraction=0` turns it off for comparison */
  refraction: query.get('refraction') !== '0',
}

export const QUALITY = {
  high: { dpr: 2, sparks: 4000, shards: 360, coins: 520, bloomLevels: 8, dust: 900 },
  medium: { dpr: 1.5, sparks: 2200, shards: 200, coins: 340, bloomLevels: 6, dust: 450 },
  low: { dpr: 1, sparks: 1000, shards: 90, coins: 160, bloomLevels: 4, dust: 200 },
} as const satisfies Record<Quality, object>
