import { AddEquation, CustomBlending, OneFactor, ZeroFactor, type Material } from 'three'

// far field, pure added light: the opaque list (drawn by renderOrder), no depth, the target alpha kept
export function farAdditive(m: Material): void {
  m.transparent = false
  m.depthTest = false
  m.depthWrite = false
  m.blending = CustomBlending
  m.blendEquation = AddEquation
  m.blendSrc = OneFactor
  m.blendDst = OneFactor
  m.blendSrcAlpha = ZeroFactor
  m.blendDstAlpha = OneFactor
}
