import type { PointerEvent } from 'react'
import { toggleMute, useGame } from '../game/store'
import { S } from '../strings'

// small speaker toggle next to the logo; the M key does the same
export function MuteButton() {
  const muted = useGame((s) => s.muted)
  const onDown = (e: PointerEvent<HTMLButtonElement>) => {
    if (e.button !== 0) return
    e.preventDefault()
    toggleMute()
  }
  return (
    <button
      className="hud-mute"
      tabIndex={-1}
      aria-label={muted ? S.aria.unmute : S.aria.mute}
      aria-pressed={muted}
      data-muted={muted || undefined}
      onPointerDown={onDown}
    >
      <svg viewBox="0 0 24 24" aria-hidden>
        <path className="mute-body" d="M4 9.5h3.2L12 5.5v13l-4.8-4H4z" />
        {muted ? (
          <path d="M16 9.5l5 5M21 9.5l-5 5" />
        ) : (
          <>
            <path d="M15.6 9.2a4 4 0 0 1 0 5.6" />
            <path d="M18.4 6.6a7.6 7.6 0 0 1 0 10.8" />
          </>
        )}
      </svg>
    </button>
  )
}
