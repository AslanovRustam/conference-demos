import { Text } from '@react-three/drei';
import { useFrame } from '@react-three/fiber';
import { useEffect, useRef, useState } from 'react';
import type * as THREE from 'three';
import { boardLayout } from '../math/layout';
import { useGame } from '../state/store';
import { fxHooks } from './fxStore';
import { GEM_FONT_URL } from './Slots';

const POOL = 10;
const RISE = 1.2;
const SECONDS = 1.1;

interface Label {
  slot: number;
  text: string;
  dim: boolean;
  t: number;
}

type TroikaText = THREE.Mesh & { fillOpacity: number; outlineOpacity: number };

export function FloatingWins() {
  const rows = useGame((s) => s.rows);
  const [labels, setLabels] = useState<(Label | null)[]>(() => new Array(POOL).fill(null));
  const live = useRef<(Label | null)[]>(labels);
  const refs = useRef<(TroikaText | null)[]>([]);
  const next = useRef(0);

  useEffect(() => {
    fxHooks.floatText = (slot, text, dim) => {
      const i = next.current;
      next.current = (i + 1) % POOL;
      const copy = [...live.current];
      copy[i] = { slot, text, dim, t: 0 };
      live.current = copy;
      setLabels(copy);
    };
    return () => {
      fxHooks.floatText = undefined;
    };
  }, []);

  useFrame((_, dt) => {
    const { slots } = boardLayout(rows);
    live.current.forEach((label, i) => {
      const mesh = refs.current[i];
      if (!label || !mesh) return;
      label.t += dt;
      const k = Math.min(1, label.t / SECONDS);
      const slot = slots[label.slot] ?? slots[0];
      mesh.position.set(slot.x, slot.y + 0.45 + RISE * (1 - (1 - k) * (1 - k)), 0.6);
      const opacity = k < 0.7 ? 1 : 1 - (k - 0.7) / 0.3;
      mesh.fillOpacity = opacity;
      mesh.outlineOpacity = opacity;
      mesh.visible = k < 1;
    });
  });

  return (
    <>
      {labels.map((label, i) =>
        label ? (
          <Text
            key={i}
            ref={(m) => {
              refs.current[i] = m as unknown as TroikaText | null;
            }}
            font={GEM_FONT_URL}
            fontSize={label.dim ? 0.24 : 0.32}
            anchorX="center"
            anchorY="middle"
            color={label.dim ? '#9a93c9' : '#ffffff'}
            outlineWidth={0.02}
            outlineColor="#1b0f3d"
          >
            {label.text}
          </Text>
        ) : null,
      )}
    </>
  );
}
