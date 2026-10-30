import { create } from 'zustand'
import type { RoundSnapshot } from '../core/types'
import { safeStorage } from '../platform/storage'
import { runtime } from './runtime'

interface GameState {
  snap: RoundSnapshot
  muted: boolean
  camLabel: string
  presenterOpen: boolean
  setMuted(v: boolean): void
  setCamLabel(v: string): void
  setPresenterOpen(v: boolean): void
}

export const useGame = create<GameState>((set) => ({
  snap: runtime.engine.snapshot(),
  muted: safeStorage.get('muted') === '1',
  camLabel: '',
  presenterOpen: false,
  setMuted: (muted) => set({ muted }),
  setCamLabel: (camLabel) => set({ camLabel }),
  setPresenterOpen: (presenterOpen) => set({ presenterOpen }),
}))
