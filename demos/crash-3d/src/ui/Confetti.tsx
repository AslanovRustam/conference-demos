import { useEffect, useRef } from 'react'
import { createRng, randomSeed } from '../core/rng'
import { runtime } from '../game/runtime'
import { CONFETTI_S, spawnConfetti, stepConfetti, type ConfettiPiece } from './confettiSim'

const MAX_DT = 1 / 20

// a short red and white burst on every cash out, on a canvas over the scene
export function Confetti() {
  const canvas = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    const rng = createRng(randomSeed())
    let parts: ConfettiPiece[] = []
    let raf = 0
    let last = 0

    const frame = (now: number) => {
      const c = canvas.current
      const g = c?.getContext('2d')
      if (!c || !g) return
      const dt = Math.min(MAX_DT, (now - last) / 1000)
      last = now
      stepConfetti(parts, dt, c.height)
      g.clearRect(0, 0, c.width, c.height)
      for (const p of parts) {
        if (p.alpha <= 0) continue
        g.save()
        g.globalAlpha = p.alpha
        g.translate(p.x, p.y)
        g.rotate(p.angle)
        // the paper turning over: its width swings through zero
        g.scale(Math.cos(p.flip), 1)
        g.fillStyle = p.color
        g.fillRect(-p.size, -p.size * 0.6, p.size * 2, p.size * 1.2)
        g.restore()
      }
      if (parts.length && parts[0].age < CONFETTI_S) raf = requestAnimationFrame(frame)
      else g.clearRect(0, 0, c.width, c.height)
    }

    const off = runtime.emitter.on((e) => {
      if (e.type !== 'cashout') return
      const c = canvas.current
      if (!c) return
      const dpr = Math.min(2, window.devicePixelRatio || 1)
      c.width = Math.round(c.clientWidth * dpr)
      c.height = Math.round(c.clientHeight * dpr)
      parts = spawnConfetti(rng, c.width, c.height)
      cancelAnimationFrame(raf)
      last = performance.now()
      raf = requestAnimationFrame(frame)
    })
    return () => {
      off()
      cancelAnimationFrame(raf)
    }
  }, [])

  return <canvas ref={canvas} className="hud-confetti" aria-hidden />
}
