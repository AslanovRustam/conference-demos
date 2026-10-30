import { useFrame } from '@react-three/fiber';
import { useMemo, useRef } from 'react';
import * as THREE from 'three';
import { useGame } from '../state/store';
import { slotView } from './fxStore';

const MAX_SLOTS = 17;
const GLINTS = 32;
const SPARKS = 90;

const instVert = /* glsl */ `
  varying vec2 vUv;
  varying vec3 vColor;
  void main() {
    vUv = uv;
    vColor = instanceColor;
    gl_Position = projectionMatrix * modelViewMatrix * instanceMatrix * vec4(position, 1.0);
  }
`;

// Мягкое круглое свечение (ореолы и искры)
const glowFrag = /* glsl */ `
  varying vec2 vUv;
  varying vec3 vColor;
  void main() {
    float d = length(vUv - 0.5) * 2.0;
    float a = pow(clamp(1.0 - d, 0.0, 1.0), 2.2);
    gl_FragColor = vec4(vColor * a, 1.0);
  }
`;

// Четырёхлучевая звёздочка-блик на грани камня
const glintFrag = /* glsl */ `
  varying vec2 vUv;
  varying vec3 vColor;
  void main() {
    vec2 p = vUv - 0.5;
    float core = exp(-dot(p, p) * 90.0);
    float rays = max(0.0, 1.0 - abs(p.x) * 14.0) * max(0.0, 1.0 - abs(p.y) * 2.0)
               + max(0.0, 1.0 - abs(p.y) * 14.0) * max(0.0, 1.0 - abs(p.x) * 2.0);
    gl_FragColor = vec4(vColor * (core * 1.6 + rays), 1.0);
  }
`;

// Вертикальный столб света над крупной ячейкой
const columnVert = /* glsl */ `
  varying vec2 vUv;
  varying vec3 vColor;
  void main() {
    vUv = uv;
    vColor = instanceColor;
    gl_Position = projectionMatrix * modelViewMatrix * instanceMatrix * vec4(position, 1.0);
  }
`;
const columnFrag = /* glsl */ `
  uniform float uTime;
  varying vec2 vUv;
  varying vec3 vColor;
  void main() {
    float across = pow(max(0.0, 1.0 - abs(vUv.x - 0.5) * 2.0), 2.0);
    float up = pow(1.0 - vUv.y, 1.6);
    float flicker = 0.75 + 0.25 * sin(uTime * 3.1 + vUv.y * 9.0);
    gl_FragColor = vec4(vColor * across * up * flicker * 0.8, 1.0);
  }
`;

interface Particle {
  slot: number;
  x: number;
  y: number;
  vy: number;
  sway: number;
  age: number;
  life: number;
  size: number;
}

function additive(fragmentShader: string, vertexShader = instVert, uniforms?: Record<string, THREE.IUniform>) {
  return new THREE.ShaderMaterial({ vertexShader, fragmentShader, ...(uniforms ? { uniforms } : {}), transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, toneMapped: false });
}

