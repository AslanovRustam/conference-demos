import { AnimatePresence, motion } from 'motion/react'
import { useState } from 'react'
import { useGame } from '../game/store'
import { S } from '../strings'
import { formatMult } from './format'

interface Chip {
  id: number
  key: string // `${crash}:${won}`
  crash: number
  won: boolean
}

interface Strip {
  joined: string
  chips: Chip[]
  seq: number
}

const keyOf = (h: { crash: number; won: boolean }) => `${h.crash}:${h.won ? 1 : 0}`

// keep ids of chips that survived the shift so only the new ones animate in.
// the selector string changed, so at least one round was added at the front
function next(prev: Strip, joined: string): Strip {
  const keys = joined ? joined.split(' ') : []
  const old = prev.chips
  let k = old.length ? 1 : keys.length
  while (k < keys.length && !keys.slice(k).every((key, i) => old[i]?.key === key)) k++
  let seq = prev.seq
  const chips = keys.map((key, i) => {
    if (i >= k) return old[i - k]
    const [crash, won] = key.split(':')
    return { id: seq++, key, crash: Number(crash), won: won === '1' }
  })
  return { joined, chips, seq }
}

// last rounds, newest first: white when the player cashed out, red when the rocket took the bet
export function History() {
  // the snapshot rebuilds the array every frame, so select a string that only changes per round
  const joined = useGame((s) => s.snap.history.map(keyOf).join(' '))
  const [strip, setStrip] = useState(() => next({ joined: '', chips: [], seq: 0 }, joined))
  if (strip.joined !== joined) setStrip(next(strip, joined))

  return (
    <div className="hud-history" aria-label={S.aria.history}>
      <ul className="chips">
        <AnimatePresence initial={false} mode="popLayout">
          {strip.chips.map((c) => (
            <motion.li
              key={c.id}
              layout="position"
              className="chip"
              data-lost={!c.won || undefined}
              initial={{ opacity: 0, x: -18 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
            >
              {formatMult(c.crash)}
              <span className="chip-x">{S.times}</span>
            </motion.li>
          ))}
        </AnimatePresence>
      </ul>
    </div>
  )
}
