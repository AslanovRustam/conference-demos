import { animate, AnimatePresence, motion } from 'motion/react'
import { useEffect, useRef, useState } from 'react'
import { runtime } from '../game/runtime'
import { vibrate } from '../platform/haptics'
import { formatCredits } from './format'

const COUNT_S = 0.9
const HOLD_S = 2.2

// the cash-out payout punching in: counts up from 0 in Clickable Black with a springy scale
export function WinBurst() {
  const [burst, setBurst] = useState<{ id: number; payout: number } | null>(null)
  const num = useRef<HTMLSpanElement>(null)

  useEffect(() => {
    let hide = 0
    const off = runtime.emitter.on((e) => {
      if (e.type === 'cashout') {
        vibrate(40)
        setBurst({ id: performance.now(), payout: e.payout })
        clearTimeout(hide)
        hide = window.setTimeout(() => setBurst(null), HOLD_S * 1000)
      } else if (e.type === 'betting') {
        setBurst(null)
      }
    })
    return () => {
      off()
      clearTimeout(hide)
    }
  }, [])

  useEffect(() => {
    if (!burst) return
    const controls = animate(0, burst.payout, {
      duration: COUNT_S,
      ease: [0.16, 1, 0.3, 1],
      onUpdate: (v) => {
        if (num.current) num.current.textContent = formatCredits(Math.round(v))
      },
    })
    return () => controls.stop()
  }, [burst])

  return (
    <div className="hud-center hud-winburst" aria-live="polite">
      <AnimatePresence>
        {burst && (
          <motion.div
            key={burst.id}
            className="winburst"
            initial={{ opacity: 0, scale: 0.6 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, y: -24, transition: { duration: 0.35, ease: 'easeIn' } }}
            transition={{ type: 'spring', stiffness: 420, damping: 16 }}
          >
            +<span ref={num}>0</span>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
