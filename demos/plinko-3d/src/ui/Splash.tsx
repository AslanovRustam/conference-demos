import { brandLogo } from '@brand/tokens';
import { AnimatePresence, motion } from 'motion/react';
import { useIntro } from '../intro/introStore';
import { S } from '../strings';

/**
 * Поверх 3D-интро: пока сцена грузится, тёмная обложка с логотипом; потом виден кристалл,
 * заголовок и приглашение к тапу. Тап раскалывает кристалл.
 */
export function Splash({ onStart }: { onStart(): void }) {
  const ready = useIntro((s) => s.ready);

  return (
    <motion.div
      className="intro"
      data-testid="splash"
      initial={{ opacity: 1 }}
      exit={{ opacity: 0, transition: { duration: 0.35 } }}
      onPointerDown={(e) => {
        e.stopPropagation();
        if (ready) onStart();
      }}
    >
      <motion.div className="intro-cover" animate={{ opacity: ready ? 0 : 1 }} transition={{ duration: 0.9 }}>
        <img className="intro-cover-logo" src={brandLogo.red} alt="Clickable" draggable={false} />
        <div className="splash-bar">
          <motion.div initial={{ width: '15%' }} animate={{ width: ready ? '100%' : '75%' }} transition={{ duration: ready ? 0.3 : 2.5 }} />
        </div>
      </motion.div>
      <motion.div className="intro-heading" initial={{ opacity: 0, y: -10 }} animate={{ opacity: ready ? 1 : 0, y: ready ? 0 : -10 }} transition={{ duration: 1, delay: 0.2 }}>
        <div className="intro-eyebrow">{S.introEyebrow}</div>
        <div className="intro-title">PLINKO</div>
      </motion.div>
      <AnimatePresence>
        {ready && (
          <motion.div key="tap" className="intro-tap" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.8, delay: 0.7 }}>
            <span>{S.tapToPlay}</span>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}
