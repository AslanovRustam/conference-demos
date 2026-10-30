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

// shared by the M key and the mute button; persisted across visits
export function toggleMute(): void {
  const muted = !useGame.getState().muted
  useGame.getState().setMuted(muted)
  safeStorage.set('muted', muted ? '1' : '0')
}

// per-frame readers: called now and on every store update, returns unsubscribe.
// the hud writes fast text through refs with this instead of re-rendering each frame
export function onSnap(fn: (snap: RoundSnapshot) => void): () => void {
  fn(useGame.getState().snap)
  return useGame.subscribe((s) => fn(s.snap))
}
