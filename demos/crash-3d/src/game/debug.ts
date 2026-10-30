import type { RoundSnapshot } from '../core/types'
import { params } from '../platform/params'
import { runtime } from './runtime'

declare global {
  interface Window {
    __crash?: { snap: () => RoundSnapshot; setNextCrash: (x: number) => void }
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