/** Жизнь вокруг камней-ячеек: ореолы, блики на гранях, искры и столбы света над BIG и MEGA. */
export function SlotFx() {
  const quality = useGame((s) => s.quality);
  const halos = useRef<THREE.InstancedMesh>(null);
  const glints = useRef<THREE.InstancedMesh>(null);
  const sparks = useRef<THREE.InstancedMesh>(null);
  const columns = useRef<THREE.InstancedMesh>(null);
  const plane = useMemo(() => new THREE.PlaneGeometry(1, 1), []);
  const mats = useMemo(
    () => ({
      halo: additive(glowFrag),
      glint: additive(glintFrag),
      spark: additive(glowFrag),
      column: additive(columnFrag, columnVert, { uTime: { value: 0 } }),
    }),
    [],
  );
  const state = useMemo(
    () => ({
      glints: [] as Particle[],
      sparks: [] as Particle[],
      m: new THREE.Matrix4(),
      q: new THREE.Quaternion(),
      p: new THREE.Vector3(),
      s: new THREE.Vector3(),
      c: new THREE.Color(),
      white: new THREE.Color('#ffffff'),
      z: new THREE.Vector3(0, 0, 1),
    }),
    [],
  );

  useFrame(({ clock }, dt) => {
    const { m, q, p, s, c } = state;
    const n = slotView.count;
    const t = clock.elapsedTime;
    const glintRate = quality === 'high' ? 1 : 0.5;
    mats.column.uniforms.uTime.value = t;

    // Ореолы за камнями: дышат вместе с камнем и разгораются, когда к нему летит шарик
    const halo = halos.current;
    if (halo) {
      for (let k = 0; k < n; k++) {
        const sc = slotView.scale[k];
        const size = (1.5 + 0.5 * slotView.light[k] + 0.8 * slotView.antic[k]) * sc;
        m.compose(p.set(slotView.x[k], slotView.y[k], -0.3), q.identity(), s.set(size, size, size));
        halo.setMatrixAt(k, m);
        halo.setColorAt(k, c.copy(slotView.colors[k]).multiplyScalar((0.18 + 0.45 * slotView.light[k] + 1.3 * slotView.antic[k]) * Math.min(1, sc)));
      }
      halo.count = n;
      halo.instanceMatrix.needsUpdate = true;
      if (halo.instanceColor) halo.instanceColor.needsUpdate = true;
    }

    // Блики: короткие звёздочки на случайных гранях, на крупных камнях чаще
    for (let k = 0; k < n; k++) {
      if (slotView.scale[k] < 0.5) continue;
      const rate = (0.5 + 1.6 * slotView.big[k] + 1.5 * slotView.antic[k]) * glintRate;
      if (state.glints.length < GLINTS && Math.random() < rate * dt) {
        state.glints.push({ slot: k, x: (Math.random() - 0.5) * 0.6, y: (Math.random() - 0.3) * 0.3, vy: Math.random() * Math.PI, sway: 0, age: 0, life: 0.35 + Math.random() * 0.2, size: 0.25 + Math.random() * 0.2 });
      }
    }
    const glint = glints.current;
    if (glint) {
      state.glints = state.glints.filter((g) => (g.age += dt) < g.life && g.slot < n);
      state.glints.forEach((g, i) => {
        const k = Math.sin((Math.PI * g.age) / g.life);
        const size = g.size * k * slotView.scale[g.slot];
        q.setFromAxisAngle(state.z, g.vy + g.age * 1.5);
        m.compose(p.set(slotView.x[g.slot] + g.x, slotView.y[g.slot] + g.y, 0.42), q, s.set(size, size, size));
        glint.setMatrixAt(i, m);
        glint.setColorAt(i, c.copy(slotView.colors[g.slot]).lerp(state.white, 0.7).multiplyScalar(1.4));
      });
      glint.count = state.glints.length;
      glint.instanceMatrix.needsUpdate = true;
      if (glint.instanceColor) glint.instanceColor.needsUpdate = true;
    }

    // Искры поднимаются над BIG и MEGA
    for (let k = 0; k < n; k++) {
      if (!slotView.big[k] || slotView.scale[k] < 0.5) continue;
      if (state.sparks.length < SPARKS && Math.random() < 9 * dt * glintRate) {
        state.sparks.push({ slot: k, x: (Math.random() - 0.5) * 0.5, y: 0.15, vy: 0.7 + Math.random() * 0.7, sway: Math.random() * 6, age: 0, life: 1.1 + Math.random() * 0.6, size: 0.06 + Math.random() * 0.06 });
      }
    }
    const spark = sparks.current;
    if (spark) {
      state.sparks = state.sparks.filter((sp) => (sp.age += dt) < sp.life && sp.slot < n);
      state.sparks.forEach((sp, i) => {
        sp.y += sp.vy * dt;
        const fade = Math.sin((Math.PI * sp.age) / sp.life);
        const x = slotView.x[sp.slot] + sp.x + Math.sin(sp.sway + sp.age * 3) * 0.06;
        m.compose(p.set(x, slotView.y[sp.slot] + sp.y, 0.1), q.identity(), s.setScalar(sp.size * 2.2));
        spark.setMatrixAt(i, m);
        spark.setColorAt(i, c.copy(slotView.colors[sp.slot]).lerp(state.white, 0.35).multiplyScalar(1.2 * fade));
      });
      spark.count = state.sparks.length;
      spark.instanceMatrix.needsUpdate = true;
      if (spark.instanceColor) spark.instanceColor.needsUpdate = true;
    }

    // Столбы света над крупными ячейками
    const col = columns.current;
    if (col) {
      let i = 0;
      for (let k = 0; k < n; k++) {
        if (!slotView.big[k]) continue;
        const sc = Math.min(1, slotView.scale[k]);
        m.compose(p.set(slotView.x[k], slotView.y[k] + 1.25, -0.2), q.identity(), s.set(0.6, 2.4 * sc, 1));
        col.setMatrixAt(i, m);
        col.setColorAt(i, c.copy(slotView.colors[k]).multiplyScalar((0.7 + 0.5 * slotView.light[k]) * sc));
        i++;
      }
      col.count = i;
      col.instanceMatrix.needsUpdate = true;
      if (col.instanceColor) col.instanceColor.needsUpdate = true;
    }
  });

  return (
    <>
      <instancedMesh ref={columns} args={[plane, mats.column, MAX_SLOTS]} frustumCulled={false} renderOrder={1} />
      <instancedMesh ref={halos} args={[plane, mats.halo, MAX_SLOTS]} frustumCulled={false} renderOrder={1} />
      <instancedMesh ref={sparks} args={[plane, mats.spark, SPARKS]} frustumCulled={false} renderOrder={3} />
      <instancedMesh ref={glints} args={[plane, mats.glint, GLINTS]} frustumCulled={false} renderOrder={3} />
    </>
  );
}
