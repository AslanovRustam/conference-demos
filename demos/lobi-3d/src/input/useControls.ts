// Keyboard and pointer input for the lobby. Store transitions do their own guarding, so this
// layer only translates raw events into actions.
import { useEffect } from 'react'
import { snapTarget } from '../carousel/math'
import { lobbyStore } from '../state/store'
import { createDragTracker, pxToSlots } from './drag'
import { mapKey, type Action } from './hotkeys'

export function applyAction(action: Action): void {
  const s = lobbyStore.getState()
  switch (action.type) {
    case 'step':
      return s.step(action.dir)
    case 'enter':
      return void s.enter()
    case 'openGame':
      return void s.openGame(action.n)
    case 'toggleMute':
      return s.toggleMute()
    case 'toggleFps':
      return s.toggleFps()
    case 'toggleAttract':
      return s.setAttract(!s.attract)
    case 'exit':
      return s.requestExit()
  }
}

let lastDragEnd = -Infinity

/** True right after a drag ended: the click that follows pointerup must not open a cabinet. */
export function wasJustDragged(): boolean {
  return performance.now() - lastDragEnd < 120
}

/** Any lobby input ends attract mode; the idle timer hooks in here later. */
function noteInput() {
  const s = lobbyStore.getState()
  if (s.attract && s.phase === 'lobby') s.setAttract(false)
}

export function useControls(): void {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const s = lobbyStore.getState()
      if (s.phase === 'lobby') noteInput()
      const action = mapKey(e.key, s.phase, e.repeat)
      if (!action) return
      e.preventDefault()
      applyAction(action)
    }

    const drag = createDragTracker()
    let pointerId: number | null = null
    let startTarget = 0
    let moved = false

    const onDown = (e: PointerEvent) => {
      // HUD buttons sit above the canvas; only presses on the scene itself start a drag
      if (!(e.target instanceof Element) || !e.target.closest('.canvas') || lobbyStore.getState().phase !== 'lobby') return
      noteInput()
      pointerId = e.pointerId
      startTarget = lobbyStore.getState().carouselTarget
      moved = false
      drag.start(e.clientX, e.timeStamp)
    }
    const onMove = (e: PointerEvent) => {
      if (e.pointerId !== pointerId) return
      const dx = drag.move(e.clientX, e.timeStamp)
      if (Math.abs(dx) > 6) moved = true
      if (moved) lobbyStore.getState().dragTo(startTarget + pxToSlots(dx, innerWidth))
    }
    const onUp = (e: PointerEvent) => {
      if (e.pointerId !== pointerId) return
      pointerId = null
      const { wasDrag, velocityPxPerSec } = drag.end(e.timeStamp)
      if (!wasDrag) return
      lastDragEnd = performance.now()
      const s = lobbyStore.getState()
      s.dragTo(snapTarget(s.carouselTarget, pxToSlots(velocityPxPerSec, innerWidth)))
    }

    window.addEventListener('keydown', onKey)
    window.addEventListener('pointerdown', onDown)
    window.addEventListener('pointermove', onMove)
    window.addEventListener('pointerup', onUp)
    window.addEventListener('pointercancel', onUp)
    return () => {
      window.removeEventListener('keydown', onKey)
      window.removeEventListener('pointerdown', onDown)
      window.removeEventListener('pointermove', onMove)
      window.removeEventListener('pointerup', onUp)
      window.removeEventListener('pointercancel', onUp)
    }
  }, [])
}
