import { useFrame } from '@react-three/fiber';
import { Bloom, ChromaticAberration, EffectComposer, ToneMapping, Vignette } from '@react-three/postprocessing';
import { ToneMappingMode, type BloomEffect, type ChromaticAberrationEffect } from 'postprocessing';
import { useEffect, useMemo, useRef } from 'react';
import * as THREE from 'three';
import { useGame } from '../state/store';
import { fxHooks } from './fxStore';

const BLOOM = { high: 1.2, light: 0.9 } as const;

export function Effects() {
  const quality = useGame((s) => s.quality);
  const bloom = useRef<BloomEffect>(null);
  const ca = useRef<ChromaticAberrationEffect>(null);
  const pulse = useRef({ bloom: 0, ca: 0, t: 1, dur: 1 });
  const caOffset = useMemo(() => new THREE.Vector2(0, 0), []);

  useEffect(() => {
    fxHooks.pulse = (b, c, sec) => {
      pulse.current = { bloom: b, ca: c, t: 0, dur: sec };
    };
    return () => {
      fxHooks.pulse = undefined;
    };
  }, []);

  useFrame((_, dt) => {
    const p = pulse.current;
    p.t = Math.min(p.dur, p.t + dt);
    const env = (1 - p.t / p.dur) ** 2;
    if (bloom.current) bloom.current.intensity = BLOOM[quality] + p.bloom * env;
    if (ca.current) ca.current.offset.set(p.ca * env, p.ca * env * 0.6);
  });

  if (quality === 'high') {
    return (
      <EffectComposer multisampling={2}>
        <Bloom ref={bloom} mipmapBlur luminanceThreshold={0.75} luminanceSmoothing={0.2} intensity={BLOOM.high} />
        <ChromaticAberration ref={ca} offset={caOffset} radialModulation={false} modulationOffset={0} />
        <Vignette darkness={0.6} offset={0.3} />
        <ToneMapping mode={ToneMappingMode.ACES_FILMIC} />
      </EffectComposer>
    );
  }
  return (
    <EffectComposer multisampling={0} resolutionScale={0.75}>
      <Bloom ref={bloom} mipmapBlur luminanceThreshold={0.75} luminanceSmoothing={0.2} intensity={BLOOM.light} resolutionScale={0.5} />
      <Vignette darkness={0.6} offset={0.3} />
      <ToneMapping mode={ToneMappingMode.ACES_FILMIC} />
    </EffectComposer>
  );
}
