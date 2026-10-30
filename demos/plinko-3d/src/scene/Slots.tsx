import clickableWoff from '@brand/fonts/CLICKABLE-Black.woff?url';
import { Text } from '@react-three/drei';
import { useFrame } from '@react-three/fiber';
import { useEffect, useMemo, useRef, useState } from 'react';
import * as THREE from 'three';
import { formatMultiplier } from '../core/format';
import { boardLayout } from '../math/layout';
import { getPaytable } from '../math/paytable';
import { useGame } from '../state/store';
import { fxHooks } from './fxStore';
import { createGemMaterial } from './materials';
import { gemColor } from './palette';
import { useRowsTransition } from './rowsTransition';

export const GEM_FONT_URL = clickableWoff;

const BASE_EMISSIVE = 0.18;
const FLASH_SECONDS = 0.6;
const FLIP_SECONDS = 0.25;
const FLIP_STEP = 0.02; // волна переворота подписей от центра к краям

export function Slots() {
  const rows = useGame((s) => s.rows);
  const risk = useGame((s) => s.risk);
  const quality = useGame((s) => s.quality);
  const transition = useRowsTransition(rows);
  const shown = transition.shown;
  const { slots } = boardLayout(shown);
  const target = getPaytable(risk, shown).multipliers;

  const geometry = useMemo(() => new THREE.CylinderGeometry(0.4, 0.28, 0.32, 8, 1), []);
  const targetColors = useMemo(() => target.map((m) => new THREE.Color(gemColor(m))), [target]);
  // Материалы живут, пока не сменились ряды или качество; при смене риска цвет перетекает плавно
  const materials = useMemo(
    () => getPaytable(risk, shown).multipliers.map((m) => createGemMaterial(gemColor(m), quality)),
    [shown, quality], // risk намеренно не в зависимостях: его смену отрабатывает плавная перекраска

  );
  useEffect(() => () => materials.forEach((m) => m.dispose()), [materials]);

  const [labels, setLabels] = useState(() => target.map(formatMultiplier));
  const labelsRef = useRef(labels);
  labelsRef.current = labels;
  const flips = useRef<number[]>([]);
  const prevShown = useRef(shown);

  useEffect(() => {
    if (prevShown.current !== shown) {
      // Новая пирамида: подписи сразу верные, камни вырастают с анимацией появления
      prevShown.current = shown;
      flips.current = new Array(target.length).fill(-1);
      setLabels(target.map(formatMultiplier));
      return;
    }
    const now = performance.now() / 1000;
    const center = (target.length - 1) / 2;
    target.forEach((m, k) => {
      if (formatMultiplier(m) !== labelsRef.current[k]) flips.current[k] = now + Math.abs(k - center) * FLIP_STEP;
    });
  }, [shown, target]);

  const groups = useRef<(THREE.Group | null)[]>([]);
  const labelGroups = useRef<(THREE.Group | null)[]>([]);
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
    const now = performance.now() / 1000;
    const appear = transition.scaleFor(shown, now);
    const ease = 1 - Math.exp(-dt * 8);
    let swapped: string[] | null = null;
    slots.forEach((slot, k) => {
      const h = (hot.current[k] = Math.max(0, (hot.current[k] ?? 0) - dt / FLASH_SECONDS));
      const g = groups.current[k];
      if (g) {
        g.position.set(slot.x, slot.y + h * 0.15, 0);
        g.scale.setScalar((1 + 0.15 * h) * appear);
      }
      const mat = materials[k];
      if (mat && targetColors[k]) {
        mat.color.lerp(targetColors[k], ease);
        mat.emissive.lerp(targetColors[k], ease);
        mat.emissiveIntensity = BASE_EMISSIVE + h * 2.5;
      }
      const start = flips.current[k] ?? -1;
      const lg = labelGroups.current[k];
      if (start < 0 || now < start) {
        if (lg) lg.scale.y = 1;
        return;
      }
      const p = Math.min(1, (now - start) / FLIP_SECONDS);
      if (lg) lg.scale.y = Math.abs(Math.cos(Math.PI * p));
      const next = formatMultiplier(target[k]);
      if (p >= 0.5 && labelsRef.current[k] !== next) {
        swapped ??= [...labelsRef.current];
        swapped[k] = next;
      }
      if (p >= 1) flips.current[k] = -1;
    });
    if (swapped) {
      labelsRef.current = swapped;
      setLabels(swapped);
    }
  });

  return (
    <>
      {slots.map((slot, k) => (
        <group
          key={`${shown}-${k}`}
          ref={(g) => {
            groups.current[k] = g;
          }}
          position={[slot.x, slot.y, 0]}
        >
          <mesh geometry={geometry} material={materials[k]} rotation-y={Math.PI / 8} />
          <group
            position={[0, -0.02, 0.45]}
            ref={(g) => {
              labelGroups.current[k] = g;
            }}
          >
            <Text
              font={GEM_FONT_URL}
              fontSize={(labels[k] ?? '').length >= 4 ? 0.24 : 0.3}
              anchorX="center"
              anchorY="middle"
              color="#ffffff"
              outlineWidth={0.012}
              outlineColor="#1b0f3d"
            >
              {labels[k] ?? ''}
            </Text>
          </group>
        </group>
      ))}
    </>
  );
}
