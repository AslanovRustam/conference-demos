import { useFrame, useThree } from '@react-three/fiber';
import { useMemo } from 'react';
import * as THREE from 'three';
import { computeFraming } from '../math/framing';
import { boardLayout } from '../math/layout';
import { useGame } from '../state/store';
import { hudInsets } from '../ui/layoutMetrics';

export const CAMERA_FOV = 35;

export function CameraRig() {
  const rows = useGame((s) => s.rows);
  const size = useThree((s) => s.size);
  const framing = useMemo(
    () => computeFraming(boardLayout(rows).bounds, size, hudInsets(size), CAMERA_FOV),
    [rows, size],
  );
  const target = useMemo(() => new THREE.Vector3(), []);

  useFrame(({ camera, clock }) => {
    const t = clock.elapsedTime;
    camera.position.set(framing.x + Math.sin(t * 0.3) * 0.05, framing.y + Math.cos(t * 0.25) * 0.05, framing.z);
    target.set(framing.targetX, framing.targetY, 0);
    camera.lookAt(target);
  });
  return null;
}
