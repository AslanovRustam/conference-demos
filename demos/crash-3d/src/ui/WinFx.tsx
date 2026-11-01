import { useEffect, useRef } from 'react'
import { createRng, randomSeed } from '../core/rng'
import { runtime } from '../game/runtime'
import { useGame } from '../game/store'
import { creditAt, flashAt, ringAt, spawnWinFx, stepWinFx, WINFX_S, type Point, type WinFx as Fx } from './winFxSim'

const MAX_DT = 1 / 20
const RED = '255, 25, 35'
const WHITE = '246, 243, 238'
const STREAK_S = 0.045 // a spark's tail: where it was this long ago
const TRAIL = 10
const TRAIL_S = 0.014
const MOUNT_FRAMES = 6

const rgb = (hex: string) => (hex === '#ff1923' ? RED : WHITE)

function centre(sel: string, dpr: number): Point | null {
  const el = document.querySelector(sel)
  if (!el) return null
  const r = el.getBoundingClientRect()
  if (!r.width) return null
  return { x: (r.left + r.width / 2) * dpr, y: (r.top + r.height / 2) * dpr }
}

// a four-point star: two thin diamonds across
function star(g: CanvasRenderingContext2D, x: number, y: number, r: number, turn: number) {
  g.save()
  g.translate(x, y)
  g.rotate(turn)
  g.beginPath()
  for (let i = 0; i < 8; i++) {
    const a = (i * Math.PI) / 4
    const d = i % 2 ? r * 0.16 : r
    g.lineTo(Math.cos(a) * d, Math.sin(a) * d)
  }
  g.closePath()
  g.fill()
  g.restore()
}

function draw(g: CanvasRenderingContext2D, fx: Fx, origin: Point) {
  const { age, unit } = fx
  g.globalCompositeOperation = 'lighter'
  g.lineCap = 'round'

  const f = flashAt(age)
  if (f > 0) {
    const grad = g.createRadialGradient(origin.x, origin.y, 0, origin.x, origin.y, unit * 0.45)
    grad.addColorStop(0, `rgba(${WHITE}, ${0.85 * f})`)
    grad.addColorStop(0.3, `rgba(${RED}, ${0.5 * f})`)
    grad.addColorStop(1, `rgba(${RED}, 0)`)
    g.fillStyle = grad
    g.fillRect(origin.x - unit * 0.45, origin.y - unit * 0.45, unit * 0.9, unit * 0.9)
  }

  // the shock rings: soft glowing bands, a little wider than tall like the card
  for (const i of [0, 1]) {
    const r = ringAt(age, i, unit)
    if (r.alpha <= 0) continue
    const inner = Math.max(0, r.radius - r.width)
    const grad = g.createRadialGradient(0, 0, inner, 0, 0, r.radius + r.width)
    const c = i ? RED : WHITE
    grad.addColorStop(0, `rgba(${c}, 0)`)
    grad.addColorStop(0.5, `rgba(${c}, ${0.55 * r.alpha})`)
    grad.addColorStop(1, `rgba(${c}, 0)`)
    g.save()
    g.translate(origin.x, origin.y)
    g.scale(1.25, 1)
    g.fillStyle = grad
    g.beginPath()
    g.arc(0, 0, r.radius + r.width, 0, Math.PI * 2)
    g.fill()
    g.restore()
  }

  // sparks: a faint tail and a bright head, white hot for the first third of their life
  for (const s of fx.sparks) {
    if (s.alpha <= 0) continue
    const tx = s.x - s.vx * STREAK_S
    const ty = s.y - s.vy * STREAK_S
    const mx = (tx + s.x) / 2
    const my = (ty + s.y) / 2
    const c = age < s.life * 0.35 ? WHITE : rgb(s.color)
    g.lineWidth = s.size
    g.strokeStyle = `rgba(${rgb(s.color)}, ${0.35 * s.alpha})`
    g.beginPath()
    g.moveTo(tx, ty)
    g.lineTo(mx, my)
    g.stroke()
    g.strokeStyle = `rgba(${c}, ${s.alpha})`
    g.beginPath()
    g.moveTo(mx, my)
    g.lineTo(s.x, s.y)
    g.stroke()
  }

  for (const gl of fx.glints) {
    if (gl.alpha <= 0) continue
    g.fillStyle = `rgba(${rgb(gl.color)}, ${gl.alpha})`
    star(g, gl.x, gl.y, gl.size * gl.alpha, gl.spin * age)
  }

  // credits: comets, a tapering red tail behind a white head in a soft glow
  for (const c of fx.credits) {
    const head = creditAt(c, age)
    if (head.alpha <= 0) continue
    const w = unit * 0.006
    let prev = head
    for (let k = 1; k <= TRAIL; k++) {
      const p = creditAt(c, Math.max(c.start, age - k * TRAIL_S))
      const fade = 1 - k / (TRAIL + 1)
      g.strokeStyle = `rgba(${RED}, ${0.8 * fade * head.alpha})`
      g.lineWidth = w * fade
      g.beginPath()
      g.moveTo(prev.x, prev.y)
      g.lineTo(p.x, p.y)
      g.stroke()
      prev = p
    }
    const glow = g.createRadialGradient(head.x, head.y, 0, head.x, head.y, w * 4)
    glow.addColorStop(0, `rgba(${RED}, ${0.6 * head.alpha})`)
    glow.addColorStop(1, `rgba(${RED}, 0)`)
    g.fillStyle = glow
    g.fillRect(head.x - w * 4, head.y - w * 4, w * 8, w * 8)
    g.fillStyle = `rgba(${WHITE}, ${head.alpha})`
    g.beginPath()
    g.arc(head.x, head.y, w * 0.7, 0, Math.PI * 2)
    g.fill()
  }
}

