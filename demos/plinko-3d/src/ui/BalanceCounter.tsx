import { AnimatePresence, animate, motion } from 'motion/react';
import { useEffect, useRef, useState } from 'react';
import { formatCredits } from '../core/format';
import { useSim } from '../sim/SimProvider';
import { useGame } from '../state/store';
import { S } from '../strings';

export function BalanceCounter() {
  const { bus } = useSim();
  const balance = useGame((s) => s.balance);
  const [shown, setShown] = useState(balance);
  const shownRef = useRef(balance);
  const [refilled, setRefilled] = useState(0);

  useEffect(() => {
    const controls = animate(shownRef.current, balance, {
      duration: 0.6,
      ease: 'easeOut',
      onUpdate: (v) => {
        shownRef.current = v;
        setShown(v);
      },
    });
    return () => controls.stop();
  }, [balance]);

  useEffect(() => bus.on('balance:refill', () => setRefilled((n) => n + 1)), [bus]);

  useEffect(() => {
    if (!refilled) return;
    const t = setTimeout(() => setRefilled(0), 1800);
    return () => clearTimeout(t);
  }, [refilled]);

  return (
    <div className="balance">
      <span className="label">{S.balance}</span>
      <span className="value" data-testid="balance">
        {formatCredits(Math.round(shown))}
      </span>
      <AnimatePresence>
        {refilled > 0 && (
          <motion.span
            key={refilled}
            className="refill"
            initial={{ opacity: 0, y: 6, scale: 0.9 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -6 }}
          >
            {S.refill}
          </motion.span>
        )}
      </AnimatePresence>
    </div>
  );
}
