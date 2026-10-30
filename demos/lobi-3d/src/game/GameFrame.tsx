// The open game, in a same-origin iframe over the canvas. It stays invisible while the camera
// flies in and loads behind the cabinet's loading animation; it fades in only once both the
// camera has arrived and the game is ready, so the visitor never sees a blank frame.
import { useEffect, useRef, useState } from 'react'
import { probeCanvasFrames } from '../bridge/probe'
import { parseGameMessage, sendToGame } from '../bridge/protocol'
import { createReadiness, type Readiness } from '../bridge/readiness'
import type { Slot } from '../config/games'
import { mapKey } from '../input/hotkeys'
import { lobbyStore, useLobby, type Phase } from '../state/store'

const REVEAL_TIMEOUT_MS = 15000
const FADE_OUT_MS = 220

/** Fired on the lobby window for any input inside the game (exit button, idle timer). */
export const GAME_ACTIVITY = 'lobby:game-activity'
const ACTIVITY_EVENTS = ['pointerdown', 'pointermove', 'keydown', 'touchstart', 'wheel'] as const

type GameSlot = Extract<Slot, { kind: 'game' }>

function Frame({ slot, phase }: { slot: GameSlot; phase: Phase }) {
  const ref = useRef<HTMLIFrameElement>(null)
  const readiness = useRef<Readiness | null>(null)
  const [gone, setGone] = useState(false)
  const revealed = phase === 'playing'

  useEffect(() => {
    const iframe = ref.current!
    const r = createReadiness({ timeoutMs: REVEAL_TIMEOUT_MS, revealDelayMs: slot.game.revealDelayMs ?? 0 })
    readiness.current = r
    r.result.then(() => lobbyStore.getState().markGameReady())

    const onMessage = (e: MessageEvent) => {
      const msg = parseGameMessage(e, location.origin, iframe.contentWindow)
      if (msg?.type === 'clickable:ready') r.messageReady()
      if (msg?.type === 'clickable:exit') lobbyStore.getState().requestExit()
    }
    window.addEventListener('message', onMessage)
    return () => {
      r.dispose()
      window.removeEventListener('message', onMessage)
    }
  }, [slot])

  const onLoad = () => {
    const iframe = ref.current
    if (!iframe || gone) return
    readiness.current?.loaded(() => probeCanvasFrames(iframe))
    const activity = () => window.dispatchEvent(new Event(GAME_ACTIVITY))
    const onKey = (e: KeyboardEvent) => {
      const s = lobbyStore.getState()
      if (mapKey(e.key, s.phase, e.repeat)?.type === 'exit') {
        e.preventDefault()
        s.requestExit()
      }
    }
    try {
      const win = iframe.contentWindow!
      win.addEventListener('keydown', onKey)
      for (const type of ACTIVITY_EVENTS) win.addEventListener(type, activity, { passive: true })
    } catch {
      // not same-origin: the game must use clickable:exit, and the corner button still works
    }
  }

  useEffect(() => {
    if (phase !== 'playing') return
    const iframe = ref.current
    const win = iframe?.contentWindow
    sendToGame(win, { type: 'clickable:visible' }, location.origin)
    sendToGame(win, { type: 'clickable:mute', muted: lobbyStore.getState().muted }, location.origin)
    iframe?.focus()
    // in plain fullscreen Chrome leaves fullscreen on Esc; keyboard lock keeps Esc for us
    const keyboard = (navigator as Navigator & { keyboard?: { lock?: (keys: string[]) => Promise<void> } }).keyboard
    if (document.fullscreenElement) keyboard?.lock?.(['Escape']).catch(() => {})
  }, [phase])

  useEffect(() => {
    if (phase !== 'exiting') return
    const t = setTimeout(() => {
      // blank first so the game stops its audio and GPU work before the node goes away
      if (ref.current) ref.current.src = 'about:blank'
      setGone(true)
      window.focus()
    }, FADE_OUT_MS)
    return () => clearTimeout(t)
  }, [phase])

  if (gone) return null
  return (
    <iframe
      ref={ref}
      className="game-frame"
      data-testid="game-frame"
      data-revealed={revealed}
      src={slot.url}
      title={slot.game.title}
      allow="autoplay; fullscreen; gamepad"
      onLoad={onLoad}
      style={{ opacity: revealed ? 1 : 0, pointerEvents: revealed ? 'auto' : 'none' }}
    />
  )
}

export default function GameFrame() {
  const slot = useLobby((s) => (s.openSlot === null ? null : s.slots[s.openSlot]))
  const phase = useLobby((s) => s.phase)
  if (!slot || slot.kind !== 'game') return null
  return <Frame key={slot.key} slot={slot} phase={phase} />
}
