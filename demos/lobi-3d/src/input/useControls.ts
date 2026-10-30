// Keyboard and pointer input for the lobby. Store transitions do their own guarding, so this
// layer only translates raw events into actions.
import { useEffect } from 'react'
import { snapTarget } from '../carousel/math'
import { lobbyStore } from '../state/store'
import { params } from '../state/params'
import { createDragTracker, pxToSlots } from './drag'
import { mapKey, type Action } from './hotkeys'
import { createIdleTimer } from './idle'

const ATTRACT_IDLE_MS = (params.attractIdleSec ?? 45) * 1000
const ATTRACT_STEP_MS = 6000

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

// nobody at the stand for a while: the lobby starts showing itself off
const lobbyIdle = createIdleTimer(ATTRACT_IDLE_MS, () => {
  const s = lobbyStore.getState()
  if (s.phase === 'lobby') s.setAttract(true)
})

/** Any lobby input ends attract mode and restarts the idle countdown. */
function noteInput() {
  lobbyIdle.poke()
  const s = lobbyStore.getState()
  if (s.attract && s.phase === 'lobby') s.setAttract(false)
}

/** Idle countdown in the lobby and the self-turning carousel while attract is on. */
export function useAttract(): void {
  useEffect(() => {
    let stepTimer: ReturnType<typeof setInterval> | null = null
    const sync = () => {
      const s = lobbyStore.getState()
      if (s.phase === 'lobby') lobbyIdle.start()
      else lobbyIdle.stop()
      if (s.attract && s.phase === 'lobby') {
        stepTimer ??= setInterval(() => lobbyStore.getState().step(1), ATTRACT_STEP_MS)
      } else if (stepTimer) {
        clearInterval(stepTimer)
        stepTimer = null
      }
    }
    sync()
    let last = lobbyStore.getState()
    const unsubscribe = lobbyStore.subscribe((s) => {
      if (s.phase !== last.phase || s.attract !== last.attract) sync()
      last = s
    })
    return () => {
      unsubscribe()
      lobbyIdle.stop()
      if (stepTimer) clearInterval(stepTimer)
    }
  }, [])
}

export function useControls(): void {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const s = lobbyStore.getState()
      const action = mapKey(e.key, s.phase, e.repeat)
      // T toggles attract itself, so it must not first be cancelled as ordinary input
      if (s.phase === 'lobby' && action?.type !== 'toggleAttract') noteInput()
      if (!action) return
      e.preventDefault()
      applyAction(action)
    }

    const drag = createDragTracker()
    let pointerId: number | null = null
    let startTarget = 0
    let moved = false

    const onDown = (e: PointerEvent) => {
      if (lobbyStore.getState().phase !== 'lobby') return
      noteInput()
      // HUD buttons sit above the canvas; only presses on the scene itself start a drag
      if (!(e.target instanceof Element) || !e.target.closest('.canvas')) return
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
