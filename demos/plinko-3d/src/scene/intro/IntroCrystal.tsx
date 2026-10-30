import logoSvg from '@brand/logo/clickable-logo-white.svg?raw';
import { MeshRefractionMaterial } from '@react-three/drei';
import { useFrame, useThree } from '@react-three/fiber';
import { useEffect, useMemo, useRef } from 'react';
import * as THREE from 'three';
import { SVGLoader } from 'three/examples/jsm/loaders/SVGLoader.js';
import { introStore } from '../../intro/introStore';
import { useGame } from '../../state/store';
import { brilliantCut } from './brilliant';
import { crystalFrame } from './crystalFrame';
import { gemEnvironment } from './gemEnvironment';

/** Площадка камня повёрнута к зрителю: видна «звезда» огранки. */
export const CRYSTAL_TILT = 0.38;

/** Плоский логотип Clickable шириной `width`, центр в нуле, лицом к +Z. */
function logoGeometry(width: number): THREE.BufferGeometry {
  const data = new SVGLoader().parse(logoSvg);
  const g = new THREE.ShapeGeometry(data.paths.flatMap((p) => p.toShapes()), 8);
  g.computeBoundingBox();
  const box = g.boundingBox!;
  const k = width / (box.max.x - box.min.x);
  // SVG смотрит вниз по y: переворачиваем, а вывернутые переворотом треугольники разворачиваем обратно
  g.translate(-(box.min.x + box.max.x) / 2, -(box.min.y + box.max.y) / 2, 0);
  g.scale(k, -k, 1);
  const idx = g.index!;
  for (let i = 0; i < idx.count; i += 3) {
    const b = idx.getX(i + 1);
    idx.setX(i + 1, idx.getX(i + 2));
    idx.setX(i + 2, b);
  }
  return g;
}

const quadVert = /* glsl */ `
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

const instVert = /* glsl */ `
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

// Медленно вращающиеся лучи света за камнем
const raysFrag = /* glsl */ `
  uniform float uTime;
  uniform float uStrength;
  uniform vec3 uColor;
  varying vec2 vUv;
  void main() {
    vec2 p = vUv - 0.5;
    float r = length(p) * 2.0;
    float a = atan(p.y, p.x);
    float rays = 0.5 + 0.5 * sin(a * 18.0 + uTime * 0.16) * sin(a * 11.0 - uTime * 0.1);
    float fall = pow(clamp(1.0 - r, 0.0, 1.0), 2.0);
    gl_FragColor = vec4(uColor * rays * rays * fall * uStrength, 1.0);
  }
`;

// Мягкое пятно света (ореол, подиум, свечение логотипа)
const glowFrag = /* glsl */ `
  uniform vec3 uColor;
  uniform float uStrength;
  varying vec2 vUv;
  void main() {
    float d = length(vUv - 0.5) * 2.0;
    gl_FragColor = vec4(uColor * pow(clamp(1.0 - d, 0.0, 1.0), 2.2) * uStrength, 1.0);
  }
`;

// Шестилучевая вспышка на грани
const flareFrag = /* glsl */ `
  varying vec2 vUv;
  varying vec3 vColor;
  void main() {
    vec2 p = vUv - 0.5;
    float r = length(p);
    float a = atan(p.y, p.x);
    float rays = pow(abs(cos(a * 3.0)), 80.0) * smoothstep(0.5, 0.0, r);
    float core = exp(-r * r * 160.0);
    float halo = exp(-r * r * 26.0) * 0.35;
    gl_FragColor = vec4(vColor * (core * 2.2 + rays * 1.3 + halo), 1.0);
  }
`;

// Боке: мягкие круги не в фокусе
const bokehFrag = /* glsl */ `
  varying vec2 vUv;
  varying vec3 vColor;
  void main() {
    float d = length(vUv - 0.5) * 2.0;
    float disc = smoothstep(1.0, 0.7, d);
    gl_FragColor = vec4(vColor * disc, 1.0);
  }
`;

function additive(fragmentShader: string, vertexShader: string, uniforms?: Record<string, THREE.IUniform>, overlay = false) {
  return new THREE.ShaderMaterial({
    vertexShader,
    fragmentShader,
    ...(uniforms ? { uniforms } : {}),
    transparent: true,
    depthWrite: false,
    depthTest: !overlay,
    side: overlay ? THREE.DoubleSide : THREE.FrontSide,
    blending: THREE.AdditiveBlending,
    toneMapped: false,
  });
}

const FLARES = 7;
const BOKEH = 26;
const Z_AXIS = new THREE.Vector3(0, 0, 1);
const GEM_COLOR = new THREE.Color('#f4efff');
const LOGO_Y = -0.1;
const LOGO_RED = new THREE.Color('#ff1923');

interface Flare {
  vertex: number;
  age: number;
  life: number;
  size: number;
}

