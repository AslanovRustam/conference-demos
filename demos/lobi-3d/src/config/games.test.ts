import { describe, expect, test } from 'vitest'
import { applyPreviews, buildSlots, gameUrl, validateConfig, type GameEntry } from './games'

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

describe('applyPreviews', () => {
  test('fills preview, poster and start from the recorded index, config wins', () => {
    const cfg = { minSlots: 3, idleReturnSec: 90, games: [g('a'), { ...g('b'), preview: 'custom.mp4' }] }
    const slots = buildSlots(cfg, { builtAt: '', games: { a: { ok: true }, b: { ok: true } } })
    const out = applyPreviews(slots, {
      a: { video: 'previews/a.webm', poster: 'previews/a.jpg', start: 1.2 },
      b: { video: 'previews/b.webm', poster: 'previews/b.jpg', start: 0.8 },
    })
    expect(out[0].kind === 'game' && out[0].game).toMatchObject({ preview: 'previews/a.webm', poster: 'previews/a.jpg', previewStart: 1.2 })
    expect(out[1].kind === 'game' && out[1].game).toMatchObject({ preview: 'custom.mp4', poster: 'previews/b.jpg' })
    expect(out[2]).toBe(slots[2])
  })

  test('null index leaves slots untouched', () => {
    const slots = buildSlots({ minSlots: 1, idleReturnSec: 90, games: [g('a')] }, { builtAt: '', games: { a: { ok: true } } })
    expect(applyPreviews(slots, null)).toBe(slots)
  })
})
