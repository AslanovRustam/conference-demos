import { brandLogo } from '@brand/tokens';
import { motion } from 'motion/react';
import { S } from '../strings';

/** Поверх демо-игры: зовёт подойти и нажать. */
export function AttractOverlay() {
  return (
    <motion.div className="attract" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
      <img className="attract-logo" src={brandLogo.white} alt="Clickable" draggable={false} />
      <motion.div className="attract-tap" animate={{ scale: [1, 1.06, 1], opacity: [0.7, 1, 0.7] }} transition={{ duration: 1.8, repeat: Infinity }}>
        {S.tapToPlay}
      </motion.div>
    </motion.div>
  );
}
