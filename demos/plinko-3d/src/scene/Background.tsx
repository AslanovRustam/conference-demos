import { useFrame } from '@react-three/fiber';
import { useMemo, useRef } from 'react';
import * as THREE from 'three';
import { boardLayout } from '../math/layout';
import { useGame } from '../state/store';
import { BG } from './palette';

const gradientVert = /* glsl */ `
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = vec4(position.xy, 1.0, 1.0);
  }
`;

const gradientFrag = /* glsl */ `
  uniform vec3 uTop;
  uniform vec3 uBottom;
  varying vec2 vUv;
  void main() {
    gl_FragColor = vec4(mix(uBottom, uTop, smoothstep(0.0, 1.0, vUv.y)), 1.0);
    #include <colorspace_fragment>
  }
`;

const haloFrag = /* glsl */ `
  uniform vec3 uColor;
  varying vec2 vUv;
  void main() {
    float d = length(vUv - 0.5) * 2.0;
    float a = pow(clamp(1.0 - d, 0.0, 1.0), 2.2) * 0.55;
    gl_FragColor = vec4(uColor, a);
    #include <colorspace_fragment>
  }
`;

const haloVert = /* glsl */ `
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

const dustVert = /* glsl */ `
  uniform float uTime;
  uniform float uPixelRatio;
  attribute float aSeed;
  varying float vAlpha;
  void main() {
    vec3 p = position;
    p.y += mod(uTime * (0.15 + aSeed * 0.25) + aSeed * 40.0, 24.0) - 12.0;
    p.x += sin(uTime * 0.3 + aSeed * 12.0) * 0.4;
    vec4 mv = modelViewMatrix * vec4(p, 1.0);
    gl_Position = projectionMatrix * mv;
    gl_PointSize = (1.5 + aSeed * 2.5) * uPixelRatio * (30.0 / -mv.z);
    vAlpha = 0.25 + 0.5 * fract(aSeed * 7.13);
  }
`;

const dustFrag = /* glsl */ `
  uniform vec3 uColor;
  varying float vAlpha;
  void main() {
    float d = length(gl_PointCoord - 0.5);
    float a = smoothstep(0.5, 0.0, d) * vAlpha;
    gl_FragColor = vec4(uColor, a);
  }
`;

function Dust({ count, centerY }: { count: number; centerY: number }) {
  const material = useRef<THREE.ShaderMaterial>(null);
  const geometry = useMemo(() => {
    const g = new THREE.BufferGeometry();
    const pos = new Float32Array(count * 3);
    const seed = new Float32Array(count);
    for (let i = 0; i < count; i++) {
      pos[i * 3] = (Math.random() - 0.5) * 30;
      pos[i * 3 + 1] = centerY + (Math.random() - 0.5) * 4;
      pos[i * 3 + 2] = -8 + Math.random() * 12;
      seed[i] = Math.random();
    }
    g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    g.setAttribute('aSeed', new THREE.BufferAttribute(seed, 1));
    return g;
  }, [count, centerY]);
  const uniforms = useMemo(
    () => ({ uTime: { value: 0 }, uPixelRatio: { value: 1 }, uColor: { value: new THREE.Color('#b9a7ff') } }),
    [],
  );
  useFrame(({ clock, gl }) => {
    if (!material.current) return;
    material.current.uniforms.uTime.value = clock.elapsedTime;
    material.current.uniforms.uPixelRatio.value = gl.getPixelRatio();
  });
  return (
    <points geometry={geometry} frustumCulled={false}>
      <shaderMaterial
        ref={material}
        vertexShader={dustVert}
        fragmentShader={dustFrag}
        uniforms={uniforms}
        transparent
        depthWrite={false}
        blending={THREE.AdditiveBlending}
      />
    </points>
  );
}

export function Background() {
  const rows = useGame((s) => s.rows);
  const quality = useGame((s) => s.quality);
  const { bounds } = boardLayout(rows);
  const centerY = (bounds.minY + bounds.maxY) / 2;
  const gradient = useMemo(() => ({ uTop: { value: new THREE.Color(BG.top) }, uBottom: { value: new THREE.Color(BG.bottom) } }), []);
  const halo = useMemo(() => ({ uColor: { value: new THREE.Color(BG.halo) } }), []);

  return (
    <>
      <mesh frustumCulled={false} renderOrder={-10}>
        <planeGeometry args={[2, 2]} />
        <shaderMaterial vertexShader={gradientVert} fragmentShader={gradientFrag} uniforms={gradient} depthWrite={false} depthTest={false} />
      </mesh>
      <mesh position={[0, centerY, -5]} renderOrder={-9}>
        <planeGeometry args={[44, 44]} />
        <shaderMaterial vertexShader={haloVert} fragmentShader={haloFrag} uniforms={halo} transparent depthWrite={false} />
      </mesh>
      <Dust count={quality === 'high' ? 300 : 120} centerY={centerY} />
    </>
  );
}
