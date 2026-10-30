import { AnimatePresence, motion } from 'motion/react'
import { useEffect, useState } from 'react'
import { runtime } from '../game/runtime'
import { S } from '../strings'

const SHOW_MS = 1500

// REFUELING strip for 1.5 s when the balance is topped up
export function Banner() {
  const [shot, setShot] = useState(0) // 0 = hidden, otherwise a fresh key per refuel

  useEffect(() => {
    let timer = 0
    const off = runtime.emitter.on((e) => {
      if (e.type !== 'refuel') return
      setShot((s) => s + 1)
      window.clearTimeout(timer)
      timer = window.setTimeout(() => setShot(0), SHOW_MS)
    })
    return () => {
      off()
      window.clearTimeout(timer)
    }
  }, [])

  return (
    <div className="hud-center hud-banner" aria-live="polite">
      <AnimatePresence>
        {shot > 0 && (
          <motion.div
            key="refuel"
            className="banner"
            initial={{ opacity: 0, scaleX: 0.92 }}
            animate={{ opacity: 1, scaleX: 1 }}
            exit={{ opacity: 0, transition: { duration: 0.3 } }}
            transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
          >
            <span className="banner-text">{S.refueling}</span>
            <span className="banner-track">
              <motion.span
                key={shot}
                className="banner-fill"
                initial={{ scaleX: 0 }}
                animate={{ scaleX: 1 }}
                transition={{ duration: SHOW_MS / 1000, ease: 'linear' }}
              />
            </span>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
