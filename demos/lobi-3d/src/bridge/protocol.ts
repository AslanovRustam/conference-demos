// Lobby ↔ game messages (spec §13). Games post to window.parent; the lobby only trusts
// messages from its own origin and from the iframe it opened.

export type GameMessage = { type: 'clickable:exit' } | { type: 'clickable:ready' }
export type LobbyMessage = { type: 'clickable:visible' } | { type: 'clickable:mute'; muted: boolean }

import type { GameEntry } from '../config/games'

const GAME_TYPES = new Set(['clickable:exit', 'clickable:ready'])

export function parseGameMessage(
  e: { origin: string; source: unknown; data: unknown },
  expectedOrigin: string,
  expectedSource: unknown,
): GameMessage | null {
  if (e.origin !== expectedOrigin || e.source !== expectedSource) return null
  const data = e.data
  if (typeof data !== 'object' || data === null) return null
  const type = (data as { type?: unknown }).type
  return typeof type === 'string' && GAME_TYPES.has(type) ? ({ type } as GameMessage) : null
}

export function sendToGame(target: Window | null | undefined, msg: LobbyMessage, origin: string): void {
  target?.postMessage(msg, origin)
}

/**
 * What the game is told when it appears. A game opens on its own start screen and waits for the
 * visitor; one that treats clickable:visible as "start now" (plinko-3d today) gets sendVisible: false.
 */
export function revealMessages(game: GameEntry, muted: boolean): LobbyMessage[] {
  const out: LobbyMessage[] = []
  if (game.sendVisible !== false) out.push({ type: 'clickable:visible' })
  out.push({ type: 'clickable:mute', muted })
  return out
}
