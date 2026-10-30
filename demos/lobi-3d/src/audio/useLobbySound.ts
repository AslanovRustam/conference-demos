// Wires lobby events to sound effects in one place: the store says what happened, this hook
// decides what it sounds like.
import { useEffect } from 'react'
import { lobbyStore } from '../state/store'
import { sfx } from './sfx'

export function useLobbySound(): void {
  useEffect(() => {
    const unlock = () => sfx.unlock()
    window.addEventListener('pointerdown', unlock, { capture: true })
    window.addEventListener('keydown', unlock, { capture: true })

    sfx.setMuted(lobbyStore.getState().muted)
    const unsubscribe = lobbyStore.subscribe((s, prev) => {
      if (s.muted !== prev.muted) sfx.setMuted(s.muted)
      if (s.phase === 'lobby' && s.activeIndex !== prev.activeIndex) sfx.tick()
      if (s.deniedToken !== prev.deniedToken) sfx.denied()
      if (s.phase !== prev.phase) {
        if (s.phase === 'entering') {
          sfx.select()
          sfx.whooshIn()
        }
        // the game owns the sound while it is on screen
        if (s.phase === 'playing') sfx.setLevel(0)
        if (s.phase === 'exiting') {
          sfx.setLevel(1)
          sfx.whooshOut()
        }
      }
    })

    return () => {
      unsubscribe()
      window.removeEventListener('pointerdown', unlock, { capture: true })
      window.removeEventListener('keydown', unlock, { capture: true })
    }
  }, [])
}
