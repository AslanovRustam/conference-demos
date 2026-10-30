import { params, type Params } from './params'

// a parent window, or a fake one in tests
export interface MessageTarget {
  postMessage(message: unknown, targetOrigin: string): void
}

// the lobby protocol (?embed=1, demos/lobi-3d bridge): the game tells its parent window when it is ready and when the
// visitor wants out; the lobby may mute it and says when it is on screen

export function exitToLobby(target: MessageTarget = window.parent, p: Pick<Params, 'embed'> = params): void {
  if (p.embed) target.postMessage({ type: 'clickable:exit' }, '*')
}

export function readyToLobby(target: MessageTarget = window.parent, p: Pick<Params, 'embed'> = params): void {
  if (p.embed) target.postMessage({ type: 'clickable:ready' }, '*')
}

export type LobbyMessage = { type: 'visible' } | { type: 'mute'; muted: boolean }

// only the parent window, only from its own origin
export function parseLobbyMessage(
  e: { data: unknown; origin: string; source: unknown },
  expectedOrigin: string,
  expectedSource: unknown,
): LobbyMessage | null {
  if (e.origin !== expectedOrigin || e.source !== expectedSource) return null
  const data = e.data as { type?: unknown; muted?: unknown } | null
  if (typeof data !== 'object' || data === null) return null
  if (data.type === 'clickable:visible') return { type: 'visible' }
  if (data.type === 'clickable:mute' && typeof data.muted === 'boolean') return { type: 'mute', muted: data.muted }
  return null
}
