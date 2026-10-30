import type { MeshStandardMaterial, Texture } from 'three'

// three applies a material's envMapIntensity only when the material has its own envMap; with scene.environment
// alone every material reflects the environment at full strength. the pad's warm lamp banks in the environment
// map would glaze the wet concrete, so pad materials take the scene environment as their own envMap, and their
// envMapIntensity counts. the texture is the same one, so no shader recompiles
export const padLit = new Set<MeshStandardMaterial>()

export function syncPadEnv(env: Texture | null): void {
  for (const m of padLit) if (m.envMap !== env) m.envMap = env
}
