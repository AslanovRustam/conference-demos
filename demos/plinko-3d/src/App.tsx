import { AnimatePresence } from 'motion/react';
import { useCallback, useEffect, useRef, useState } from 'react';
import { bindAudio } from './audio/bindings';
import { createAudioEngine } from './audio/engine';
import { createMusic } from './audio/music';
import { createSfx } from './audio/sfx';
import { IDLE_MS } from './config';
import { seedFromSearch } from './core/rng';
import { isEmbed } from './platform/embed';
import { IdleTimer } from './platform/idle';
import { presenterAction } from './platform/presenter';
import { detectQuality } from './platform/quality';
import { Stage } from './scene/Stage';
import { SimContext, createSim } from './sim/SimProvider';
import { useGame } from './state/store';
import { AttractOverlay } from './ui/AttractOverlay';
import { Hud } from './ui/Hud';
import { PresenterPanel } from './ui/PresenterPanel';
import { Splash } from './ui/Splash';
import { useLongPress } from './ui/useLongPress';

const EMBED = isEmbed(location.search);

export function App() {
  const [sim] = useState(() => createSim({ seed: seedFromSearch(location.search) ?? Date.now() }));
  const mode = useGame((s) => s.mode);

  useEffect(() => {
    if (import.meta.env.DEV) (window as unknown as { __sim: typeof sim }).__sim = sim;
    sim.store.getState().setQuality(detectQuality());
    // В лобби заставка не нужна: игра открывается сразу
    if (EMBED) sim.store.getState().setMode('play');
  }, [sim]);

  // Звук: движок создаётся по первому жесту, mute синхронизирован со стором
  const [audio] = useState(() => createAudioEngine());
  useEffect(() => {
    const sfx = createSfx(audio);
    const music = createMusic(audio);
    const offAudio = bindAudio(sim.bus, sfx, music);
    audio.setMuted(sim.store.getState().muted);
    const offMuted = sim.store.subscribe((s, prev) => {
      if (s.muted !== prev.muted) audio.setMuted(s.muted);
    });
    const unlock = () => void audio.unlock().then(() => music.start());
    window.addEventListener('pointerdown', unlock, { capture: true });
    window.addEventListener('keydown', unlock, { capture: true });
    return () => {
      music.stop();
      offAudio();
      offMuted();
      window.removeEventListener('pointerdown', unlock, { capture: true });
      window.removeEventListener('keydown', unlock, { capture: true });
    };
  }, [audio, sim]);

  // Режим ведущего: долгое нажатие на логотип или Shift+B / Shift+R
  const [presenterOpen, setPresenterOpen] = useState(false);
  const presenterOpenRef = useRef(false);
  presenterOpenRef.current = presenterOpen;
  const closePresenter = useCallback(() => setPresenterOpen(false), []);
  const logoPress = useLongPress(() => setPresenterOpen(true));

  // Пробел бросает шарик, но только в режиме игры
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const action = presenterAction(e);
      if (action === 'forceBig') return sim.controller.forceBigNext();
      if (action === 'freeRain') return sim.controller.rain({ mode: 'free' });
      if (e.code !== 'Space' || e.repeat || sim.store.getState().mode !== 'play') return;
      e.preventDefault();
      sim.controller.drop();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [sim]);

  // Attract: через 45 с без ввода игра играет сама; первое касание возвращает в игру и само шарик не бросает
  useEffect(() => {
    const idle = new IdleTimer(IDLE_MS, () => performance.now());
    let swallowClick = false;
    const onInput = (e: Event) => {
      idle.poke();
      if (sim.store.getState().mode !== 'attract') return;
      sim.store.getState().setMode('play');
      e.preventDefault();
      e.stopPropagation();
      swallowClick = e.type === 'pointerdown';
    };
    const onClick = (e: Event) => {
      if (!swallowClick) return;
      swallowClick = false;
      e.preventDefault();
      e.stopPropagation();
    };
    window.addEventListener('pointerdown', onInput, { capture: true });
    window.addEventListener('keydown', onInput, { capture: true });
    window.addEventListener('click', onClick, { capture: true });
    const check = setInterval(() => {
      const s = sim.store.getState();
      if (s.mode === 'play' && idle.isIdle() && s.inFlight === 0 && !sim.controller.celebrating && !presenterOpenRef.current) {
        s.setMode('attract');
      }
    }, 1000);
    return () => {
      clearInterval(check);
      window.removeEventListener('pointerdown', onInput, { capture: true });
      window.removeEventListener('keydown', onInput, { capture: true });
      window.removeEventListener('click', onClick, { capture: true });
    };
  }, [sim]);

  return (
    <SimContext.Provider value={sim}>
      <div
        style={{ position: 'absolute', inset: 0 }}
        onPointerDown={(e) => {
          // Тап по пирамиде, а не по интерфейсу
          if (e.target instanceof HTMLCanvasElement && sim.store.getState().mode === 'play') sim.controller.drop();
        }}
      >
        <Stage />
      </div>
      <Hud logoProps={logoPress}>
        <PresenterPanel open={presenterOpen} onClose={closePresenter} />
      </Hud>
      <AnimatePresence>{mode === 'attract' && <AttractOverlay key="attract" />}</AnimatePresence>
      <AnimatePresence>
        {mode === 'splash' && <Splash key="splash" onStart={() => sim.store.getState().setMode('play')} />}
      </AnimatePresence>
    </SimContext.Provider>
  );
}
