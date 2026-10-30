import * as THREE from 'three';
import type { Quality } from '../core/types';
import { CRYSTAL } from './palette';

export function createCrystalMaterial(q: Quality): THREE.MeshPhysicalMaterial {
  if (q === 'high') {
    return new THREE.MeshPhysicalMaterial({
      color: CRYSTAL.light,
      transmission: 0.85,
      thickness: 0.4,
      ior: 1.7,
      dispersion: 4,
      roughness: 0.03,
      iridescence: 0.7,
      iridescenceIOR: 1.3,
      attenuationColor: new THREE.Color(CRYSTAL.light),
      attenuationDistance: 2,
      envMapIntensity: 3,
      emissive: new THREE.Color(CRYSTAL.deep),
      emissiveIntensity: 0.45,
      flatShading: true,
    });
  }
  return new THREE.MeshPhysicalMaterial({
    color: CRYSTAL.light,
    transmission: 0,
    metalness: 0.1,
    roughness: 0.05,
    iridescence: 0.8,
    iridescenceIOR: 1.3,
    envMapIntensity: 2.5,
    emissive: new THREE.Color(CRYSTAL.deep),
    emissiveIntensity: 0.5,
    flatShading: true,
  });
}

export function createGemMaterial(color: string, q: Quality): THREE.MeshPhysicalMaterial {
  const base = new THREE.Color(color);
  return new THREE.MeshPhysicalMaterial({
    color: base,
    transmission: q === 'high' ? 0.6 : 0,
    thickness: 0.5,
    ior: 1.8,
    dispersion: q === 'high' ? 3 : 0,
    roughness: 0.04,
    metalness: q === 'high' ? 0 : 0.15,
    iridescence: 0.4,
    envMapIntensity: 2,
    emissive: base,
    emissiveIntensity: 0.18,
    flatShading: true,
  });
}

export function createChromeMaterial(): THREE.MeshStandardMaterial {
  // Лёгкое собственное свечение, чтобы маленький хромированный шарик читался на тёмном фоне
  return new THREE.MeshStandardMaterial({
    color: '#f2f3fb',
    metalness: 1,
    roughness: 0.12,
    envMapIntensity: 3.5,
    emissive: new THREE.Color('#8c7fd0'),
    emissiveIntensity: 0.25,
  });
}
