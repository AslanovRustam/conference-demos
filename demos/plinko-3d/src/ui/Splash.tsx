import { brandLogo } from '@brand/tokens';
import { useProgress } from '@react-three/drei';
import { AnimatePresence, motion } from 'motion/react';
import { useEffect, useState } from 'react';
import { S } from '../strings';

const MIN_SPLASH_MS = 900; // логотип не должен мелькнуть и исчезнуть

export function Splash({ onStart }: { onStart(): void }) {
  const { active, progress } = useProgress();
  const [fontsReady, setFontsReady] = useState(false);
  const [minTime, setMinTime] = useState(false);

  useEffect(() => {
    void document.fonts.ready.then(() => setFontsReady(true));
    const t = setTimeout(() => setMinTime(true), MIN_SPLASH_MS);
    return () => clearTimeout(t);
  }, []);

  const ready = fontsReady && minTime && !active;
  const shown = ready ? 100 : Math.min(95, Math.max(progress, minTime ? 60 : 20));

  return (
    <motion.div
      className="splash"
      data-testid="splash"
      initial={{ opacity: 1 }}
      exit={{ opacity: 0, transition: { duration: 0.5 } }}
      onPointerDown={(e) => {
        e.stopPropagation();
        if (ready) onStart();
      }}
    >
      <motion.img
        className="splash-logo"
        src={brandLogo.red}
        alt="Clickable"
        draggable={false}
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6 }}
      />
      <div className="splash-title">PLINKO</div>
      <AnimatePresence mode="wait">
        {ready ? (
          <motion.div
            key="tap"
            className="splash-tap"
            initial={{ opacity: 0 }}
            animate={{ opacity: [0.45, 1, 0.45] }}
            transition={{ duration: 1.6, repeat: Infinity }}
          >
            {S.tapToPlay}
          </motion.div>
        ) : (
          <motion.div key="bar" className="splash-bar" exit={{ opacity: 0 }}>
            <div style={{ width: `${shown}%` }} />
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}
