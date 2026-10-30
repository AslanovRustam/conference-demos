import { describe, expect, test } from 'vitest'
import { buildSlots, gameUrl, validateConfig, type GameEntry } from './games'

const g = (id: string, title = id): GameEntry => ({ id, title, subtitle: '' })

describe('validateConfig', () => {
  test('rejects duplicate and malformed ids', () => {
    const base = { minSlots: 6, idleReturnSec: 90 }
    expect(() => validateConfig({ ...base, games: [g('a'), g('a')] })).toThrow(/duplicate.*"a"/i)
    expect(() => validateConfig({ ...base, games: [g('Bad Id')] })).toThrow(/"Bad Id"/)
    expect(() => validateConfig({ ...base, games: [{ id: 'x' }] })).toThrow(/title/)
  })

  test('accepts the shipped games.config.json shape', () => {
    const cfg = validateConfig({ minSlots: 6, idleReturnSec: 90, games: [{ ...g('slot-3d'), source: '../slot-3d', ownExit: true }] })
    expect(cfg.games[0]).toMatchObject({ id: 'slot-3d', ownExit: true })
  })
})

describe('gameUrl', () => {
  test('builds embed urls', () => {
    expect(gameUrl(g('crash-3d'))).toBe('games/crash-3d/?embed=1')
    expect(gameUrl({ ...g('t'), url: 'test-game/?slow=1' })).toBe('test-game/?slow=1&embed=1')
    expect(gameUrl({ ...g('t'), url: 'test-game/?embed=1' })).toBe('test-game/?embed=1')
    expect(gameUrl({ ...g('t'), url: 'test-game/?' })).toBe('test-game/?embed=1')
  })
})

describe('buildSlots', () => {
  test('marks unbuilt games as soon and pads to minSlots', () => {
    const cfg = { minSlots: 6, idleReturnSec: 90, games: [g('a', 'A'), g('b', 'B'), g('c', 'C')] }
    const manifest = { builtAt: '', games: { a: { ok: true }, b: { ok: false, reason: 'build-failed' } } }
    const slots = buildSlots(cfg, manifest)
    expect(slots.map((s) => s.kind)).toEqual(['game', 'soon', 'soon', 'soon', 'soon', 'soon'])
    expect(slots.map((s) => (s.kind === 'game' ? s.game.title : s.title))).toEqual(['A', 'B', 'C', null, null, null])
    expect(new Set(slots.map((s) => s.key)).size).toBe(6)
  })

  test('null manifest makes all configured games soon; extras are always games, after configured', () => {
    const cfg = { minSlots: 2, idleReturnSec: 90, games: [g('a'), g('b')] }
    const slots = buildSlots(cfg, null, [{ ...g('test-game'), url: 'test-game/' }])
    expect(slots.map((s) => s.kind)).toEqual(['soon', 'soon', 'game'])
  })

  test('does not pad when games exceed minSlots', () => {
    const cfg = { minSlots: 6, idleReturnSec: 90, games: 'abcdefg'.split('').map((id) => g(id)) }
    expect(buildSlots(cfg, { builtAt: '', games: {} })).toHaveLength(7)
  })
})
