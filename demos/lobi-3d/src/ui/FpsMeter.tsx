import { useEffect, useState } from 'react'
import { useLobby } from '../state/store'

/** Presenter FPS readout. Counts frames of the page's main thread, so it also measures the open game. */
export default function FpsMeter() {
  const show = useLobby((s) => s.showFps)
  const [fps, setFps] = useState(0)

  useEffect(() => {
    if (!show) return
    let frames = 0
    let last = performance.now()
    let raf = requestAnimationFrame(function tick(now) {
      frames++
      if (now - last >= 500) {
        setFps(Math.round((frames * 1000) / (now - last)))
        frames = 0
        last = now
      }
      raf = requestAnimationFrame(tick)
    })
    return () => cancelAnimationFrame(raf)
  }, [show])

  if (!show) return null
  return (
    <div className="fps" data-testid="fps">
      {fps} FPS
    </div>
  )
}
