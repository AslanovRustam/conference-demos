import { useEffect, useState } from 'react'
import { canFullscreen, toggleFullscreen } from '../platform/fullscreen'
import { S } from '../strings'

const isFull = () => !!document.fullscreenElement

// full screen next to the sound toggle, where the page may take it (the lobby's iframe allows it; iphone safari has
// no page full screen). on click, not pointerdown: a touch only lets the page go full screen once the finger lifts
export function FullscreenButton() {
  const [full, setFull] = useState(isFull)
  useEffect(() => {
    const sync = () => setFull(isFull())
    document.addEventListener('fullscreenchange', sync)
    return () => document.removeEventListener('fullscreenchange', sync)
  }, [])
  if (!canFullscreen()) return null
  return (
    <button
      className="hud-icon"
      tabIndex={-1}
      aria-label={full ? S.aria.exitFullscreen : S.aria.fullscreen}
      aria-pressed={full}
      onClick={() => void toggleFullscreen()}
    >
      <svg viewBox="0 0 24 24" aria-hidden>
        <path d={full ? 'M9 4v5H4M15 4v5h5M9 20v-5H4M15 20v-5h5' : 'M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5'} />
      </svg>
    </button>
  )
}
