import { useFrame } from '@react-three/fiber';
import { useEffect, useMemo, useRef } from 'react';
import * as THREE from 'three';
import { fxHooks } from './fxStore';

const POOL = 900;
const LIFE = 1.2;
const GRAVITY = 9;

export function Shards() {
  const mesh = useRef<THREE.InstancedMesh>(null);
  const geometry = useMemo(() => new THREE.TetrahedronGeometry(0.09), []);
  const material = useMemo(() => new THREE.MeshBasicMaterial({ toneMapped: false }), []);
  const state = useMemo(
    () => ({
      pos: new Float32Array(POOL * 3),
      vel: new Float32Array(POOL * 3),
      rot: new Float32Array(POOL * 2), // угол, скорость вращения
      life: new Float32Array(POOL),
      next: 0,
    }),
    [],
  );
  const tmp = useMemo(
    () => ({ m: new THREE.Matrix4(), q: new THREE.Quaternion(), e: new THREE.Euler(), p: new THREE.Vector3(), s: new THREE.Vector3(), c: new THREE.Color() }),
    [],
  );

  useEffect(() => {
    fxHooks.burst = (x, y, count, power) => {
      const m = mesh.current;
      for (let n = 0; n < count; n++) {
        const i = state.next;
        state.next = (state.next + 1) % POOL;
        const a = Math.PI / 2 + (Math.random() - 0.5) * ((140 * Math.PI) / 180);
        const v = (3 + Math.random() * 4) * power;
        state.pos.set([x + (Math.random() - 0.5) * 0.3, y, 0.2], i * 3);
        state.vel.set([Math.cos(a) * v, Math.sin(a) * v, (Math.random() - 0.5) * 2], i * 3);
        state.rot.set([Math.random() * 6, (Math.random() - 0.5) * 14], i * 2);
        state.life[i] = LIFE * (0.7 + Math.random() * 0.3);
        if (m) m.setColorAt(i, tmp.c.setHSL(Math.random(), 1, 0.6).multiplyScalar(1.3));
      }
      if (m?.instanceColor) m.instanceColor.needsUpdate = true;
    };
    return () => {
      fxHooks.burst = undefined;
    };
  }, [state, tmp]);

  useFrame((_, dt) => {
    const m = mesh.current;
    if (!m) return;
    for (let i = 0; i < POOL; i++) {
      const life = state.life[i];
      if (life <= 0) {
        tmp.s.setScalar(0);
        m.setMatrixAt(i, tmp.m.compose(tmp.p.set(0, 0, -100), tmp.q.identity(), tmp.s));
        continue;
      }
      state.life[i] = life - dt;
      const j = i * 3;
      state.vel[j + 1] -= GRAVITY * dt;
      state.pos[j] += state.vel[j] * dt;
      state.pos[j + 1] += state.vel[j + 1] * dt;
      state.pos[j + 2] += state.vel[j + 2] * dt;
      state.rot[i * 2] += state.rot[i * 2 + 1] * dt;
      const k = Math.min(1, state.life[i] / 0.4);
      tmp.p.set(state.pos[j], state.pos[j + 1], state.pos[j + 2]);
      tmp.e.set(state.rot[i * 2], state.rot[i * 2] * 0.7, 0);
      tmp.q.setFromEuler(tmp.e);
      tmp.s.setScalar(Math.max(0, k));
      m.setMatrixAt(i, tmp.m.compose(tmp.p, tmp.q, tmp.s));
    }
    m.instanceMatrix.needsUpdate = true;
  });

  return <instancedMesh ref={mesh} args={[geometry, material, POOL]} frustumCulled={false} />;
}
