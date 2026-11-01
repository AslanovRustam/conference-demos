import { runtime } from './runtime'
import { useGame } from './store'

// raf loop; returns a stop function (safe under StrictMode double mount)
export function startLoop(onFrame: (dtReal: number) => void): () => void {
  let raf = 0
  let last = performance.now()
  let stopped = false
  const frame = (now: number) => {
    if (stopped) return
    const dt = Math.max(0, (now - last) / 1000)
    last = now
    runtime.engine.tick(dt)
    useGame.setState({ snap: runtime.engine.snapshot() })
    onFrame(dt)
    raf = requestAnimationFrame(frame)
  }
  raf = requestAnimationFrame(frame)
  return () => {
    stopped = true
    cancelAnimationFrame(raf)
  }
}
