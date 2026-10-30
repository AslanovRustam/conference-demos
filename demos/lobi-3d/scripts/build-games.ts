// Builds every game listed in games.config.json from its own folder into .games-build/<id>/,
// served under /games/<id>/, and writes .games-build/manifest.json. A missing or failing game
// is reported and left out (the lobby shows it as COMING SOON); --strict turns that into exit 1.
// Run: node scripts/build-games.ts [--strict]
import { spawnSync } from 'node:child_process'
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { planBuild, toManifest, type BuildResult } from './lib/games-build.ts'

const lobbyDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const buildDir = path.join(lobbyDir, '.games-build')
const strict = process.argv.includes('--strict')

const config = JSON.parse(readFileSync(path.join(lobbyDir, 'games.config.json'), 'utf8')) as { games: { id: string; source?: string }[] }

// npm/npx are .cmd shims on Windows and need a shell; quote anything with spaces ourselves
const quote = (a: string) => (/[\s"]/.test(a) ? `"${a.replace(/"/g, '\\"')}"` : a)

const results: BuildResult[] = []
for (const game of config.games) {
  const plan = planBuild(game, lobbyDir, existsSync)
  if (plan.skip) {
    console.warn(`\n[${game.id}] skipped: ${plan.skip} (${plan.cwd})`)
    results.push({ id: game.id, ok: false, reason: plan.skip })
    continue
  }
  let ok = true
  for (const step of plan.steps) {
    const line = [step.cmd, ...step.args].map(quote).join(' ')
    console.log(`\n[${game.id}] ${line}`)
    const r = spawnSync(line, { cwd: plan.cwd, stdio: 'inherit', shell: true })
    if (r.status !== 0) {
      ok = false
      break
    }
  }
  results.push(ok ? { id: game.id, ok } : { id: game.id, ok, reason: 'build-failed' })
}

mkdirSync(buildDir, { recursive: true })
writeFileSync(path.join(buildDir, 'manifest.json'), JSON.stringify(toManifest(results, new Date().toISOString()), null, 2) + '\n')

console.log('\nGames build:')
for (const r of results) console.log(`  ${r.id.padEnd(16)} ${r.ok ? 'OK  ' : 'FAIL'} ${r.reason ?? ''}`)

process.exit(strict && results.some((r) => !r.ok) ? 1 : 0)
