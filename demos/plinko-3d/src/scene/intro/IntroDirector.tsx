import { useFrame } from '@react-three/fiber';
import { useEffect, useRef } from 'react';
import { introStore } from '../../intro/introStore';
import { isEmbed, postReady } from '../../platform/embed';
import { useSim } from '../../sim/SimProvider';
import { fxHooks } from '../fxStore';
import { useGame } from '../../state/store';
import { crystalFrame } from './crystalFrame';

const EMBED = isEmbed(location.search);
const READY_FRAMES = 4; // после стольких кадров сцена точно скомпилирована и видна

/** Ведёт интро: готовность для заставки и лобби, звуки и вспышки по фазам, переход в игру. */
export function IntroDirector(): null {
  const { bus, store } = useSim();
  const rows = useGame((s) => s.rows);
  const fontsReady = useRef(false);
  const frames = useRef(0);
  const fired = useRef({ crack: false, shatter: false, done: false });

  useEffect(() => {
    void document.fonts.ready.then(() => {
      fontsReady.current = true;
    });
  }, []);

  useFrame(({ size }) => {
    const intro = introStore.getState();
    if (!intro.ready) {
      frames.current++;
      if (fontsReady.current && frames.current >= READY_FRAMES) {
        intro.setReady();
        if (EMBED) postReady();
      }
    }
    intro.tick();
    const { phase } = intro.phaseNow();
    const f = fired.current;
    if (phase !== 'crystal' && !f.crack) {
      f.crack = true;
      bus.emit('intro:crack', {});
    }
    if ((phase === 'explode' || phase === 'assemble' || phase === 'gems' || phase === 'done') && !f.shatter) {
      f.shatter = true;
      bus.emit('intro:shatter', {});
      const { cx, cy } = crystalFrame(rows, size);
      fxHooks.pulse?.(1.2, 0.006, 0.9);
      fxHooks.shake?.(0.25, 0.7);
      fxHooks.burst?.(cx, cy, 120, 2);
    }
    if (phase === 'done' && !f.done) {
      f.done = true;
      store.getState().setMode('play');
      bus.emit('intro:done', {});
    }
  });
  return null;
}
