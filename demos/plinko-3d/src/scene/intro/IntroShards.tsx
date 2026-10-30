import { useFrame } from '@react-three/fiber';
import { useEffect, useMemo, useRef } from 'react';
import * as THREE from 'three';
import { createRng } from '../../core/rng';
import { introStore } from '../../intro/introStore';
import { INTRO, assembleProgress } from '../../intro/timeline';
import { boardLayout } from '../../math/layout';
import { useSim } from '../../sim/SimProvider';
import { useGame } from '../../state/store';
import { createCrystalMaterial } from '../materials';
import { PEG_VISUAL_RADIUS, PEG_VISUAL_STRETCH_Y, pegEuler } from '../pegShape';
import { BRILLIANT, brilliantRadiusAt } from './brilliant';
import { CRYSTAL_TILT, crystalFrame } from './IntroCrystal';

const EXTRA = 70; // лишние осколки просто разлетаются и гаснут
const DRAG = 4;
const X_AXIS = new THREE.Vector3(1, 0, 0);

interface Shard {
  start: THREE.Vector3;
  vel: THREE.Vector3;
  exploded: THREE.Vector3;
  spinAxis: THREE.Vector3;
  jitter: number;
  arrived: boolean;
  flash: number;
}

/** Осколки кристалла: разлетаются и собираются в пирамиду, каждый в свой кристалл. */
export function IntroShards() {
  const { bus } = useSim();
  const rows = useGame((s) => s.rows);
  const quality = useGame((s) => s.quality);
  const mesh = useRef<THREE.InstancedMesh>(null);
  const layout = boardLayout(rows);
  const count = layout.pegs.length + EXTRA;

  const geometry = useMemo(() => new THREE.IcosahedronGeometry(PEG_VISUAL_RADIUS, 0).scale(1, PEG_VISUAL_STRETCH_Y, 1), []);
  const material = useMemo(() => createCrystalMaterial(quality), [quality]);
  useEffect(() => () => material.dispose(), [material]);

  const shards = useMemo<Shard[]>(() => {
    const rng = createRng(7);
    const { cx, cy, scale } = crystalFrame(rows);
    return Array.from({ length: count }, () => {
      // Случайная точка внутри бриллианта (площадка наклонена к зрителю, как у камня в интро)
      const y = rng.range(BRILLIANT.culet, BRILLIANT.table);
      const r = brilliantRadiusAt(y) * Math.sqrt(rng.next());
      const a = rng.range(0, Math.PI * 2);
      const start = new THREE.Vector3(Math.cos(a) * r, y, Math.sin(a) * r)
        .applyAxisAngle(X_AXIS, CRYSTAL_TILT)
        .multiplyScalar(scale)
        .add(new THREE.Vector3(cx, cy, 0));
      // Разлёт во все стороны (а не вдоль высокого кристалла), с лёгким уклоном к зрителю
      const phi = rng.range(0, Math.PI * 2);
      const cosT = rng.range(-1, 1);
      const sinT = Math.sqrt(1 - cosT * cosT);
      const dir = new THREE.Vector3(Math.cos(phi) * sinT, cosT * 0.8, Math.sin(phi) * sinT * 0.5 + 0.2).normalize();
      const vel = dir.multiplyScalar(rng.range(10, 22));
      const t = INTRO.explode;
      const f = (1 - Math.exp(-DRAG * t)) / DRAG;
      return {
        start,
        vel,
        exploded: start.clone().addScaledVector(vel, f),
        spinAxis: new THREE.Vector3(rng.range(-1, 1), rng.range(-1, 1), rng.range(-1, 1)).normalize(),
        jitter: rng.next(),
        arrived: false,
        flash: 0,
      };
    });
  }, [rows, count]);

  const tmp = useMemo(
    () => ({ m: new THREE.Matrix4(), p: new THREE.Vector3(), q: new THREE.Quaternion(), q2: new THREE.Quaternion(), e: new THREE.Euler(), s: new THREE.Vector3(), c: new THREE.Color() }),
    [],
  );

  useFrame(({ clock }, dt) => {
    const m = mesh.current;
    if (!m) return;
    const { phase, t } = introStore.getState().phaseNow();
    m.visible = phase === 'explode' || phase === 'assemble';
    if (!m.visible) return;
    const clockT = clock.elapsedTime;
    const pegs = layout.pegs;
    for (let i = 0; i < count; i++) {
      const sh = shards[i];
      const target = pegs[i];
      let scale = 1;
      // Осколки раскалены после взрыва и остывают, пока летят на места
      let heat = phase === 'explode' ? 2.2 - 0.8 * (t / INTRO.explode) : 1.4 * Math.max(0, 1 - t / INTRO.assemble);
      if (phase === 'explode') {
        tmp.p.copy(sh.start).addScaledVector(sh.vel, (1 - Math.exp(-DRAG * t)) / DRAG);
        tmp.q.setFromAxisAngle(sh.spinAxis, t * 9);
      } else if (target) {
        const k = assembleProgress(t, target.row, rows, sh.jitter);
        tmp.p.lerpVectors(sh.exploded, tmp.s.set(target.x, target.y, 0), k);
        tmp.p.y += Math.sin(Math.PI * k) * 0.8;
        tmp.q.setFromAxisAngle(sh.spinAxis, (INTRO.explode + t) * 9 * (1 - k));
        tmp.q.slerp(tmp.q2.setFromEuler(pegEuler(target.flat, clockT, tmp.e)), k);
        if (k >= 1 && !sh.arrived) {
          sh.arrived = true;
          sh.flash = 1;
          // Встал на место: вспышка и звон ряда (как у дождя, с ограничением частоты)
          bus.emit('peg:hit', { ballId: -1, row: target.row, index: target.index, speed: 5, kind: 'rain' });
        }
      } else {
        // Лишний осколок дрейфует дальше и тает
        tmp.p.copy(sh.exploded).addScaledVector(sh.vel, t * 0.15);
        tmp.q.setFromAxisAngle(sh.spinAxis, (INTRO.explode + t) * 6);
        scale = Math.max(0, 1 - t / 0.7);
        heat = 1.4;
      }
      sh.flash = Math.max(0, sh.flash - dt * 3);
      m.setMatrixAt(i, tmp.m.compose(tmp.p, tmp.q, tmp.s.setScalar(scale * (1 + 0.3 * sh.flash))));
      m.setColorAt(i, tmp.c.setScalar(1 + heat + 2 * sh.flash));
    }
    m.count = count;
    m.instanceMatrix.needsUpdate = true;
    if (m.instanceColor) m.instanceColor.needsUpdate = true;
  });

  return <instancedMesh ref={mesh} args={[geometry, material, 168 + EXTRA]} frustumCulled={false} visible={false} />;
}
