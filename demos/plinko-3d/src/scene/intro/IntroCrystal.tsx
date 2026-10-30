import logoSvg from '@brand/logo/clickable-logo-white.svg?raw';
import { useFrame } from '@react-three/fiber';
import { useEffect, useMemo, useRef } from 'react';
import * as THREE from 'three';
import { SVGLoader } from 'three/examples/jsm/loaders/SVGLoader.js';
import { introStore } from '../../intro/introStore';
import { boardLayout } from '../../math/layout';
import { useGame } from '../../state/store';
import { createCrystalMaterial } from '../materials';

/** Огромный граненый кристалл интро: высота 2, центр в нуле. */
export function crystalGeometry(): THREE.BufferGeometry {
  const profile = [
    new THREE.Vector2(0.001, -1),
    new THREE.Vector2(0.55, -0.28),
    new THREE.Vector2(0.62, 0.12),
    new THREE.Vector2(0.5, 0.46),
    new THREE.Vector2(0.001, 1.05),
  ];
  return new THREE.LatheGeometry(profile, 7);
}

/** Размер и центр кристалла: занимает середину будущей пирамиды. */
export function crystalFrame(rows: Parameters<typeof boardLayout>[0]) {
  const { bounds } = boardLayout(rows);
  const height = (bounds.maxY - bounds.minY) * 0.42;
  return { cx: 0, cy: (bounds.minY + bounds.maxY) / 2 + height * 0.08, scale: height / 2 };
}

function logoGeometry(width: number): THREE.BufferGeometry {
  const data = new SVGLoader().parse(logoSvg);
  const shapes = data.paths.flatMap((p) => p.toShapes());
  const g = new THREE.ShapeGeometry(shapes);
  g.computeBoundingBox();
  const box = g.boundingBox!;
  const w = box.max.x - box.min.x;
  const k = width / w;
  // SVG смотрит вниз по y: переворачиваем и центрируем
  g.translate(-(box.min.x + box.max.x) / 2, -(box.min.y + box.max.y) / 2, 0);
  g.scale(k, -k, 1);
  return g;
}

const haloFrag = /* glsl */ `
  uniform vec3 uColor;
  uniform float uStrength;
  varying vec2 vUv;
  void main() {
    float d = length(vUv - 0.5) * 2.0;
    gl_FragColor = vec4(uColor * pow(clamp(1.0 - d, 0.0, 1.0), 2.0) * uStrength, 1.0);
  }
`;
const haloVert = /* glsl */ `
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

export function IntroCrystal() {
  const rows = useGame((s) => s.rows);
  const quality = useGame((s) => s.quality);
  const frame = crystalFrame(rows);
  const root = useRef<THREE.Group>(null);
  const spinner = useRef<THREE.Group>(null);

  const geometry = useMemo(crystalGeometry, []);
  const edges = useMemo(() => new THREE.EdgesGeometry(geometry, 1), [geometry]);
  const material = useMemo(() => {
    const m = createCrystalMaterial(quality);
    m.flatShading = true;
    return m;
  }, [quality]);
  useEffect(() => () => material.dispose(), [material]);
  const edgeMat = useMemo(
    () => new THREE.LineBasicMaterial({ color: '#ffffff', transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false }),
    [],
  );
  const logo = useMemo(() => logoGeometry(1.0), []);
  // Логотип светится изнутри: рисуется поверх кристалла, на любом уровне качества виден «сердцевиной»
  const logoMat = useMemo(
    () => new THREE.MeshBasicMaterial({ color: new THREE.Color('#ff1923').multiplyScalar(1.6), transparent: true, depthTest: false, toneMapped: false, side: THREE.DoubleSide }),
    [],
  );
  const halo = useMemo(
    () =>
      new THREE.ShaderMaterial({
        vertexShader: haloVert,
        fragmentShader: haloFrag,
        uniforms: { uColor: { value: new THREE.Color('#7a5cff') }, uStrength: { value: 0.6 } },
        transparent: true,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
        toneMapped: false,
      }),
    [],
  );

  useFrame(({ clock }) => {
    const g = root.current;
    const sp = spinner.current;
    if (!g || !sp) return;
    const { phase, p } = introStore.getState().phaseNow();
    g.visible = phase === 'crystal' || phase === 'crack';
    if (!g.visible) return;
    const t = clock.elapsedTime;
    const cracking = phase === 'crack' ? p : 0;
    // Трещины разгораются и мерцают, кристалл дрожит всё сильнее
    const jitter = cracking * cracking * 0.12 * frame.scale;
    g.position.set(frame.cx + (Math.random() - 0.5) * jitter, frame.cy + Math.sin(t * 1.2) * 0.15 + (Math.random() - 0.5) * jitter, 0);
    sp.rotation.set(0.12, t * 0.4 + cracking * cracking * 2, 0);
    sp.scale.setScalar(frame.scale * (1 + cracking * 0.06));
    edgeMat.opacity = Math.min(1, cracking * 1.6) * (0.75 + 0.25 * Math.sin(t * 43));
    material.emissiveIntensity = 0.45 + cracking * 2.2;
    logoMat.opacity = 0.9 + 0.1 * Math.sin(t * 2.4);
    halo.uniforms.uStrength.value = 0.55 + 0.15 * Math.sin(t * 1.6) + cracking * 1.2;
  });

  return (
    <group ref={root}>
      <mesh scale={frame.scale * 3.4} position={[0, 0, -1.5]} material={halo}>
        <planeGeometry args={[1, 1]} />
      </mesh>
      <group ref={spinner}>
        <mesh geometry={geometry} material={material} />
        <lineSegments geometry={edges} material={edgeMat} />
      </group>
      <mesh geometry={logo} material={logoMat} scale={frame.scale * 0.95} renderOrder={5} />
    </group>
  );
}
