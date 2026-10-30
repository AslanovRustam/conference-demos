// Pure planning for scripts/build-games.ts: which commands build which game, and the manifest
// the lobby reads to tell built games from COMING SOON ones.
import path from 'node:path'

export interface BuildStep {
  cmd: string
  args: string[]
}

export interface BuildPlan {
  id: string
  cwd: string
  outDir: string
  steps: BuildStep[]
  skip?: 'bad-id' | 'missing-source' | 'no-package-json'
}

export interface BuildResult {
  id: string
  ok: boolean
  reason?: string
}

export interface GamesManifest {
  builtAt: string
  games: Record<string, { ok: boolean; reason?: string }>
}

// the id becomes a folder that vite empties (--emptyOutDir); nothing but a plain name may pass
const ID_RE = /^[a-z0-9-]+$/

export function planBuild(game: { id: string; source?: string }, lobbyDir: string, exists: (p: string) => boolean): BuildPlan {
  if (!ID_RE.test(game.id)) return { id: game.id, cwd: '', outDir: '', steps: [], skip: 'bad-id' }
  const cwd = path.resolve(lobbyDir, game.source ?? `../${game.id}`)
  const outDir = path.resolve(lobbyDir, '.games-build', game.id)
  const plan: BuildPlan = { id: game.id, cwd, outDir, steps: [] }
  if (!exists(cwd)) return { ...plan, skip: 'missing-source' }
  if (!exists(path.join(cwd, 'package.json'))) return { ...plan, skip: 'no-package-json' }

  if (!exists(path.join(cwd, 'node_modules'))) {
    plan.steps.push({ cmd: 'npm', args: exists(path.join(cwd, 'package-lock.json')) ? ['ci'] : ['install'] })
  }
  // the game's own vite config stays untouched; CLI flags override base and outDir
  plan.steps.push({ cmd: 'npx', args: ['vite', 'build', '--base', `/games/${game.id}/`, '--outDir', outDir, '--emptyOutDir'] })
  return plan
}

export function toManifest(results: BuildResult[], builtAt: string): GamesManifest {
  const games: GamesManifest['games'] = {}
  for (const r of results) games[r.id] = r.ok ? { ok: true } : { ok: false, reason: r.reason }
  return { builtAt, games }
}