// the cash-out burst on a canvas over the scene (ui/winFxSim.ts): it starts once the win card is on screen, from its
// amount, and sends the credits into the balance
export function WinFx() {
  const canvas = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    const rng = createRng(randomSeed())
    let fx: Fx | null = null
    let origin: Point = { x: 0, y: 0 }
    let raf = 0
    let last = 0
    let waited = 0

    const frame = (now: number) => {
      const c = canvas.current
      const g = c?.getContext('2d')
      if (!c || !g) return
      const dt = Math.min(MAX_DT, (now - last) / 1000)
      last = now
      g.globalCompositeOperation = 'source-over'
      g.clearRect(0, 0, c.width, c.height)
      if (!fx) {
        // the burst starts from the card's amount once the card has mounted (a frame or two after the cash out)
        const dpr = c.width / Math.max(1, c.clientWidth)
        const amount = centre('.wincard-amount', dpr)
        if (!amount && waited++ < MOUNT_FRAMES) {
          raf = requestAnimationFrame(frame)
          return
        }
        origin = amount ?? { x: c.width / 2, y: c.height * 0.6 }
        // the idle loop's wins change no balance: no credits
        const target = useGame.getState().snap.attract ? null : centre('.balance-value', dpr)
        fx = spawnWinFx(rng, origin, target, Math.min(c.width, c.height))
      } else {
        stepWinFx(fx, dt)
      }
      draw(g, fx, origin)
      if (fx.age < WINFX_S) raf = requestAnimationFrame(frame)
      else g.clearRect(0, 0, c.width, c.height)
    }

    const off = runtime.emitter.on((e) => {
      const c = canvas.current
      if (!c) return
      if (e.type === 'betting') {
        // play again cuts the burst short with the card
        cancelAnimationFrame(raf)
        c.getContext('2d')?.clearRect(0, 0, c.width, c.height)
        return
      }
      if (e.type !== 'cashout') return
      const dpr = Math.min(2, window.devicePixelRatio || 1)
      c.width = Math.round(c.clientWidth * dpr)
      c.height = Math.round(c.clientHeight * dpr)
      fx = null
      waited = 0
      cancelAnimationFrame(raf)
      last = performance.now()
      raf = requestAnimationFrame(frame)
    })
    return () => {
      off()
      cancelAnimationFrame(raf)
    }
  }, [])

  return <canvas ref={canvas} className="hud-winfx" aria-hidden />
}
