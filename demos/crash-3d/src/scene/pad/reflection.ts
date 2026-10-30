import {
  Box3,
  Frustum,
  HalfFloatType,
  LinearFilter,
  LinearMipmapLinearFilter,
  Matrix4,
  PerspectiveCamera,
  Plane,
  Vector3,
  Vector4,
  WebGLRenderTarget,
  type Camera,
  type MeshStandardMaterial,
  type Object3D,
  type Scene,
  type WebGLRenderer,
} from 'three'
import { params } from '../../platform/params'

// planar reflection for the wet apron: each frame the apron is in view, the scene is drawn once more, at reduced
// size, from the camera mirrored under the ground plane; the apron's material adds it as a mirror term where the
// concrete is wet (sharp in puddles, blurred through the mip chain on damp concrete) with fresnel, so it shows
// mostly at grazing angles. the extra pass skips shadow map updates and whatever registered itself as hidden
// (the ground, beams). with the apron out of view there is no pass: the old image is never seen, the next frame
// that sees the apron draws a fresh one first

const UP = new Vector3(0, 1, 0)
const MAX_LOD = 6

// objects left out of the reflection pass: the reflecting ground itself, the floodlight beams
export const notReflected = new Set<Object3D>()

declare global {
  interface Window {
    __padReflection?: { drawn: number; skipped: number }
  }
}

// passes drawn and frames skipped since load; with ?debug=1 also on window.__padReflection
export const reflectionStats = { drawn: 0, skipped: 0 }
if (params.debug && typeof window !== 'undefined') window.__padReflection = reflectionStats

export class PlanarReflection {
  readonly target: WebGLRenderTarget
  readonly uniforms = {
    tReflect: { value: null as WebGLRenderTarget['texture'] | null },
    uReflectMatrix: { value: new Matrix4() },
    uReflectLod: { value: MAX_LOD },
    uReflectGain: { value: 1 },
  }
  private readonly cam = new PerspectiveCamera()
  private readonly frustum = new Frustum()
  private readonly viewProj = new Matrix4()
  private readonly apron = new Box3()
  private readonly radius: number
  private readonly plane = new Plane()
  private readonly clip = new Vector4()
  private readonly q = new Vector4()
  private readonly v = { pos: new Vector3(), eye: new Vector3(), view: new Vector3(), look: new Vector3(), target: new Vector3(), rot: new Matrix4() }

  // radius: half the size of the reflecting surface around the world origin, m
  constructor(radius: number) {
    this.radius = radius
    this.target = new WebGLRenderTarget(1, 1, {
      type: HalfFloatType,
      minFilter: LinearMipmapLinearFilter,
      magFilter: LinearFilter,
      generateMipmaps: true,
      depthBuffer: true,
    })
    this.uniforms.tReflect.value = this.target.texture
  }

  setSize(width: number, height: number): void {
    const w = Math.max(1, Math.round(width))
    const h = Math.max(1, Math.round(height))
    if (this.target.width !== w || this.target.height !== h) this.target.setSize(w, h)
  }

  // nothing more to reflect (the apron is out of range): the wet term fades out instead of showing an old image
  off(): void {
    this.uniforms.uReflectGain.value = 0
  }

  // mirror `camera` under the horizontal plane at world height y and draw the scene into the target,
  // if the apron is in its view; returns whether a pass was drawn
  render(renderer: WebGLRenderer, scene: Scene, camera: Camera, y: number): boolean {
    const { pos, eye, view, look, target, rot } = this.v
    // the camera rig moved the camera this frame; three refreshes its matrices only inside render()
    camera.updateMatrixWorld()
    pos.set(0, y, 0)
    eye.setFromMatrixPosition(camera.matrixWorld)
    // below the water line there is nothing to reflect (and the apron shows its back)
    if (eye.y <= y) {
      this.off()
      return this.skip()
    }
    // the apron out of frame (looking up, looking away): no pass
    const r = this.radius
    this.apron.min.set(-r, y - 0.5, -r)
    this.apron.max.set(r, y + 0.5, r)
    this.frustum.setFromProjectionMatrix(this.viewProj.multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse))
    if (!this.frustum.intersectsBox(this.apron)) return this.skip()
    view.subVectors(pos, eye).reflect(UP).negate().add(pos)
    rot.extractRotation(camera.matrixWorld)
    look.set(0, 0, -1).applyMatrix4(rot).add(eye)
    target.subVectors(pos, look).reflect(UP).negate().add(pos)
    const cam = this.cam
    cam.position.copy(view)
    cam.up.set(0, 1, 0).applyMatrix4(rot).reflect(UP)
    cam.lookAt(target)
    cam.far = (camera as PerspectiveCamera).far ?? 30000
    cam.updateMatrixWorld()
    cam.projectionMatrix.copy(camera.projectionMatrix)

