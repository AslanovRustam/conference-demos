import { brandLogo } from '@brand/tokens'
import { useProgress } from '@react-three/drei'
import { AnimatePresence, motion } from 'motion/react'
import { useEffect, useState } from 'react'

const MIN_SHOW_MS = 700

/** Covers the hall until the scene assets, the brand fonts and `prepare` (manifest + slots) are ready. */
export default function LoadingScreen({ prepare }: { prepare: () => Promise<void> }) {
  const { active, progress } = useProgress()
  const [prepared, setPrepared] = useState(false)

  useEffect(() => {
    let alive = true
    Promise.all([prepare(), document.fonts.ready, new Promise((r) => setTimeout(r, MIN_SHOW_MS))]).then(() => alive && setPrepared(true))
    return () => {
      alive = false
    }
  }, [prepare])

  const done = prepared && !active
  const shown = done ? 100 : Math.max(12, Math.min(95, progress))

  return (
    <AnimatePresence>
      {!done && (
        <motion.div className="loading" data-testid="loading" initial={{ opacity: 1 }} exit={{ opacity: 0, transition: { duration: 0.7 } }}>
          <img className="loading-logo" src={brandLogo.red} alt="Clickable" />
          <div className="loading-bar">
            <motion.div className="loading-fill" animate={{ width: `${shown}%` }} transition={{ ease: 'easeOut', duration: 0.4 }} />
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
