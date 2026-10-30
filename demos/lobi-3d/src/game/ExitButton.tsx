import { AnimatePresence, motion } from 'motion/react'
import { useEffect, useState } from 'react'
import { lobbyStore, useLobby } from '../state/store'
import { showLobbyExitButton } from './exitRules'
import { GAME_ACTIVITY } from './GameFrame'

const HIDE_AFTER_MS = 3000

export default function ExitButton() {
  const phase = useLobby((s) => s.phase)
  const slot = useLobby((s) => (s.openSlot === null ? null : s.slots[s.openSlot]))
  const [visible, setVisible] = useState(false)
  const enabled = slot?.kind === 'game' && showLobbyExitButton(slot.game, phase)

  useEffect(() => {
    if (!enabled) {
      setVisible(false)
      return
    }
    let timer: ReturnType<typeof setTimeout>
    const show = () => {
      setVisible(true)
      clearTimeout(timer)
      timer = setTimeout(() => setVisible(false), HIDE_AFTER_MS)
    }
    window.addEventListener(GAME_ACTIVITY, show)
    window.addEventListener('pointermove', show)
    window.addEventListener('touchstart', show)
    return () => {
      clearTimeout(timer)
      window.removeEventListener(GAME_ACTIVITY, show)
      window.removeEventListener('pointermove', show)
      window.removeEventListener('touchstart', show)
    }
  }, [enabled])

  return (
    <AnimatePresence>
      {enabled && visible && (
        <motion.button
          className="exit-button ck-chamfer"
          data-testid="exit-button"
          initial={{ opacity: 0, x: -12 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: -12 }}
          transition={{ duration: 0.2 }}
          onClick={() => lobbyStore.getState().requestExit()}
        >
          ← LOBBY
        </motion.button>
      )}
    </AnimatePresence>
  )
}
