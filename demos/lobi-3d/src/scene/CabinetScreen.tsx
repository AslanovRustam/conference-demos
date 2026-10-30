import { useFrame } from '@react-three/fiber'
import { useEffect, useMemo, useRef } from 'react'
import * as THREE from 'three'
import type { Slot } from '../config/games'
import { SCREEN } from './layout'
import { createScreenMaterial, makeTitleTexture, SCREEN_MODE } from './screenMaterial'

interface Props {
  index: number
  slot: Slot
  loading: boolean
  /** only the active cabinet decodes its preview video; the others show the poster */
  near: boolean
  dim: number
  flash: { current: number }
  z: number
}

export default function CabinetScreen({ index, slot, loading, near, dim, flash, z }: Props) {
  const material = useMemo(createScreenMaterial, [])
  const video = useRef<HTMLVideoElement | null>(null)

  // recorded gameplay loop; the poster stands in until it plays and the last frame stays when paused
  useEffect(() => {
    if (slot.kind !== 'game' || !slot.game.preview) return
    const u = material.uniforms
    const { preview, poster, previewStart = 0 } = slot.game
    let posterTex: THREE.Texture | null = null
    if (poster) {
      posterTex = new THREE.TextureLoader().load(poster, (tex) => {
        if (u.uVideo.value) return
        tex.colorSpace = THREE.SRGBColorSpace
        u.uVideo.value = tex
        u.uHasVideo.value = true
      })
    }
    const el = document.createElement('video')
    Object.assign(el, { src: preview, muted: true, loop: true, playsInline: true, preload: 'auto' })
    const videoTex = new THREE.VideoTexture(el)
    videoTex.colorSpace = THREE.SRGBColorSpace
    // skip the game's own loading at the head of the recording, also on every loop
    const skipHead = () => {
      if (el.currentTime < previewStart) el.currentTime = previewStart
    }
    const onPlaying = () => {
      u.uVideo.value = videoTex
      u.uHasVideo.value = true
    }
    const onError = () => {
      if (u.uVideo.value === videoTex) u.uHasVideo.value = false
    }
    el.addEventListener('loadedmetadata', skipHead)
    el.addEventListener('timeupdate', skipHead)
    el.addEventListener('playing', onPlaying)
    el.addEventListener('error', onError)
    video.current = el
    return () => {
      video.current = null
      el.pause()
      el.removeAttribute('src')
      el.load()
      videoTex.dispose()
      posterTex?.dispose()
      u.uVideo.value = null
      u.uHasVideo.value = false
    }
  }, [slot, material])

  useEffect(() => {
    const el = video.current
    if (!el) return
    if (near) el.play().catch(() => {})
    else el.pause()
  }, [near, slot])

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
