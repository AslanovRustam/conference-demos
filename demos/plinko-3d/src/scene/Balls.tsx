import { useFrame } from '@react-three/fiber';
import { useEffect, useMemo, useRef } from 'react';
import * as THREE from 'three';
import { MAX_ACTIVE_BALLS } from '../config';
import { BALL_RADIUS } from '../math/layout';
import { useSim } from '../sim/SimProvider';
import { createChromeMaterial } from './materials';

export function Balls() {
  const { system } = useSim();
  const mesh = useRef<THREE.InstancedMesh>(null);
  const geometry = useMemo(() => new THREE.SphereGeometry(BALL_RADIUS, 32, 16), []);
  const material = useMemo(() => createChromeMaterial(), []);
  useEffect(() => () => material.dispose(), [material]);
  const tmp = useMemo(() => ({ m: new THREE.Matrix4(), q: new THREE.Quaternion(), p: new THREE.Vector3(), s: new THREE.Vector3(), z: new THREE.Vector3(0, 0, 1) }), []);

  useFrame(() => {
    const m = mesh.current;
    if (!m) return;
    const balls = system.balls;
    for (let i = 0; i < balls.length; i++) {
      const b = balls[i];
      const { landT, endT } = b.traj;
      // После приземления шарик подпрыгивает в камне и уходит внутрь
      const sink = b.t <= landT ? 0 : Math.min(1, (b.t - landT) / (endT - landT));
      const scale = sink < 0.5 ? 1 : 1 - (sink - 0.5) * 2;
      tmp.p.set(b.sample.x, b.sample.y, 0);
      tmp.q.setFromAxisAngle(tmp.z, b.sample.angle);
      tmp.s.setScalar(Math.max(0.001, scale));
      m.setMatrixAt(i, tmp.m.compose(tmp.p, tmp.q, tmp.s));
    }
    m.count = balls.length;
    m.instanceMatrix.needsUpdate = true;
  });

  return <instancedMesh ref={mesh} args={[geometry, material, MAX_ACTIVE_BALLS]} frustumCulled={false} />;
}
