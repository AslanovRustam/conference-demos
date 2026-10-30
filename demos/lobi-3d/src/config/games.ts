// Game list for the carousel: games.config.json validated, joined with the build manifest
// (which games actually made it into dist/games), padded with COMING SOON cabinets.

export interface GameEntry {
  id: string
  title: string
  subtitle: string
  /** source folder relative to demos/lobi-3d, used only by scripts/build-games.ts */
  source?: string
  /** explicit page url instead of games/<id>/ (the dev test game) */
  url?: string
  preview?: string
  poster?: string
  /** seconds to skip at the start of the preview loop (the game's own loading) */
  previewStart?: number
  idleReturnSec?: number
  /** false: do not send clickable:visible (for a game that auto-starts on it instead of waiting for a tap) */
  sendVisible?: boolean
  /** extra wait after the game's readiness signal (ready message or first canvas frames) before revealing it */
  revealDelayMs?: number
}

export interface LobbyConfig {
  minSlots: number
  idleReturnSec: number
  games: GameEntry[]
}

export interface GamesManifest {
  builtAt: string
  games: Record<string, { ok: boolean; reason?: string }>
}

/** previews/index.json, written by scripts/record-previews.ts */
export type PreviewIndex = Record<string, { video: string; poster: string; start: number }>

export type Slot =
  | { kind: 'game'; key: string; game: GameEntry; url: string }
  | { kind: 'soon'; key: string; title: string | null }

const ID_RE = /^[a-z0-9-]+$/

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v)
}

export function validateConfig(raw: unknown): LobbyConfig {
  if (!isRecord(raw)) throw new Error('games config: expected an object')
  const { minSlots, idleReturnSec, games } = raw
  if (typeof minSlots !== 'number' || minSlots < 1) throw new Error('games config: minSlots must be a positive number')
  if (typeof idleReturnSec !== 'number' || idleReturnSec < 0) throw new Error('games config: idleReturnSec must be >= 0')
  if (!Array.isArray(games)) throw new Error('games config: games must be an array')

  const seen = new Set<string>()
  for (const game of games) {
    if (!isRecord(game)) throw new Error('games config: every game must be an object')
    const id = game.id
    if (typeof id !== 'string' || !ID_RE.test(id)) throw new Error(`games config: bad id "${String(id)}" (use a-z, 0-9, -)`)
    if (seen.has(id)) throw new Error(`games config: duplicate id "${id}"`)
    seen.add(id)
    if (typeof game.title !== 'string' || !game.title) throw new Error(`games config: game "${id}" needs a title`)
    if (typeof game.subtitle !== 'string') throw new Error(`games config: game "${id}" needs a subtitle`)
  }
  return raw as unknown as LobbyConfig
}

export function gameUrl(game: GameEntry): string {
  const url = game.url ?? `games/${game.id}/?embed=1`
  if (/[?&]embed=1(&|$)/.test(url)) return url
  if (url.endsWith('?') || url.endsWith('&')) return `${url}embed=1`
  return url + (url.includes('?') ? '&' : '?') + 'embed=1'
}

export function buildSlots(config: LobbyConfig, manifest: GamesManifest | null, extras: GameEntry[] = []): Slot[] {
  const slots: Slot[] = config.games.map((game) =>
    manifest?.games[game.id]?.ok
      ? { kind: 'game', key: `game:${game.id}`, game, url: gameUrl(game) }
      : { kind: 'soon', key: `soon:${game.id}`, title: game.title },
  )
  for (const game of extras) slots.push({ kind: 'game', key: `game:${game.id}`, game, url: gameUrl(game) })
  for (let n = 0; slots.length < config.minSlots; n++) slots.push({ kind: 'soon', key: `pad:${n}`, title: null })
  return slots
}

/** Recorded previews fill in what games.config.json leaves empty. */
export function applyPreviews(slots: Slot[], index: PreviewIndex | null): Slot[] {
  if (!index) return slots
  return slots.map((slot) => {
    const rec = slot.kind === 'game' ? index[slot.game.id] : undefined
    if (!rec || slot.kind !== 'game') return slot
    const game = { ...slot.game }
    game.preview ??= rec.video
    game.poster ??= rec.poster
    game.previewStart ??= rec.start
    return { ...slot, game }
  })
}

export async function loadPreviews(fetchFn: typeof fetch = fetch): Promise<PreviewIndex | null> {
  try {
    const res = await fetchFn('previews/index.json', { cache: 'no-store' })
    if (!res.ok) return null
    const data: unknown = await res.json()
    return isRecord(data) ? (data as PreviewIndex) : null
  } catch {
    return null
  }
}

export async function loadManifest(fetchFn: typeof fetch = fetch): Promise<GamesManifest | null> {
  try {
    const res = await fetchFn('games/manifest.json', { cache: 'no-store' })
    if (!res.ok) return null
    const data: unknown = await res.json()
    return isRecord(data) && isRecord(data.games) ? (data as unknown as GamesManifest) : null
  } catch {
    return null
  }
}
