import { AnimatePresence, motion } from 'motion/react';
import { useEffect } from 'react';
import { useSim } from '../sim/SimProvider';
import { S } from '../strings';

const AUTO_CLOSE_MS = 6000;

/** Скрытая панель ведущего: открывается долгим нажатием на логотип. */
export function PresenterPanel({ open, onClose }: { open: boolean; onClose(): void }) {
  const { controller } = useSim();

  useEffect(() => {
    if (!open) return;
    const t = setTimeout(onClose, AUTO_CLOSE_MS);
    return () => clearTimeout(t);
  }, [open, onClose]);

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          className="presenter"
          initial={{ opacity: 0, y: -8, scale: 0.96 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: -8 }}
          onPointerDown={(e) => e.stopPropagation()}
        >
          <button
            onClick={() => {
              controller.forceBigNext();
              onClose();
            }}
          >
            {S.presenterBig}
          </button>
          <button
            onClick={() => {
              controller.rain({ mode: 'free' });
              onClose();
            }}
          >
            {S.presenterRain}
          </button>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
