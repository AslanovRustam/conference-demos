import { useFrame, useThree } from '@react-three/fiber';
import gsap from 'gsap';
import { useEffect, useMemo, useRef } from 'react';
import * as THREE from 'three';
import { computeFraming } from '../math/framing';
import { boardLayout } from '../math/layout';
import { useSim } from '../sim/SimProvider';
import { useGame } from '../state/store';
import { hudInsets } from '../ui/layoutMetrics';
import { fxHooks } from './fxStore';

export const CAMERA_FOV = 35;

const FOLLOW_DISTANCE = 0.45; // доля базовой дистанции при наезде

export function CameraRig() {
  const { bus, system } = useSim();
  const rows = useGame((s) => s.rows);
  const size = useThree((s) => s.size);
  const framing = useMemo(
    () => computeFraming(boardLayout(rows).bounds, size, hudInsets(size), CAMERA_FOV),
    [rows, size],
  );

  const follow = useRef({ k: 0, ballId: null as number | null, x: 0, y: 0 });
  const shake = useRef({ amp: 0, dur: 1, t: 1 });
  const target = useMemo(() => new THREE.Vector3(), []);

  useEffect(() => {
    const f = follow.current;
    const offStart = bus.on('slowmo:start', (e) => {
      const ball = system.balls.find((b) => b.id === e.ballId);
      f.ballId = e.ballId;
      if (ball) {
        f.x = ball.sample.x;
        f.y = ball.sample.y;
      }
      gsap.killTweensOf(f);
      gsap.to(f, { k: 1, duration: 0.35, ease: 'power2.out' });
    });
    const offEnd = bus.on('slowmo:end', () => {
      gsap.killTweensOf(f);
      gsap.to(f, { k: 0, duration: 0.8, delay: 0.3, ease: 'power2.inOut', onComplete: () => void (f.ballId = null) });
    });
    fxHooks.shake = (amp, sec) => {
      const s = shake.current;
      const left = s.t < s.dur ? s.amp * (1 - s.t / s.dur) : 0;
      s.amp = Math.max(amp, left);
      s.dur = sec;
      s.t = 0;
    };
    return () => {
      offStart();
      offEnd();
      gsap.killTweensOf(f);
      fxHooks.shake = undefined;
    };
  }, [bus, system]);

  useFrame(({ camera, clock }, dt) => {
    const t = clock.elapsedTime;
    const f = follow.current;
    const ball = f.ballId === null ? undefined : system.balls.find((b) => b.id === f.ballId);
    if (ball) {
      const a = 1 - Math.exp(-dt * 8);
      f.x += (ball.sample.x - f.x) * a;
      f.y += (ball.sample.y - f.y) * a;
    }

    const k = f.k;
    const bx = framing.x + Math.sin(t * 0.3) * 0.05;
    const by = framing.y + Math.cos(t * 0.25) * 0.05;
    let x = bx + (f.x - bx) * k;
    let y = by + (f.y - by) * k;
    const z = framing.z * (1 - k * (1 - FOLLOW_DISTANCE));

    const s = shake.current;
    let roll = 0;
    if (s.t < s.dur) {
      s.t += dt;
      const env = s.amp * (1 - s.t / s.dur) ** 2;
      x += env * (Math.sin(t * 47) + Math.sin(t * 83) * 0.5);
      y += env * (Math.cos(t * 53) + Math.sin(t * 71) * 0.5);
      roll = env * 0.03 * Math.sin(t * 61);
    }

    // Камера всегда смотрит прямо на плоскость пирамиды (framing.x совпадает с targetX)
    camera.position.set(x, y, z);
    target.set(x, y, 0);
    camera.lookAt(target);
    camera.rotation.z += roll;
  });
  return null;
}
