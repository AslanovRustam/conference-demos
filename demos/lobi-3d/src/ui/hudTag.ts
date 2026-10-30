import type { Slot } from '../config/games'

const two = (n: number) => String(n).padStart(2, '0')

/** Eyebrow tag above the game title: its place among the playable games, or COMING SOON. */
export function hudTag(slots: Slot[], index: number): string {
  const slot = slots[index]
  if (slot?.kind !== 'game') return 'COMING SOON'
  const games = slots.filter((s) => s.kind === 'game')
  return `GAME ${two(games.indexOf(slot) + 1)} / ${two(games.length)}`
}
