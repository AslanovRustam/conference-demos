import { useFrame } from '@react-three/fiber';
import { useEffect, useRef } from 'react';
import * as THREE from 'three';
import { introStore } from '../../intro/introStore';
import { stepReadiness, type ReadyState } from '../../intro/readiness';
import { isEmbed, postReady } from '../../platform/embed';
import { useSim } from '../../sim/SimProvider';
import { fxHooks } from '../fxStore';
import { useGame } from '../../state/store';
import { crystalFrame } from './crystalFrame';

const EMBED = isEmbed(location.search);

/**
 * Многие instanced-меши получают цвета экземпляров только в момент своего эффекта (взрыв, искры, вспышки).
 * Тогда шейдер перекомпилируется прямо в анимации. Белый цвет заранее ничего не меняет на экране,
 * зато прогрев компилирует сразу окончательный вариант шейдера.
 */
function ensureInstanceColors(scene: THREE.Object3D) {
  scene.traverse((o) => {
    if (o instanceof THREE.InstancedMesh && !o.instanceColor) {
      o.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(o.instanceMatrix.count * 3).fill(1), 3);
    }
  });
}

/** Ведёт интро: готовность для заставки и лобби, звуки и вспышки по фазам, переход в игру. */
export function IntroDirector(): null {
  const { bus, store } = useSim();
  const rows = useGame((s) => s.rows);
  const fontsReady = useRef(false);
  const warmup = useRef<'idle' | 'compiling' | 'compiled'>('idle');
  const readiness = useRef<ReadyState>({ smooth: 0, ready: false });
  const mountedAt = useRef(performance.now());
  const fired = useRef({ crack: false, shatter: false, done: false });

  useEffect(() => {
    void document.fonts.ready.then(() => {
      fontsReady.current = true;
    });
  }, []);

  useFrame(({ gl, scene, camera, size }, dt) => {
    const intro = introStore.getState();
    if (!intro.ready) {
      // Пока висит обложка: шрифты, затем все шейдеры сцены (и скрытых пирамиды, осколков, ячеек), затем ровные кадры
      if (fontsReady.current && warmup.current === 'idle') {
        warmup.current = 'compiling';
        ensureInstanceColors(scene);
        void gl.compileAsync(scene, camera).then(() => {
          warmup.current = 'compiled';
        });
      }
      readiness.current = stepReadiness(readiness.current, {
        fontsReady: fontsReady.current,
        compiled: warmup.current === 'compiled',
        frameMs: dt * 1000,
        elapsedMs: performance.now() - mountedAt.current,
      });
      if (readiness.current.ready) {
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
