import path from 'node:path'
import { expect, test } from 'vitest'
import { planBuild, toManifest } from './games-build.ts'

const lobby = path.resolve('/r/demos/lobi-3d')
const at = (...p: string[]) => path.resolve(lobby, ...p)

test('default source is the sibling folder; vite gets base and outDir', () => {
  const plan = planBuild({ id: 'crash-3d' }, lobby, (p) => [at('../crash-3d'), at('../crash-3d/package.json'), at('../crash-3d/node_modules')].includes(p))
  expect(plan.cwd).toBe(at('../crash-3d'))
  expect(plan.outDir).toBe(at('.games-build/crash-3d'))
  expect(plan.skip).toBeUndefined()
  expect(plan.steps).toEqual([{ cmd: 'npx', args: ['vite', 'build', '--base', '/games/crash-3d/', '--outDir', at('.games-build/crash-3d'), '--emptyOutDir'] }])
})

test('installs first: npm ci with a lockfile, npm install without', () => {
  const withLock = planBuild({ id: 'a', source: './games/a' }, lobby, (p) => [at('games/a'), at('games/a/package.json'), at('games/a/package-lock.json')].includes(p))
  expect(withLock.steps[0]).toEqual({ cmd: 'npm', args: ['ci'] })
  const noLock = planBuild({ id: 'a' }, lobby, (p) => [at('../a'), at('../a/package.json')].includes(p))
  expect(noLock.steps[0]).toEqual({ cmd: 'npm', args: ['install'] })
  expect(noLock.steps).toHaveLength(2)
})

test('skips missing folders and folders without package.json', () => {
  expect(planBuild({ id: 'x' }, lobby, () => false).skip).toBe('missing-source')
  expect(planBuild({ id: 'x' }, lobby, (p) => p === at('../x')).skip).toBe('no-package-json')
})

test('toManifest', () => {
  expect(toManifest([{ id: 'a', ok: true }, { id: 'b', ok: false, reason: 'build-failed' }], 'T')).toEqual({
    builtAt: 'T',
    games: { a: { ok: true }, b: { ok: false, reason: 'build-failed' } },
  })
})
