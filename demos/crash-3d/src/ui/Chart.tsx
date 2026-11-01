import { useEffect, useRef } from 'react'
import { onSnap } from '../game/store'
import { chartPoints, chartTicks, layoutFor, type ViewLayout } from '../scene/camera/crashView'
import { S } from '../strings'
import { formatMult } from './format'

const POINTS = 48
const TICK_SLOTS = 4

// ndc of the crash view to svg pixels (the svg covers the canvas)
const px = (x: number, w: number) => ((x + 1) / 2) * w
const py = (y: number, h: number) => ((1 - y) / 2) * h

// the classic crash chart over the scene: the multiplier curve from the launch point to the rocket riding its tip,
// a red fill under it and round multipliers up the left. both axes rescale as the round goes on
// (scene/camera/crashView.ts); the scene's camera keeps the rocket on the tip
export function Chart() {
  const svg = useRef<SVGSVGElement>(null)
  const line = useRef<SVGPathElement>(null)
  const area = useRef<SVGPathElement>(null)
  const heat = useRef<SVGPathElement>(null)
  const ticks = useRef<(SVGGElement | null)[]>([])

  useEffect(() => {
    let lastKey = ''
    return onSnap((snap) => {
      const el = svg.current
      if (!el || !line.current || !area.current) return
      // after a cash out the camera stays with the capsule: the chart of the rocket bows out
      const shown = snap.phase === 'flight' || (snap.phase === 'crashed' && snap.cashedAt === null)
      el.dataset.state = shown ? (snap.phase === 'crashed' ? 'crashed' : 'live') : 'off'
      if (!shown) return
      const w = el.clientWidth
      const h = el.clientHeight
      const L: ViewLayout = layoutFor(w / Math.max(1, h))
      const key = `${snap.t.toFixed(3)}|${w}|${h}`
      if (key === lastKey) return
      lastKey = key
      const pts = chartPoints(snap.t, POINTS, L)
      const d = pts.map((p, i) => `${i ? 'L' : 'M'}${px(p.x, w).toFixed(1)} ${py(p.y, h).toFixed(1)}`).join(' ')
      line.current.setAttribute('d', d)
      const base = py(L.origin[1], h).toFixed(1)
      const last = pts[pts.length - 1]
      const fill = `${d} L${px(last.x, w).toFixed(1)} ${base} L${px(pts[0].x, w).toFixed(1)} ${base} Z`
      area.current.setAttribute('d', fill)
      heat.current?.setAttribute('d', fill)
      const marks = chartTicks(snap.t, L)
      for (let i = 0; i < TICK_SLOTS; i++) {
        const g = ticks.current[i]
        if (!g) continue
        const tick = marks[i]
        g.style.opacity = tick ? '1' : '0'
        if (!tick) continue
        g.setAttribute('transform', `translate(0 ${py(tick.y, h).toFixed(1)})`)
        const text = g.querySelector('text')
        const label = `${formatMult(tick.value)}${S.times}`
        if (text && text.textContent !== label) text.textContent = label
        const rule = g.querySelector('line')
        rule?.setAttribute('x1', px(L.origin[0], w).toFixed(1))
        rule?.setAttribute('x2', px(last.x, w).toFixed(1))
        text?.setAttribute('x', (px(L.origin[0], w) - 10).toFixed(1))
      }
    })
  }, [])

  return (
    <svg ref={svg} className="hud-chart" data-state="off" aria-hidden>
      <defs>
        {/* the fill: deep red under the curve fading down, and a second layer lighting up towards the rocket */}
        <linearGradient id="chart-fill" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="var(--red)" stopOpacity="0.5" />
          <stop offset="0.55" stopColor="var(--red)" stopOpacity="0.22" />
          <stop offset="1" stopColor="var(--red)" stopOpacity="0.06" />
        </linearGradient>
        <linearGradient id="chart-heat" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0.3" stopColor="var(--red)" stopOpacity="0" />
          <stop offset="1" stopColor="var(--red)" stopOpacity="0.3" />
        </linearGradient>
      </defs>
      {Array.from({ length: TICK_SLOTS }, (_, i) => (
        <g
          key={i}
          ref={(g) => {
            ticks.current[i] = g
          }}
          className="chart-tick"
        >
          <line y1="0" y2="0" />
          <text dy="0.35em" textAnchor="end" />
        </g>
      ))}
      <path ref={area} className="chart-area" fill="url(#chart-fill)" />
      <path ref={heat} className="chart-area" fill="url(#chart-heat)" />
      <path ref={line} className="chart-line" />
    </svg>
  )
}
