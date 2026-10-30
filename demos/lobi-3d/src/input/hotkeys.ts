// Keyboard map. Inside a game only Escape belongs to the lobby; every other key is the game's.
import type { Phase } from '../state/store'

export type Action =
  | { type: 'step'; dir: 1 | -1 }
  | { type: 'enter' }
  | { type: 'openGame'; n: number }
  | { type: 'toggleMute' }
  | { type: 'toggleFps' }
  | { type: 'toggleAttract' }
  | { type: 'exit' }

export function mapKey(key: string, phase: Phase, repeat: boolean): Action | null {
  if (phase === 'entering' || phase === 'playing') return key === 'Escape' ? { type: 'exit' } : null
  if (phase !== 'lobby') return null

  // holding an arrow keeps the carousel spinning; everything else fires once per press
  switch (key) {
    case 'ArrowLeft':
    case 'a':
    case 'A':
      return { type: 'step', dir: -1 }
    case 'ArrowRight':
    case 'd':
    case 'D':
      return { type: 'step', dir: 1 }
  }
  if (repeat) return null
  if (key === 'Enter' || key === ' ') return { type: 'enter' }
  if (/^[1-9]$/.test(key)) return { type: 'openGame', n: Number(key) }
  switch (key.toLowerCase()) {
    case 'm':
      return { type: 'toggleMute' }
    case 'f':
      return { type: 'toggleFps' }
    case 't':
      return { type: 'toggleAttract' }
  }
  return null
}
