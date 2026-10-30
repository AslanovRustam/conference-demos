import type { Slot } from '../config/games'

const two = (n: number) => String(n).padStart(2, '0')

/** Eyebrow tag above the game title: its place among the playable games, or COMING SOON. */
export function hudTag(slots: Slot[], index: number): string {
  const slot = slots[index]
  if (slot?.kind !== 'game') return 'COMING SOON'
  const games = slots.filter((s) => s.kind === 'game')
  return `GAME ${two(games.indexOf(slot) + 1)} / ${two(games.length)}`
}

/** Title and subtitle under the tag; empty cabinets say something other than the tag's COMING SOON. */
export function hudCaption(slot: Slot): { title: string; subtitle: string } {
  if (slot.kind === 'game') return { title: slot.game.title, subtitle: slot.game.subtitle }
  if (slot.title) return { title: slot.title, subtitle: 'In production at Clickable' }
  return { title: 'MORE GAMES', subtitle: 'New Clickable titles on the way' }
}
