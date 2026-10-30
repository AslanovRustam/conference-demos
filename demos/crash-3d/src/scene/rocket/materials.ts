import { Color, MeshPhysicalMaterial, Vector2 } from 'three'
import { LIVERY_RED_SCALE, type RocketTextures } from './textures'

export interface RocketMaterials {
  hull: MeshPhysicalMaterial // white paint under clearcoat, livery, seams, soot (hull atlas)
  carbon: MeshPhysicalMaterial // matte carbon fibre: interstage, fins, pods
  metal: MeshPhysicalMaterial // brushed aluminium joint rings, struts
  nozzle: MeshPhysicalMaterial // dark bronze bells with heat tint
  shield: MeshPhysicalMaterial // ablative heat shield of the capsule
  base: MeshPhysicalMaterial // sooty engine heat shield plate
  boot: MeshPhysicalMaterial // fabric gimbal boots
  glass: MeshPhysicalMaterial // capsule windows
  frame: MeshPhysicalMaterial // dark titanium window frames
  logo: MeshPhysicalMaterial // logo decal on the capsule
}

export function createRocketMaterials(t: RocketTextures): RocketMaterials {
  const hull = new MeshPhysicalMaterial({
    map: t.hull.color,
    roughness: 1, // scaled by the green channel of the orm map
    roughnessMap: t.hull.orm,
    metalness: 0,
    specularIntensity: 0.35, // the pigment layer under the coat barely reflects; the clearcoat carries the gloss
    normalMap: t.hull.normal,
    clearcoat: 0.6,
    clearcoatMap: t.hull.orm, // red channel: soot and seams dull the coat
    clearcoatRoughness: 0.09,
    clearcoatNormalMap: t.hull.normal,
    clearcoatNormalScale: new Vector2(0.7, 0.7),
  })

  const carbon = new MeshPhysicalMaterial({
    map: t.carbon.color,
    roughness: 1,
    roughnessMap: t.carbon.orm,
    metalness: 0,
    normalMap: t.carbon.normal,
    normalScale: new Vector2(0.8, 0.8),
    sheen: 0.5,
    sheenRoughness: 0.4,
    sheenColor: new Color('#3a3f47'),
  })

  const metal = new MeshPhysicalMaterial({
    color: '#80858c',
    metalness: 1,
    roughness: 0.48,
    anisotropy: 0.6, // brushed along the ring
    envMapIntensity: 0.6, // grazing glints on the thin rings would otherwise bloom like markers
  })

  const nozzle = new MeshPhysicalMaterial({
    map: t.nozzle.color,
    metalness: 1,
    roughness: 1,
    roughnessMap: t.nozzle.orm,
    normalMap: t.nozzle.normal,
    envMapIntensity: 1.3,
  })

  const shield = new MeshPhysicalMaterial({
    map: t.shield.color,
    roughness: 1,
    roughnessMap: t.shield.orm,
    normalMap: t.shield.normal,
  })
  for (const tex of [t.shield.color, t.shield.orm, t.shield.normal]) tex.repeat.set(10, 3)

  const plate = {
    map: t.shield.color.clone(),
    roughnessMap: t.shield.orm.clone(),
    normalMap: t.shield.normal.clone(),
  }
  for (const tex of Object.values(plate)) tex.repeat.set(1.5, 1.5)
  const base = new MeshPhysicalMaterial({ ...plate, color: '#8c8782', metalness: 0.6, roughness: 1 })

  const boot = new MeshPhysicalMaterial({
    color: '#16171a',
    roughness: 0.9,
    sheen: 0.8,
    sheenRoughness: 0.6,
    sheenColor: new Color('#4a4d52'),
  })

  const glass = new MeshPhysicalMaterial({
    color: '#05070a',
    emissive: '#ffb47a', // the crew cabin is lit: a faint warm glow behind the glass
    emissiveIntensity: 0.02,
    metalness: 0,
    roughness: 0.03,
    clearcoat: 1,
    clearcoatRoughness: 0.02,
    ior: 1.52,
  })

  const frame = new MeshPhysicalMaterial({ color: '#3a3c41', metalness: 0.9, roughness: 0.35 })

  const logo = new MeshPhysicalMaterial({
    map: t.logo,
    color: new Color(LIVERY_RED_SCALE, LIVERY_RED_SCALE, LIVERY_RED_SCALE), // same paint value as the band
    transparent: true,
    depthWrite: false,
    roughness: 0.32,
    clearcoat: 0.6,
    clearcoatRoughness: 0.06,
    polygonOffset: true,
    polygonOffsetFactor: -2,
    polygonOffsetUnits: -2,
  })

  return { hull, carbon, metal, nozzle, shield, base, boot, glass, frame, logo }
}
