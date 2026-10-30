import clickableWoff from '@brand/fonts/CLICKABLE-Black.woff?url';
import { Text } from '@react-three/drei';
import { useFrame } from '@react-three/fiber';
import { useEffect, useMemo, useRef } from 'react';
import * as THREE from 'three';
import { formatMultiplier } from '../core/format';
import { boardLayout } from '../math/layout';
import { getPaytable } from '../math/paytable';
import { useGame } from '../state/store';
import { fxHooks } from './fxStore';
import { createGemMaterial } from './materials';
import { gemColor } from './palette';

export const GEM_FONT_URL = clickableWoff;

const BASE_EMISSIVE = 0.18;
const FLASH_SECONDS = 0.6;

export function Slots() {
  const rows = useGame((s) => s.rows);
  const risk = useGame((s) => s.risk);
  const quality = useGame((s) => s.quality);
  const { slots } = boardLayout(rows);
  const { multipliers } = getPaytable(risk, rows);

  const geometry = useMemo(() => new THREE.CylinderGeometry(0.4, 0.28, 0.32, 8, 1), []);
  const materials = useMemo(
    () => multipliers.map((m) => createGemMaterial(gemColor(m), quality)),
    [multipliers, quality],
  );
  useEffect(() => () => materials.forEach((m) => m.dispose()), [materials]);

  const groups = useRef<(THREE.Group | null)[]>([]);
  const hot = useRef<number[]>([]);

  useEffect(() => {
    hot.current = new Array(slots.length).fill(0);
    fxHooks.flashSlot = (slot, amount) => {
      hot.current[slot] = Math.max(hot.current[slot] ?? 0, amount);
    };
    return () => {
      fxHooks.flashSlot = undefined;
    };
  }, [slots.length]);

  useFrame((_, dt) => {
    slots.forEach((slot, k) => {
      const h = (hot.current[k] = Math.max(0, (hot.current[k] ?? 0) - dt / FLASH_SECONDS));
      const g = groups.current[k];
      if (g) {
        g.position.set(slot.x, slot.y + h * 0.15, 0);
        g.scale.setScalar(1 + 0.15 * h);
      }
      const mat = materials[k];
      if (mat) mat.emissiveIntensity = BASE_EMISSIVE + h * 2.5;
    });
  });

  return (
    <>
      {slots.map((slot, k) => (
        <group
          key={`${rows}-${k}`}
          ref={(g) => {
            groups.current[k] = g;
          }}
          position={[slot.x, slot.y, 0]}
        >
          <mesh geometry={geometry} material={materials[k]} rotation-y={Math.PI / 8} />
          <Text
            font={GEM_FONT_URL}
            fontSize={0.22}
            position={[0, -0.02, 0.45]}
            anchorX="center"
            anchorY="middle"
            color="#ffffff"
            outlineWidth={0.012}
            outlineColor="#1b0f3d"
          >
            {formatMultiplier(multipliers[k])}
          </Text>
        </group>
      ))}
    </>
  );
}
