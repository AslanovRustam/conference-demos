import { useMemo } from 'react'

export type MetalTone = 'gold' | 'ruby' | 'platinum' | 'jackpot'

/**
 * Slot-style lettering in three stacked copies of the same text: a dark extruded edge,
 * a polished metal face and a light sweep running across it.
 */
export function MetalText({ text, tone = 'gold', flat = false, className = '' }: { text: string; tone?: MetalTone; flat?: boolean; className?: string }) {
  return (
    <span className={`metal metal--${tone}${flat ? ' metal--flat' : ''} ${className}`} role="text" aria-label={text}>
      <span className="metal-depth" aria-hidden>
        {text}
      </span>
      <span className="metal-face" aria-hidden>
        {text}
      </span>
      <span className="metal-shine" aria-hidden>
        {text}
      </span>
    </span>
  )
}

/** four-point stars twinkling around a title */
export function Sparkles({ count = 12, seed = 1 }: { count?: number; seed?: number }) {
  const stars = useMemo(() => {
    let s = seed * 9301 + 49297
    const rnd = () => ((s = (s * 9301 + 49297) % 233280) / 233280)
    return Array.from({ length: count }, (_, i) => {
      // spread round the edge of the title box rather than over the letters
      const side = i % 4
      const t = rnd()
      const x = side === 0 ? t : side === 1 ? 1 : side === 2 ? t : 0
      const y = side === 0 ? 0 : side === 1 ? t : side === 2 ? 1 : t
      return {
        left: `${(x * 112 - 6).toFixed(1)}%`,
        top: `${(y * 120 - 10).toFixed(1)}%`,
        size: `${(0.12 + rnd() * 0.16).toFixed(2)}em`,
        delay: `${(rnd() * 1.8).toFixed(2)}s`,
        duration: `${(1.2 + rnd() * 1.1).toFixed(2)}s`,
      }
    })
  }, [count, seed])
  return (
    <span className="sparkles" aria-hidden>
      {stars.map((st, i) => (
        <svg key={i} className="sparkle" viewBox="0 0 24 24" style={{ left: st.left, top: st.top, width: st.size, height: st.size, animationDelay: st.delay, animationDuration: st.duration }}>
          <path d="M12 0C12.8 7.6 16.4 11.2 24 12C16.4 12.8 12.8 16.4 12 24C11.2 16.4 7.6 12.8 0 12C7.6 11.2 11.2 7.6 12 0Z" fill="currentColor" />
        </svg>
      ))}
    </span>
  )
}
