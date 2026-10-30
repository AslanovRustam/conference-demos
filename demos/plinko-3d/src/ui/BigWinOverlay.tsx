import { AnimatePresence, animate, motion, type AnimationPlaybackControls } from 'motion/react';
import { useCallback, useEffect, useRef, useState } from 'react';
import { formatCredits } from '../core/format';
import type { CelebrateKind } from '../core/types';
import { useSim } from '../sim/SimProvider';
import { S } from '../strings';

const COUNT_SECONDS: Record<CelebrateKind, number> = { big: 3, mega: 5, total: 3 };
const TITLE: Record<CelebrateKind, string> = { big: S.bigWin, mega: S.megaWin, total: S.totalWin };
const HOLD_AFTER_COUNT = 1.5;
const HOLD_AFTER_SKIP = 1.2;
const TICK_MS = 50; // не чаще 20 раз в секунду

interface Scene {
  id: number;
  kind: CelebrateKind;
  amount: number;
}

export function BigWinOverlay() {
  const { bus } = useSim();
  const [scene, setScene] = useState<Scene | null>(null);
  const [shown, setShown] = useState(0);
  const counter = useRef<AnimationPlaybackControls | null>(null);
  const endTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const sceneRef = useRef<Scene | null>(null);
  const skipped = useRef(false);

  const finish = useCallback(
    (delaySec: number) => {
      if (endTimer.current) clearTimeout(endTimer.current);
      endTimer.current = setTimeout(() => {
        const s = sceneRef.current;
        sceneRef.current = null;
        setScene(null);
        if (s) bus.emit('celebrate:end', { kind: s.kind });
      }, delaySec * 1000);
    },
    [bus],
  );

  useEffect(
    () =>
      bus.on('celebrate:start', (e) => {
        const s = { id: Date.now(), kind: e.kind, amount: e.amount };
        sceneRef.current = s;
        skipped.current = false;
        setScene(s);
        setShown(0);
        counter.current?.stop();
        let lastTick = 0;
        counter.current = animate(0, e.amount, {
          duration: COUNT_SECONDS[e.kind],
          ease: [0.2, 0.6, 0.35, 1],
          onUpdate: (v) => {
            setShown(v);
            const now = performance.now();
            if (now - lastTick > TICK_MS) {
              lastTick = now;
              bus.emit('celebrate:tick', {});
            }
          },
        });
        finish(COUNT_SECONDS[e.kind] + HOLD_AFTER_COUNT);
      }),
    [bus, finish],
  );

  // Празднование закрыли снаружи (выход из attract посреди демо-выигрыша): убираем оверлей молча
  useEffect(
    () =>
      bus.on('celebrate:end', () => {
        if (!sceneRef.current) return;
        sceneRef.current = null;
        counter.current?.stop();
        if (endTimer.current) clearTimeout(endTimer.current);
        setScene(null);
      }),
    [bus],
  );

  useEffect(
    () => () => {
      counter.current?.stop();
      if (endTimer.current) clearTimeout(endTimer.current);
    },
    [],
  );

  const skip = () => {
    const s = sceneRef.current;
    if (!s || skipped.current) return;
    skipped.current = true;
    counter.current?.stop();
    setShown(s.amount);
    finish(HOLD_AFTER_SKIP);
  };

  return (
    <AnimatePresence>
      {scene && (
        <motion.div
          key={scene.id}
          className={`celebrate ${scene.kind}`}
          data-testid="celebrate-overlay"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0, transition: { duration: 0.4 } }}
          onPointerDown={(e) => {
            e.stopPropagation();
            skip();
          }}
        >
          <motion.div
            className="celebrate-title"
            initial={{ scale: 0.3, opacity: 0, rotate: -6 }}
            animate={{ scale: 1, opacity: 1, rotate: 0 }}
            transition={{ type: 'spring', stiffness: 260, damping: 14 }}
          >
            {TITLE[scene.kind]}
          </motion.div>
          <motion.div
            className="celebrate-amount"
            initial={{ y: 20, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ delay: 0.2, type: 'spring', stiffness: 200, damping: 18 }}
          >
            {formatCredits(Math.round(shown))}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
