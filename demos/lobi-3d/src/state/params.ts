// URL overrides for the presenter and for automated checks, e.g. ?idle=3&attractIdle=2&fps=1.
// ?tg= is the query string handed to the dev test game (noready=1, slow=<ms>, noexit=1).

export interface LobbyParams {
  idleReturnSec?: number
  attractIdleSec?: number
  testGameQuery: string
  fps: boolean
}

function seconds(v: string | null): number | undefined {
  if (v === null || v.trim() === '') return undefined
  const n = Number(v)
  return Number.isFinite(n) && n >= 0 ? n : undefined
}

export function parseParams(search: string): LobbyParams {
  const q = new URLSearchParams(search)
  const out: LobbyParams = { testGameQuery: q.get('tg') ?? '', fps: q.get('fps') === '1' }
  const idle = seconds(q.get('idle'))
  const attractIdle = seconds(q.get('attractIdle'))
  if (idle !== undefined) out.idleReturnSec = idle
  if (attractIdle !== undefined) out.attractIdleSec = attractIdle
  return out
}

export const params = parseParams(typeof location === 'undefined' ? '' : location.search)
