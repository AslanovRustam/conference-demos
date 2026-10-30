import { describe, expect, test } from 'vitest'
import type { Slot } from '../config/games'
import { createLobbyStore } from './store'

const game = (id: string): Slot => ({ kind: 'game', key: `game:${id}`, game: { id, title: id, subtitle: '' }, url: `games/${id}/?embed=1` })
const soon = (n: number): Slot => ({ kind: 'soon', key: `pad:${n}`, title: null })
// [game a, soon, game b, soon, soon, soon]
const slots = [game('a'), soon(0), game('b'), soon(1), soon(2), soon(3)]

function ready() {
  const s = createLobbyStore()
  s.getState().init(slots)
  return s
}
function entered() {
  const s = ready()
  s.getState().enter()
  return s
}

describe('navigation', () => {
  test('works only in lobby and wraps', () => {
    const s = createLobbyStore()
    s.getState().step(1)
    expect(s.getState().carouselTarget).toBe(0) // still loading
    s.getState().init(slots)
    s.getState().step(-1)
    expect(s.getState().activeIndex).toBe(5)
    expect(s.getState().carouselTarget).toBe(-1)
  })

  test('focus uses the shortest rotation', () => {
    const s = ready()
    s.getState().focus(5)
    expect(s.getState().carouselTarget).toBe(-1)
  })

  test('dragTo keeps the float target and rounds the active slot', () => {
    const s = ready()
    s.getState().dragTo(1.6)
    expect(s.getState()).toMatchObject({ carouselTarget: 1.6, activeIndex: 2 })
  })
})

describe('enter and exit', () => {
  test('enter only on a game slot; second enter is ignored', () => {
    const s = ready()
    s.getState().step(1)
    expect(s.getState().enter()).toBe(false)
    expect(s.getState().phase).toBe('lobby')
    expect(s.getState().deniedToken).toBe(1)
    s.getState().step(1)
    expect(s.getState().enter()).toBe(true)
    expect(s.getState()).toMatchObject({ phase: 'entering', openSlot: 2 })
    expect(s.getState().enter()).toBe(false)
    s.getState().step(1)
    expect(s.getState().activeIndex).toBe(2)
  })

  test('reveal needs both camera and game ready, in any order', () => {
    const s = entered()
    s.getState().markGameReady()
    expect(s.getState().phase).toBe('entering')
    s.getState().markCameraArrived()
    expect(s.getState().phase).toBe('playing')
  })

  test('exit aborts entering and resets flags', () => {
    const s = entered()
    s.getState().markCameraArrived()
    s.getState().requestExit()
    expect(s.getState().phase).toBe('exiting')
    s.getState().markGameReady()
    expect(s.getState().phase).toBe('exiting')
    s.getState().exitDone()
    expect(s.getState()).toMatchObject({ phase: 'lobby', openSlot: null, cameraArrived: false, gameReady: false })
  })

  test('exitDone outside exiting is ignored', () => {
    const s = ready()
    s.getState().exitDone()
    expect(s.getState().phase).toBe('lobby')
  })

  test('openGame(n) jumps to the n-th game slot and enters', () => {
    const s = ready()
    const token = s.getState().snapToken
    expect(s.getState().openGame(2)).toBe(true)
    expect(s.getState()).toMatchObject({ phase: 'entering', openSlot: 2, activeIndex: 2 })
    expect(s.getState().snapToken).toBe(token + 1)
    expect(ready().getState().openGame(3)).toBe(false)
  })
})

describe('toggles', () => {
  test('mute, attract and fps', () => {
    const s = ready()
    s.getState().toggleMute()
    s.getState().setAttract(true)
    s.getState().toggleFps()
    expect(s.getState()).toMatchObject({ muted: true, attract: true, showFps: true })
  })
})