export function IntroCrystal() {
  const rows = useGame((s) => s.rows);
  const quality = useGame((s) => s.quality);
  const size = useThree((s) => s.size);
  const frame = crystalFrame(rows, size);
  const root = useRef<THREE.Group>(null);
  const spinner = useRef<THREE.Group>(null);
  const logoSpin = useRef<THREE.Group>(null);
  const gem = useRef<THREE.Mesh>(null);
  const flares = useRef<THREE.InstancedMesh>(null);
  const bokeh = useRef<THREE.InstancedMesh>(null);

  const geometry = useMemo(brilliantCut, []);
  const env = useMemo(gemEnvironment, []);
  useEffect(() => () => env.dispose(), [env]);
  const edges = useMemo(() => new THREE.EdgesGeometry(geometry, 1), [geometry]);
  const edgeMat = useMemo(
    () => new THREE.LineBasicMaterial({ color: '#ffffff', transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false }),
    [],
  );
  // Логотип светится внутри камня и поворачивается вместе с ним, но не наклоняется: надпись всегда стоит ровно.
  // Камень непрозрачен для сцены (преломляет только студию), поэтому надпись складывается со светом граней поверх него:
  // на ярких гранях тонет, на тёмных проступает. Две копии спина к спине, чтобы сзади она не читалась зеркально.
  const logo = useMemo(() => logoGeometry(1.25), []);
  const logoMat = useMemo(
    () => new THREE.MeshBasicMaterial({ color: LOGO_RED.clone(), transparent: true, blending: THREE.AdditiveBlending, depthTest: false, depthWrite: false, toneMapped: false }),
    [],
  );
  const logoGlow = useMemo(() => additive(glowFrag, quadVert, { uColor: { value: new THREE.Color('#ff2a4a') }, uStrength: { value: 0.35 } }, true), []);
  const rays = useMemo(() => additive(raysFrag, quadVert, { uTime: { value: 0 }, uStrength: { value: 0.28 }, uColor: { value: new THREE.Color('#8f74ff') } }), []);
  const halo = useMemo(() => additive(glowFrag, quadVert, { uColor: { value: new THREE.Color('#6a4fd6') }, uStrength: { value: 0.5 } }), []);
  const pool = useMemo(() => additive(glowFrag, quadVert, { uColor: { value: new THREE.Color('#b9a7ff') }, uStrength: { value: 0.4 } }), []);
  const ringMat = useMemo(
    () => new THREE.MeshBasicMaterial({ color: new THREE.Color('#c9b8ff'), transparent: true, opacity: 0.35, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false }),
    [],
  );
  const flareMat = useMemo(() => additive(flareFrag, instVert), []);
  const bokehMat = useMemo(() => additive(bokehFrag, instVert), []);
  const plane = useMemo(() => new THREE.PlaneGeometry(1, 1), []);

  // Вершины короны и пояска: на них вспыхивают звёзды
  const sparkPoints = useMemo(() => {
    const pos = geometry.attributes.position;
    const pts: THREE.Vector3[] = [];
    for (let i = 0; i < pos.count; i += 3) pts.push(new THREE.Vector3().fromBufferAttribute(pos, i));
    return pts.filter((p) => p.y > -0.1);
  }, [geometry]);
  const state = useMemo(
    () => ({
      flares: [] as Flare[],
      bokeh: Array.from({ length: BOKEH }, () => ({
        x: (Math.random() - 0.5) * 2.8,
        y: (Math.random() - 0.5) * 2,
        z: -1 - Math.random() * 2,
        size: 0.04 + Math.random() * 0.12,
        speed: 0.01 + Math.random() * 0.03,
        phase: Math.random() * 6,
        color: new THREE.Color().setHSL(0.7 + Math.random() * 0.08, 0.35, 0.6 + Math.random() * 0.2),
      })),
      m: new THREE.Matrix4(),
      p: new THREE.Vector3(),
      q: new THREE.Quaternion(),
      s: new THREE.Vector3(),
      c: new THREE.Color(),
    }),
    [],
  );

  useFrame(({ clock }, dt) => {
    const g = root.current;
    const sp = spinner.current;
    if (!g || !sp) return;
    const { phase, p } = introStore.getState().phaseNow();
    g.visible = phase === 'crystal' || phase === 'crack';
    if (!g.visible) return;
    const t = clock.elapsedTime;
    const cracking = phase === 'crack' ? p : 0;
    const S = frame.scale;

    // Камень парит и вращается; при расколе дрожит всё сильнее, трещины разгораются по граням
    const jitter = cracking * cracking * 0.1 * S;
    g.position.set(frame.cx + (Math.random() - 0.5) * jitter, frame.cy + Math.sin(t * 1.1) * 0.04 * S + (Math.random() - 0.5) * jitter, 0);
    const spin = t * 0.35 + cracking * cracking * 2.5;
    sp.rotation.set(CRYSTAL_TILT, spin, 0);
    sp.scale.setScalar(S * (1 + cracking * 0.05));
    if (logoSpin.current) {
      logoSpin.current.rotation.y = spin;
      logoSpin.current.scale.copy(sp.scale);
    }
    edgeMat.opacity = Math.min(1, cracking * 1.7) * (0.75 + 0.25 * Math.sin(t * 43));
    const gemMat = gem.current?.material as THREE.ShaderMaterial | undefined;
    gemMat?.uniforms.color.value.copy(GEM_COLOR).multiplyScalar(1.5 + cracking * 2.5);
    logoMat.color.copy(LOGO_RED).multiplyScalar(2 + 0.4 * Math.sin(t * 2.2) + cracking * 2);
    logoGlow.uniforms.uStrength.value = 0.35 + 0.08 * Math.sin(t * 2.2) + cracking * 0.8;
    rays.uniforms.uTime.value = t;
    rays.uniforms.uStrength.value = 0.28 + cracking * 0.6;
    halo.uniforms.uStrength.value = 0.45 + 0.1 * Math.sin(t * 1.4) + cracking * 1.1;

    // Звёзды-вспышки на гранях камня
    const fl = flares.current;
    if (fl) {
      const rate = 2.2 + cracking * 10;
      if (state.flares.length < FLARES && Math.random() < rate * dt) {
        state.flares.push({ vertex: Math.floor(Math.random() * sparkPoints.length), age: 0, life: 0.45 + Math.random() * 0.35, size: 0.3 + Math.random() * 0.4 });
      }
      sp.updateMatrixWorld();
      state.flares = state.flares.filter((f) => (f.age += dt) < f.life);
      state.flares.forEach((f, i) => {
        const k = Math.sin((Math.PI * f.age) / f.life);
        state.p.copy(sparkPoints[f.vertex]).applyMatrix4(sp.matrixWorld);
        state.p.z += 0.05 * S;
        g.worldToLocal(state.p);
        state.q.setFromAxisAngle(Z_AXIS, f.vertex + f.age * 0.6);
        fl.setMatrixAt(i, state.m.compose(state.p, state.q, state.s.setScalar(f.size * k * S)));
        fl.setColorAt(i, state.c.set('#f3ecff').multiplyScalar(1.3));
      });
      fl.count = state.flares.length;
      fl.instanceMatrix.needsUpdate = true;
      if (fl.instanceColor) fl.instanceColor.needsUpdate = true;
    }

    // Боке далеко за камнем
    const bk = bokeh.current;
    if (bk) {
      state.bokeh.forEach((b, i) => {
        const y = ((b.y + t * b.speed + 1) % 2) - 1;
        state.p.set((b.x + Math.sin(t * 0.3 + b.phase) * 0.05) * S * 2.2, y * S * 1.8, b.z * S);
        state.q.identity();
        bk.setMatrixAt(i, state.m.compose(state.p, state.q, state.s.setScalar(b.size * S)));
        bk.setColorAt(i, state.c.copy(b.color).multiplyScalar(0.08 + 0.07 * Math.sin(t * 0.8 + b.phase)));
      });
      bk.count = BOKEH;
      bk.instanceMatrix.needsUpdate = true;
      if (bk.instanceColor) bk.instanceColor.needsUpdate = true;
    }
  });

  const S = frame.scale;
  const high = quality === 'high';
  return (
    <group ref={root}>
      <mesh scale={S * 5.2} position={[0, 0, -2.5 * S]} material={rays} geometry={plane} />
      <mesh scale={S * 3.4} position={[0, 0, -1.2 * S]} material={halo} geometry={plane} />
      {/* Подиум: светлое пятно и тонкое кольцо под камнем */}
      <mesh scale={[S * 2.4, S * 0.5, 1]} position={[0, -1.15 * S, -0.2]} material={pool} geometry={plane} />
      <mesh position={[0, -1.12 * S, 0]} rotation-x={Math.PI / 2 - 0.22} material={ringMat}>
        <torusGeometry args={[S * 1.0, S * 0.008, 8, 128]} />
      </mesh>
      <instancedMesh ref={bokeh} args={[plane, bokehMat, BOKEH]} frustumCulled={false} />
      <group ref={spinner}>
        <mesh ref={gem} geometry={geometry} renderOrder={1}>
          {/* key: при смене качества drei пересоздаёт материал, а BVH огранки строит только при монтировании —
              без перемонтирования камень исчезал после автопереключения high → light */}
          <MeshRefractionMaterial key={quality} envMap={env} bounces={high ? 4 : 3} ior={2.4} fresnel={0.6} aberrationStrength={high ? 0.025 : 0.015} fastChroma={!high} color={GEM_COLOR} />
        </mesh>
        <lineSegments geometry={edges} material={edgeMat} renderOrder={4} />
      </group>
      <group ref={logoSpin} position-y={LOGO_Y * S}>
        <mesh scale={[1.7, 0.55, 1]} material={logoGlow} geometry={plane} renderOrder={2} />
        <mesh geometry={logo} material={logoMat} position-z={0.02} renderOrder={3} />
        <mesh geometry={logo} material={logoMat} position-z={-0.02} rotation-y={Math.PI} renderOrder={3} />
      </group>
      <instancedMesh ref={flares} args={[plane, flareMat, FLARES]} frustumCulled={false} renderOrder={5} />
    </group>
  );
}
