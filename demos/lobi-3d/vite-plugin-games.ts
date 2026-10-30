// Games inside the lobby site. scripts/build-games.ts puts each built game in .games-build/<id>/;
// the dev server serves that folder at /games/, and the production build copies it to
// dist/games/, so lobby and games ship as one static site.
import { cpSync, existsSync } from 'node:fs'
import path from 'node:path'
import sirv from 'sirv'
import type { Plugin } from 'vite'

export function gamesPlugin(lobbyDir: string): Plugin {
  const buildDir = path.join(lobbyDir, '.games-build')
  let outDir = path.join(lobbyDir, 'dist')
  let command: 'build' | 'serve' = 'serve'

  return {
    name: 'lobby-games',
    configResolved(config) {
      outDir = path.resolve(config.root, config.build.outDir)
      command = config.command
    },
    configureServer(server) {
      const serve = sirv(buildDir, { dev: true })
      server.middlewares.use('/games', (req, res, next) => {
        const [pathname, query = ''] = (req.url ?? '/').split('?')
        // /games/<id> → /games/<id>/ so the game's relative asset urls resolve
        if (/^\/[a-z0-9-]+$/.test(pathname)) {
          res.statusCode = 301
          res.setHeader('Location', `/games${pathname}/${query ? `?${query}` : ''}`)
          res.end()
          return
        }
        if (!existsSync(buildDir)) return next()
        serve(req, res, next)
      })
    },
    closeBundle() {
      if (command === 'build' && existsSync(buildDir)) cpSync(buildDir, path.join(outDir, 'games'), { recursive: true })
    },
  }
}
