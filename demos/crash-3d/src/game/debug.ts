import type { RoundSnapshot } from '../core/types'
import { params } from '../platform/params'
import { runtime } from './runtime'

declare global {
  interface Window {
    __crash?: { snap: () => RoundSnapshot; setNextCrash: (x: number) => void }
    __crashReady?: boolean
  }
}

// debug api exists only with ?debug=1
export function installDebug(): void {
  if (!params.debug) return
  window.__crash = {
    snap: () => runtime.engine.snapshot(),
    setNextCrash: (x) => runtime.engine.setNextCrash(x),
  }
}

// provisional (ruling R2): the hud marks the page ready for screenshots once fonts are in;
// task 6 moves this to "scene loaded"
export function markReady(): void {
  if (!params.debug) return
  // one frame so the first layout has requested its fonts
  requestAnimationFrame(() =>
    document.fonts.ready.then(() => {
      window.__crashReady = true
    }),
  )
}
