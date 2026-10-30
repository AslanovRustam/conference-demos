import { AnimatePresence, motion } from 'motion/react';
import { formatMultiplier } from '../core/format';
import { gemColor } from '../scene/palette';
import { useGame } from '../state/store';

export function History() {
  const history = useGame((s) => s.history);
  return (
    <div className="history" data-testid="history">
      <AnimatePresence initial={false}>
        {history.map((h) => (
          <motion.div
            key={h.id}
            layout
            className="chip"
            style={{ background: gemColor(h.multiplier) }}
            initial={{ opacity: 0, scale: 0.4 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.6 }}
            transition={{ type: 'spring', stiffness: 500, damping: 30 }}
          >
            {formatMultiplier(h.multiplier)}
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  );
}
