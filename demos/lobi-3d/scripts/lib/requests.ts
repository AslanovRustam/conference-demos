// Request classification for scripts/check-games.ts. Inside the one-site build a game may only
// load files from its own /games/<id>/ folder: a root-absolute path ('/models/x.glb') works in
// the game's own dev server but 404s here, and anything off-origin breaks offline use.

export type RequestClass = 'ok' | 'outside' | 'external'

/** `gameId` null means the lobby page itself, which may load anything on its origin. */
export function classifyRequest(url: string, gameId: string | null, origin: string): RequestClass {
  if (url.startsWith('data:') || url.startsWith('blob:')) return 'ok'
  let u: URL
  try {
    u = new URL(url)
  } catch {
    return 'ok'
  }
  if (u.origin !== origin) return 'external'
  if (gameId === null) return 'ok'
  // browsers ask for /favicon.ico on their own
  if (u.pathname === '/favicon.ico') return 'ok'
  return u.pathname.startsWith(`/games/${gameId}/`) ? 'ok' : 'outside'
}
