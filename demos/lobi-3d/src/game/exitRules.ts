import type { GameEntry } from '../config/games'
import type { Phase } from '../state/store'

/** The lobby's own corner exit, for touch screens and games without an exit of their own. */
export function showLobbyExitButton(game: GameEntry, phase: Phase): boolean {
  return phase === 'playing' && !game.ownExit
}
