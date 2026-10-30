import { useFrame } from '@react-three/fiber';
import { useMemo } from 'react';
import * as THREE from 'three';
import { BALL_RADIUS } from '../math/layout';
import type { Ball } from '../sim/BallSystem';
import { useSim } from '../sim/SimProvider';

const MAX_TRAILS = 10;
const POINTS = 24;
const FADE_SECONDS = 0.3;

const vert = /* glsl */ `
  attribute float aT;
  varying float vT;
  void main() {
    vT = aT;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

const frag = /* glsl */ `
  uniform float uTime;
  uniform float uOpacity;
  varying float vT;
  vec3 hsv2rgb(vec3 c) {
    vec3 p = abs(fract(c.xxx + vec3(0.0, 2.0 / 3.0, 1.0 / 3.0)) * 6.0 - 3.0);
    return c.z * mix(vec3(1.0), clamp(p - 1.0, 0.0, 1.0), c.y);
  }
  void main() {
    vec3 color = hsv2rgb(vec3(fract(uTime * 0.25 + vT * 0.6), 0.65, 1.0));
    float a = pow(1.0 - vT, 1.5) * uOpacity;
    gl_FragColor = vec4(color, a);
  }
`;

interface Trail {
  ballId: number | null;
  history: Float32Array; // x, y для POINTS точек, голова первой
  filled: number;
  opacity: number;
  geometry: THREE.BufferGeometry;
  material: THREE.ShaderMaterial;
  mesh: THREE.Mesh;
}

function makeTrail(): Trail {
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.BufferAttribute(new Float32Array(POINTS * 2 * 3), 3));
  const aT = new Float32Array(POINTS * 2);
  for (let i = 0; i < POINTS; i++) aT[i * 2] = aT[i * 2 + 1] = i / (POINTS - 1);
  geometry.setAttribute('aT', new THREE.BufferAttribute(aT, 1));
  const index: number[] = [];
  for (let i = 0; i < POINTS - 1; i++) {
    const a = i * 2;
    index.push(a, a + 1, a + 2, a + 1, a + 3, a + 2);
  }
  geometry.setIndex(index);
  const material = new THREE.ShaderMaterial({
    vertexShader: vert,
    fragmentShader: frag,
    uniforms: { uTime: { value: 0 }, uOpacity: { value: 0 } },
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    toneMapped: false,
    side: THREE.DoubleSide,
  });
  const mesh = new THREE.Mesh(geometry, material);
  mesh.frustumCulled = false;
  mesh.renderOrder = 1;
  return { ballId: null, history: new Float32Array(POINTS * 2), filled: 0, opacity: 0, geometry, material, mesh };
}

// У шариков дождя шлейфа нет: при сотне шариков ленты сливаются в кашу
function pickBalls(balls: Ball[]): Ball[] {
  return balls.filter((b) => b.kind !== 'rain' && !b.landed).slice(0, MAX_TRAILS);
}

export function Trails() {
  const { system } = useSim();
  const trails = useMemo(() => Array.from({ length: MAX_TRAILS }, makeTrail), []);

  useFrame(({ clock }, dt) => {
    const wanted = pickBalls(system.balls);
    const wantedIds = new Set(wanted.map((b) => b.id));
    for (const tr of trails) if (tr.ballId !== null && !wantedIds.has(tr.ballId)) tr.ballId = null;
    for (const b of wanted) {
      if (trails.some((tr) => tr.ballId === b.id)) continue;
      const free = trails.find((tr) => tr.ballId === null && tr.opacity <= 0.01) ?? trails.find((tr) => tr.ballId === null);
      if (!free) break;
      free.ballId = b.id;
      free.filled = 0;
    }

    for (const tr of trails) {
      const ball = tr.ballId === null ? undefined : system.balls.find((b) => b.id === tr.ballId);
      if (ball) {
        tr.history.copyWithin(2, 0, POINTS * 2 - 2);
        tr.history[0] = ball.sample.x;
        tr.history[1] = ball.sample.y;
        if (tr.filled === 0) for (let i = 1; i < POINTS; i++) tr.history.set([ball.sample.x, ball.sample.y], i * 2);
        tr.filled = Math.min(POINTS, tr.filled + 1);
        tr.opacity = Math.min(1, tr.opacity + dt * 6);
      } else {
        tr.opacity = Math.max(0, tr.opacity - dt / FADE_SECONDS);
      }
      tr.material.uniforms.uTime.value = clock.elapsedTime;
      tr.material.uniforms.uOpacity.value = tr.opacity;
      tr.mesh.visible = tr.opacity > 0.001;
      if (!tr.mesh.visible) continue;

      const pos = tr.geometry.attributes.position as THREE.BufferAttribute;
      const h = tr.history;
      for (let i = 0; i < POINTS; i++) {
        const prev = Math.max(0, i - 1);
        const next = Math.min(POINTS - 1, i + 1);
        let dx = h[prev * 2] - h[next * 2];
        let dy = h[prev * 2 + 1] - h[next * 2 + 1];
        const len = Math.hypot(dx, dy) || 1;
        dx /= len;
        dy /= len;
        const w = BALL_RADIUS * 0.85 * Math.pow(1 - i / (POINTS - 1), 0.7);
        pos.setXYZ(i * 2, h[i * 2] - dy * w, h[i * 2 + 1] + dx * w, -0.02);
        pos.setXYZ(i * 2 + 1, h[i * 2] + dy * w, h[i * 2 + 1] - dx * w, -0.02);
      }
      pos.needsUpdate = true;
    }
  });

  return (
    <>
      {trails.map((tr, i) => (
        <primitive key={i} object={tr.mesh} />
      ))}
    </>
  );
}
