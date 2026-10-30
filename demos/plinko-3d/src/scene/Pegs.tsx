import { useFrame } from '@react-three/fiber';
import { useEffect, useMemo, useRef } from 'react';
import * as THREE from 'three';
import { boardLayout, pegCount, pegFlatIndex } from '../math/layout';
import { useSim } from '../sim/SimProvider';
import { useGame } from '../state/store';
import { pegGlow } from './fxStore';
import { createCrystalMaterial } from './materials';
import { CRYSTAL, pegHue } from './palette';
import { HIT_PULSE, PEG_VISUAL_RADIUS, PEG_VISUAL_STRETCH_Y, pegEuler } from './pegShape';
import { introStore } from '../intro/introStore';
import { useRowsTransition } from './rowsTransition';

const CAPACITY = pegCount(16);
const IDLE_HALO = 0.3; // мягкое лавандовое свечение кристалла в покое

const glowVert = /* glsl */ `
  varying vec2 vUv;
  varying vec3 vColor;
  void main() {
    vUv = uv;
    #ifdef USE_INSTANCING_COLOR
      vColor = instanceColor;
    #else
      vColor = vec3(0.0);
    #endif
    gl_Position = projectionMatrix * modelViewMatrix * instanceMatrix * vec4(position, 1.0);
  }
`;

const glowFrag = /* glsl */ `
  varying vec2 vUv;
  varying vec3 vColor;
  void main() {
    float d = length(vUv - 0.5) * 2.0;
    float core = exp(-d * d * 9.0);
    float halo = pow(clamp(1.0 - d, 0.0, 1.0), 2.0) * 0.5;
    gl_FragColor = vec4(vColor * (core + halo), 1.0);
  }
`;

export function Pegs() {
  const { bus } = useSim();
  const rows = useGame((s) => s.rows);
  const quality = useGame((s) => s.quality);
  const crystals = useRef<THREE.InstancedMesh>(null);
  const glows = useRef<THREE.InstancedMesh>(null);
  const transition = useRowsTransition(rows);

  // Почти круглый граненый кристалл: визуальная граница близка к физическому радиусу касания
  const geometry = useMemo(() => new THREE.IcosahedronGeometry(PEG_VISUAL_RADIUS, 0).scale(1, PEG_VISUAL_STRETCH_Y, 1), []);
  const material = useMemo(() => createCrystalMaterial(quality), [quality]);
  useEffect(() => () => material.dispose(), [material]);

  useEffect(
    () =>
      bus.on('peg:hit', (e) => {
        pegGlow.hit(pegFlatIndex(e.row, e.index), e.kind === 'rain' ? 0.6 : 1);
      }),
    [bus],
  );

  useEffect(() => {
    // Новая пирамида начинается без остатков свечения
    pegGlow.clear();
  }, [rows]);

  const tmp = useMemo(
    () => ({
      m: new THREE.Matrix4(),
      q: new THREE.Quaternion(),
      e: new THREE.Euler(),
      p: new THREE.Vector3(),
      s: new THREE.Vector3(),
      c: new THREE.Color(),
      tint: new THREE.Color(),
      halo: new THREE.Color(),
      idle: new THREE.Color(CRYSTAL.idleGlow),
      white: new THREE.Color('#ffffff'),
    }),
    [],
  );

  useFrame(({ clock }, dt) => {
    const mesh = crystals.current;
    const halo = glows.current;
    if (!mesh || !halo) return;
    pegGlow.decay(dt);
    // Пока идёт интро, пирамиду изображают осколки кристалла (IntroShards)
    const phase = introStore.getState().phaseNow().phase;
    const visible = phase === 'gems' || phase === 'done';
    mesh.visible = visible;
    halo.visible = visible;
    if (!visible) return;
    const { pegs } = boardLayout(transition.shown);
    const t = clock.elapsedTime;
    const now = performance.now() / 1000;
    for (let i = 0; i < pegs.length; i++) {
      const peg = pegs[i];
      const glow = pegGlow.values[peg.flat];
      const appear = transition.scaleFor(peg.row, now);
      tmp.p.set(peg.x, peg.y, 0);
      tmp.q.setFromEuler(pegEuler(peg.flat, t, tmp.e));
      const s = (1 + HIT_PULSE * glow) * appear;
      tmp.s.set(s, s, s);
      mesh.setMatrixAt(i, tmp.m.compose(tmp.p, tmp.q, tmp.s));
      tmp.c.setHSL(pegHue(peg.flat, t), 1, 0.65);
      tmp.tint.copy(tmp.c).lerp(tmp.white, 1 - glow).multiplyScalar(1 + 2 * glow);
      mesh.setColorAt(i, tmp.tint);

      tmp.q.identity();
      const hs = (1.15 + 0.6 * glow) * appear;
      tmp.s.set(hs, hs, hs);
      tmp.p.set(peg.x, peg.y, 0.05);
      halo.setMatrixAt(i, tmp.m.compose(tmp.p, tmp.q, tmp.s));
      tmp.halo.copy(tmp.c).multiplyScalar(glow * 1.6);
      tmp.halo.r += tmp.idle.r * IDLE_HALO;
      tmp.halo.g += tmp.idle.g * IDLE_HALO;
      tmp.halo.b += tmp.idle.b * IDLE_HALO;
      halo.setColorAt(i, tmp.halo);
    }
    mesh.count = pegs.length;
    halo.count = pegs.length;
    mesh.instanceMatrix.needsUpdate = true;
    halo.instanceMatrix.needsUpdate = true;
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
    if (halo.instanceColor) halo.instanceColor.needsUpdate = true;
  });

  return (
    <>
      <instancedMesh ref={crystals} args={[geometry, material, CAPACITY]} frustumCulled={false} />
      <instancedMesh ref={glows} args={[undefined, undefined, CAPACITY]} frustumCulled={false} renderOrder={2}>
        <planeGeometry args={[1, 1]} />
        <shaderMaterial
          vertexShader={glowVert}
          fragmentShader={glowFrag}
          transparent
          depthWrite={false}
          blending={THREE.AdditiveBlending}
          toneMapped={false}
        />
      </instancedMesh>
    </>
  );
}
