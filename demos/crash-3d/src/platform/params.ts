export interface Params {
  embed: boolean
  debug: boolean
  seed: number | null
  freeze: number | null
}

export function parseParams(search: string): Params {
  const q = new URLSearchParams(search)
  const debug = q.get('debug') === '1'
  let seed: number | null = null
  let freeze: number | null = null
  // debug-only params are ignored without debug=1
  if (debug) {
    const s = q.get('seed')
    if (s !== null && /^-?\d+$/.test(s.trim())) seed = Number(s)
    const f = q.get('freeze')
    if (f !== null && f.trim() !== '') {
      const n = Number(f)
      if (Number.isFinite(n) && n >= 1 && n <= 1000) freeze = n
    }
  }
  return { embed: q.get('embed') === '1', debug, seed, freeze }
}

export const params: Params = parseParams(typeof location === 'undefined' ? '' : location.search)
