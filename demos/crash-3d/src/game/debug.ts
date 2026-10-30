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

// screenshots and e2e wait for this: the stage calls it once the scene has loaded and
// 30 frames have rendered; the hud fonts must be in too
export function markReady(): void {
  if (!params.debug) return
  void document.fonts.ready.then(() => {
    window.__crashReady = true
  })
}