    // world position -> reflection texture uv
    this.uniforms.uReflectMatrix.value
      .set(0.5, 0, 0, 0.5, 0, 0.5, 0, 0.5, 0, 0, 0.5, 0.5, 0, 0, 0, 1)
      .multiply(cam.projectionMatrix)
      .multiply(cam.matrixWorldInverse)

    // oblique near plane on the ground: nothing under it gets drawn
    this.plane.setFromNormalAndCoplanarPoint(UP, pos).applyMatrix4(cam.matrixWorldInverse)
    this.clip.set(this.plane.normal.x, this.plane.normal.y, this.plane.normal.z, this.plane.constant)
    const p = cam.projectionMatrix.elements
    const q = this.q
    q.x = (Math.sign(this.clip.x) + p[8]) / p[0]
    q.y = (Math.sign(this.clip.y) + p[9]) / p[5]
    q.z = -1
    q.w = (1 + p[10]) / p[14]
    this.clip.multiplyScalar(2 / this.clip.dot(q))
    p[2] = this.clip.x
    p[6] = this.clip.y
    p[10] = this.clip.z + 1
    p[14] = this.clip.w
    // the mirror camera is ours alone, but keep it whole for anything that reads the inverse
    cam.projectionMatrixInverse.copy(cam.projectionMatrix).invert()

    const shown: Object3D[] = []
    for (const o of notReflected) {
      if (o.visible) {
        o.visible = false
        shown.push(o)
      }
    }
    const autoShadows = renderer.shadowMap.autoUpdate
    const prev = renderer.getRenderTarget()
    renderer.shadowMap.autoUpdate = false
    renderer.setRenderTarget(this.target)
    renderer.clear()
    renderer.render(scene, cam)
    renderer.setRenderTarget(prev)
    renderer.shadowMap.autoUpdate = autoShadows
    for (const o of shown) o.visible = true
    this.uniforms.uReflectGain.value = 1
    reflectionStats.drawn++
    return true
  }

  private skip(): false {
    reflectionStats.skipped++
    return false
  }

  dispose(): void {
    this.target.dispose()
  }
}

// adds the reflection to a standard material: a mirror term after lighting, strongest where the surface is smooth
export function wetReflection(material: MeshStandardMaterial, r: PlanarReflection): void {
  material.onBeforeCompile = (shader) => {
    Object.assign(shader.uniforms, r.uniforms)
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\nuniform mat4 uReflectMatrix;\nvarying vec4 vReflect;')
      .replace('#include <project_vertex>', '#include <project_vertex>\nvReflect = uReflectMatrix * modelMatrix * vec4(transformed, 1.0);')
    shader.fragmentShader = shader.fragmentShader
      .replace(
        '#include <common>',
        '#include <common>\nuniform sampler2D tReflect;\nuniform float uReflectLod;\nuniform float uReflectGain;\nvarying vec4 vReflect;',
      )
      .replace(
        '#include <opaque_fragment>',
        /* glsl */ `
        {
          // puddles are mirrors, damp concrete a blurred sheen, dry concrete none
          float wet = 1.0 - smoothstep(0.04, 0.5, roughnessFactor);
          float ndv = clamp(dot(normal, normalize(vViewPosition)), 0.0, 1.0);
          float fres = 0.02 + 0.98 * pow(1.0 - ndv, 5.0);
          // the normal map ripples the image a little
          vec2 ruv = vReflect.xy / vReflect.w + (normal.xy - nonPerturbedNormal.xy) * 0.06;
          vec3 refl = textureLod(tReflect, ruv, roughnessFactor * uReflectLod).rgb;
          outgoingLight += refl * (fres * wet * uReflectGain);
        }
        #include <opaque_fragment>`,
      )
  }
  material.customProgramCacheKey = () => 'pad-wet-reflection'
}
