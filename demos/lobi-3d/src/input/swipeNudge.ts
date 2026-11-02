// On a touch screen nothing says the carousel turns: until the visitor first browses, it gives a
// small turn toward the next cabinet and springs back, once soon after the lobby appears and
// once more a while later. Any touch or key cancels it and puts the carousel back on its slot.
import gsap from 'gsap'
import { useEffect } from 'react'
import { lobbyStore } from '../state/store'

const FIRST_MS = 1400
const AGAIN_MS = 9000
/** how far toward the next slot the carousel leans, in slots */
const LEAN = 0.28

export function useSwipeNudge(active: boolean): void {
  useEffect(() => {
    if (!active) return
    const proxy = { v: 0 }
    let base = 0
    let tl: gsap.core.Timeline | null = null

    const nudge = () => {
      const s = lobbyStore.getState()
      if (s.phase !== 'lobby' || s.attract) return
      base = Math.round(s.carouselTarget)
      proxy.v = 0
      tl = gsap
        .timeline({ onUpdate: () => lobbyStore.getState().dragTo(base + proxy.v), onComplete: () => void (tl = null) })
        .to(proxy, { v: LEAN, duration: 0.55, ease: 'power2.out' })
        .to(proxy, { v: 0, duration: 1.1, ease: 'elastic.out(1, 0.45)' })
    }
    const timers = [setTimeout(nudge, FIRST_MS), setTimeout(nudge, AGAIN_MS)]

    // capture phase: the drag that may follow must start from the slot, not from mid-lean
    const cancel = () => {
      timers.forEach(clearTimeout)
      if (tl) {
        tl.kill()
        tl = null
        lobbyStore.getState().dragTo(base)
      }
    }
    window.addEventListener('pointerdown', cancel, true)
    window.addEventListener('keydown', cancel, true)
    return () => {
      cancel()
      window.removeEventListener('pointerdown', cancel, true)
      window.removeEventListener('keydown', cancel, true)
    }
  }, [active])
}
