// The open game, in a same-origin iframe over the canvas. It stays invisible while the camera
// flies in and loads behind the cabinet's loading animation; it fades in only once both the
// camera has arrived and the game is ready, so the visitor never sees a blank frame.
import { useEffect, useRef, useState } from 'react'
import { probeCanvasFrames } from '../bridge/probe'
import { parseGameMessage, revealMessages, sendToGame } from '../bridge/protocol'
import { createReadiness, type Readiness } from '../bridge/readiness'
import type { Slot } from '../config/games'
import { config } from '../config/lobbyConfig'
import { mapKey } from '../input/hotkeys'
import { createIdleTimer } from '../input/idle'
import { params } from '../state/params'
import { lobbyStore, useLobby } from '../state/store'

const REVEAL_TIMEOUT_MS = 15000
/** iframe opacity transition; the frame is blanked when it has fully faded (transitionend) */
const FADE_MS = 250
/** in case transitionend never arrives */
const FADE_SAFETY_MS = FADE_MS + 1500

/** Fired on the lobby window for any input inside the game (feeds the idle-return timer). */
export const GAME_ACTIVITY = 'lobby:game-activity'
const ACTIVITY_EVENTS = ['pointerdown', 'pointermove', 'keydown', 'touchstart', 'wheel'] as const

type GameSlot = Extract<Slot, { kind: 'game' }>

interface FrameProps {
  slot: GameSlot
  /** the camera has arrived and the game is ready: fade in */
  revealed: boolean
  /** the visitor left: fade out, blank, then onGone — independent of how fast the camera flies back */
  closing: boolean
  onGone: () => void
}

function Frame({ slot, revealed, closing, onGone }: FrameProps) {
  const ref = useRef<HTMLIFrameElement>(null)
  const readiness = useRef<Readiness | null>(null)

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
    if (!iframe || closing) return
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
      // not same-origin: the game must use clickable:exit
    }
  }

  useEffect(() => {
    if (!revealed) return
    const iframe = ref.current
    const win = iframe?.contentWindow
    for (const msg of revealMessages(slot.game, lobbyStore.getState().muted)) sendToGame(win, msg, location.origin)
    iframe?.focus()
    // in plain fullscreen Chrome leaves fullscreen on Esc; keyboard lock keeps Esc for us
    const keyboard = (navigator as Navigator & { keyboard?: { lock?: (keys: string[]) => Promise<void> } }).keyboard
    if (document.fullscreenElement) keyboard?.lock?.(['Escape']).catch(() => {})
  }, [revealed])

  // a visitor who walked away mid-game: back to the lobby, straight into attract mode
  useEffect(() => {
    if (!revealed) return
    const sec = params.idleReturnSec ?? slot.game.idleReturnSec ?? config.idleReturnSec
    if (!sec) return
    const idle = createIdleTimer(sec * 1000, () => lobbyStore.getState().requestExit(true))
    const poke = () => idle.poke()
    idle.start()
    window.addEventListener(GAME_ACTIVITY, poke)
    window.addEventListener('pointermove', poke)
    return () => {
      idle.stop()
      window.removeEventListener(GAME_ACTIVITY, poke)
      window.removeEventListener('pointermove', poke)
    }
  }, [revealed, slot])

  // keep the game's sound in step with the lobby's mute while it is on screen
  useEffect(() => {
    if (!revealed) return
    return lobbyStore.subscribe((s, prev) => {
      if (s.muted !== prev.muted) sendToGame(ref.current?.contentWindow, { type: 'clickable:mute', muted: s.muted }, location.origin)
    })
  }, [revealed])

  useEffect(() => {
    if (!closing) return
    const iframe = ref.current
    let done = false
    const finish = () => {
      if (done) return
      done = true
      // blank first so the game stops its audio and GPU work before the node goes away
      if (ref.current) ref.current.src = 'about:blank'
      window.focus()
      onGone()
    }
    // Blank on transitionend, not on a fixed timer: with a busy main thread the timer can fire
    // before the browser has even started the fade, and the game would flash out mid-frame.
    const onEnd = (e: TransitionEvent) => {
      if (e.propertyName === 'opacity') finish()
    }
    iframe?.addEventListener('transitionend', onEnd)
    // never revealed (exit during the flight): nothing to fade; otherwise a safety net only
    const visible = iframe ? parseFloat(getComputedStyle(iframe).opacity) > 0.01 : false
    const safety = setTimeout(finish, visible ? FADE_SAFETY_MS : 0)
    return () => {
      clearTimeout(safety)
      iframe?.removeEventListener('transitionend', onEnd)
    }
  }, [closing]) // eslint-disable-line react-hooks/exhaustive-deps

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
      style={{ opacity: revealed ? 1 : 0, pointerEvents: revealed ? 'auto' : 'none', transition: `opacity ${FADE_MS}ms ease` }}
    />
  )
}

export default function GameFrame() {
  const open = useLobby((s) => (s.openSlot === null ? null : s.slots[s.openSlot]))
  const entry = useLobby((s) => s.entryToken)
  const phase = useLobby((s) => s.phase)
  // the frame outlives the store's open slot until it has faded out on its own
  const [frame, setFrame] = useState<{ slot: GameSlot; entry: number } | null>(null)
  if (open?.kind === 'game' && frame?.entry !== entry && (phase === 'entering' || phase === 'playing')) setFrame({ slot: open, entry })
  if (!frame) return null

  const live = frame.entry === entry && (phase === 'entering' || phase === 'playing')
  return (
    <Frame
      key={frame.entry}
      slot={frame.slot}
      revealed={live && phase === 'playing'}
      closing={!live}
      onGone={() => setFrame((f) => (f?.entry === frame.entry ? null : f))}
    />
  )
}
