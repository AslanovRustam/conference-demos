import * as THREE from 'three';

/**
 * Цвет камня изнутри. Лучевой материал берёт свет только из тёмной студии, и цветной камень выходит почти чёрным.
 * Эта копия огранки ложится поверх граней и складывается с ними: тело камня светится своим цветом, к краям граней
 * ярче, как у настоящего цветного камня, а блики остаются сверху. Яркость задаёт uColor.
 */
export function createGemBodyMaterial(): THREE.ShaderMaterial {
  return new THREE.ShaderMaterial({
    uniforms: { uColor: { value: new THREE.Color() } },
    vertexShader: /* glsl */ `
      varying vec3 vNormal;
      void main() {
        vNormal = normalize(normalMatrix * normal);
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: /* glsl */ `
      uniform vec3 uColor;
      varying vec3 vNormal;
      void main() {
        float edge = 1.0 - abs(normalize(vNormal).z);
        gl_FragColor = vec4(uColor * (0.5 + 0.8 * edge), 1.0);
      }
    `,
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    toneMapped: false,
  });
}
