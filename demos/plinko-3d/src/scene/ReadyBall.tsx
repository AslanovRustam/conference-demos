import { useFrame } from '@react-three/fiber';
import { useEffect, useMemo, useRef } from 'react';
import type * as THREE from 'three';
import { BALL_RADIUS, SPAWN_HEIGHT } from '../math/layout';
import { useSim } from '../sim/SimProvider';
import { createChromeMaterial } from './materials';

/** Шарик наготове над пирамидой: висит и покачивается, пока поле пустое; при броске его сменяет настоящий. */
export function ReadyBall() {
  const { system, controller, store } = useSim();
  const mesh = useRef<THREE.Mesh>(null);
  const material = useMemo(() => createChromeMaterial(), []);
  useEffect(() => () => material.dispose(), [material]);
  const shown = useRef(0);

  useFrame(({ clock }, dt) => {
    const m = mesh.current;
    if (!m) return;
    const want = store.getState().mode === 'play' && system.balls.length === 0 && !controller.celebrating;
    // Исчезает мгновенно (его место занимает брошенный шарик), появляется плавно
    shown.current = want ? Math.min(1, shown.current + dt * 3) : 0;
    const k = shown.current;
    m.visible = k > 0.01;
    if (!m.visible) return;
    const t = clock.elapsedTime;
    m.position.set(0, SPAWN_HEIGHT + Math.sin(t * 2) * 0.08, 0);
    m.rotation.set(0, t * 0.8, 0);
    m.scale.setScalar(k * k * (3 - 2 * k));
  });

  return (
    <mesh ref={mesh} material={material} visible={false}>
      <sphereGeometry args={[BALL_RADIUS, 32, 16]} />
    </mesh>
  );
}
