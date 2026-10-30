import { useFrame } from '@react-three/fiber'
import { useEffect, useMemo } from 'react'
import type { Slot } from '../config/games'
import { SCREEN } from './layout'
import { createScreenMaterial, makeTitleTexture, SCREEN_MODE } from './screenMaterial'

interface Props {
  index: number
  slot: Slot
  loading: boolean
  dim: number
  flash: { current: number }
  z: number
}

export default function CabinetScreen({ index, slot, loading, dim, flash, z }: Props) {
  const material = useMemo(createScreenMaterial, [])

  useEffect(() => {
    let alive = true
    const card =
      slot.kind === 'game'
        ? makeTitleTexture(slot.game.title, slot.game.subtitle)
        : slot.title
          ? makeTitleTexture('COMING SOON', slot.title)
          : makeTitleTexture('COMING SOON', 'COMING SOON', true)
    card.then((tex) => {
      if (!alive) return tex.dispose()
      material.uniforms.uTitle.value?.dispose()
      material.uniforms.uTitle.value = tex
      material.uniforms.uHasTitle.value = true
    })
    return () => {
      alive = false
    }
  }, [slot, material])

  useEffect(() => () => {
    material.uniforms.uTitle.value?.dispose()
    material.dispose()
  }, [material])

  useFrame((_, dt) => {
    const u = material.uniforms
    u.uTime.value += dt
    u.uMode.value = loading ? SCREEN_MODE.loading : slot.kind === 'soon' ? SCREEN_MODE.soon : SCREEN_MODE.title
    u.uDim.value += (dim - u.uDim.value) * Math.min(1, dt * 6)
    u.uFlash.value = flash.current
  })

  return (
    <mesh name={`screen-${index}`} position={[0, SCREEN.y, z]} material={material}>
      <planeGeometry args={[SCREEN.w, SCREEN.h]} />
    </mesh>
  )
}
