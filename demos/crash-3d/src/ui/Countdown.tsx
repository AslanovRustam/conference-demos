import { AnimatePresence, motion } from 'motion/react'
import { useEffect, useState } from 'react'
import { runtime } from '../game/runtime'
import { useGame } from '../game/store'

// big 3, 2, 1 in Clickable Black, driven by countdown events
export function Countdown() {
  const counting = useGame((s) => s.snap.phase === 'countdown')
  const [n, setN] = useState<number | null>(null)

  useEffect(
    () =>
      runtime.emitter.on((e) => {
        if (e.type === 'countdown') setN(e.n)
        else if (e.type === 'liftoff' || e.type === 'betting') setN(null)
      }),
    [],
  )

  return (
    <div className="hud-center hud-countdown" aria-live="assertive">
      <AnimatePresence>
        {counting && n !== null && (
          <motion.div
            key={n}
            className="countdown-num"
            initial={{ opacity: 0, scale: 1.35, filter: 'blur(14px)' }}
            animate={{ opacity: 1, scale: 1, filter: 'blur(0px)' }}
            exit={{ opacity: 0, scale: 0.86, filter: 'blur(6px)', transition: { duration: 0.28, ease: 'easeIn' } }}
            transition={{ duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
          >
            {n}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
