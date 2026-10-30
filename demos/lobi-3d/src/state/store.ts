// Lobby state: the phase machine (loading → lobby → entering → playing → exiting → lobby)
// plus carousel navigation. Every transition is guarded here, so repeated or late input
// (double Enter, Esc mid-flight, a ready message after exit) cannot leave a broken state.
import { useStore } from 'zustand'
import { createStore } from 'zustand/vanilla'
import { nearestTarget, wrapIndex } from '../carousel/math'
import type { Slot } from '../config/games'
import { params } from './params'

export type Phase = 'loading' | 'lobby' | 'entering' | 'playing' | 'exiting'

export interface LobbyState {
  phase: Phase
  slots: Slot[]
  /** continuous slot index the carousel eases toward */
  carouselTarget: number
  /** bumped when the carousel must jump instead of easing */
  snapToken: number
  /** bumped when someone tries to open a COMING SOON cabinet */
  deniedToken: number
  activeIndex: number
  openSlot: number | null
  /** bumped on every entry into a game: one game frame per entry, even for the same slot */
  entryToken: number
  cameraArrived: boolean
  gameReady: boolean
  muted: boolean
  attract: boolean
  /** set when an idle game sends the stand back to the lobby: land straight in attract mode */
  attractAfterExit: boolean
  showFps: boolean

  init(slots: Slot[]): void
  step(dir: 1 | -1): void
  dragTo(target: number): void
  focus(index: number, instant?: boolean): void
  openGame(n: number): boolean
  enter(): boolean
  markCameraArrived(): void
  markGameReady(): void
  requestExit(toAttract?: boolean): void
  exitDone(): void
  toggleMute(): void
  setAttract(on: boolean): void
  toggleFps(): void
}

export function createLobbyStore() {
  return createStore<LobbyState>()((set, get) => {
    const moveTo = (target: number) => set({ carouselTarget: target, activeIndex: wrapIndex(Math.round(target), get().slots.length) })
    const reveal = () => {
      const s = get()
      if (s.phase === 'entering' && s.cameraArrived && s.gameReady) set({ phase: 'playing' })
    }

    return {
      phase: 'loading',
      slots: [],
      carouselTarget: 0,
      snapToken: 0,
      deniedToken: 0,
      activeIndex: 0,
      openSlot: null,
      entryToken: 0,
      cameraArrived: false,
      gameReady: false,
      muted: false,
      attract: false,
      attractAfterExit: false,
      showFps: params.fps,

      init: (slots) => set({ slots, phase: 'lobby', carouselTarget: 0, activeIndex: 0 }),

      step: (dir) => {
        if (get().phase !== 'lobby') return
        moveTo(Math.round(get().carouselTarget) + dir)
      },

      dragTo: (target) => {
        if (get().phase === 'lobby') moveTo(target)
      },

      focus: (index, instant = false) => {
        const s = get()
        if (s.phase !== 'lobby' || !s.slots.length) return
        moveTo(nearestTarget(s.carouselTarget, index, s.slots.length))
        if (instant) set({ snapToken: s.snapToken + 1 })
      },

      openGame: (n) => {
        const s = get()
        if (s.phase !== 'lobby') return false
        let seen = 0
        const index = s.slots.findIndex((slot) => slot.kind === 'game' && ++seen === n)
        if (index < 0) return false
        get().focus(index, true)
        return get().enter()
      },

      enter: () => {
        const s = get()
        if (s.phase !== 'lobby') return false
        if (s.slots[s.activeIndex]?.kind !== 'game') {
          set({ deniedToken: s.deniedToken + 1 })
          return false
        }
        set({ phase: 'entering', openSlot: s.activeIndex, entryToken: s.entryToken + 1, cameraArrived: false, gameReady: false, attract: false })
        return true
      },

      markCameraArrived: () => {
        if (get().phase !== 'entering') return
        set({ cameraArrived: true })
        reveal()
      },

      markGameReady: () => {
        if (get().phase !== 'entering') return
        set({ gameReady: true })
        reveal()
      },

      requestExit: (toAttract = false) => {
        const phase = get().phase
        if (phase === 'entering' || phase === 'playing') set({ phase: 'exiting', attractAfterExit: toAttract })
      },

      exitDone: () => {
        const s = get()
        if (s.phase !== 'exiting') return
        set({ phase: 'lobby', openSlot: null, cameraArrived: false, gameReady: false, attract: s.attractAfterExit, attractAfterExit: false })
      },

      toggleMute: () => set({ muted: !get().muted }),
      setAttract: (on) => set({ attract: on }),
      toggleFps: () => set({ showFps: !get().showFps }),
    }
  })
}

export const lobbyStore = createLobbyStore()

export function useLobby<T>(selector: (s: LobbyState) => T): T {
  return useStore(lobbyStore, selector)
}

// lets automated browser checks read and drive the lobby; stripped from production builds
if (import.meta.env?.DEV && typeof window !== 'undefined') Object.assign(window, { __lobby: lobbyStore })
