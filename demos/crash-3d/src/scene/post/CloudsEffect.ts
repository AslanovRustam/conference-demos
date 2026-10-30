import { BlendFunction, Effect, EffectAttribute } from 'postprocessing'
import {
  BufferGeometry,
  Color,
  Float32BufferAttribute,
  GLSL3,
  HalfFloatType,
  LinearFilter,
  Mesh,
  NoBlending,
  OrthographicCamera,
  PerspectiveCamera,
  ShaderMaterial,
  Uniform,
  Vector2,
  Vector3,
  Vector4,
  WebGLRenderTarget,
  type Camera,
  type DataTexture,
  type Scene,
  type Texture,
  type WebGLRenderer,
} from 'three'
import { BLUE_SIZE, blueTexture, type CloudNoise } from '../clouds/noise'
import { blueNoise } from '../clouds/noiseGen'
import {
  compositeFragment,
  DETAIL_TILE_M,
  marchDefines,
  marchFragment,
  marchVertex,
  SHAPE_TILE_M,
  UNDER_LIGHTS,
  WEATHER_TILE_M,
} from '../clouds/cloudsShader'
import { smoothstep } from '../env/atmosphere'
import { lightState } from '../env/lightState'
import { FX_NEAR_LAYER, FX_PAD_LAYER } from '../layers'
import { ACTIVE_FLOODS } from '../pad/Floodlights'
import { floodPos, HIDE_ALT_M } from '../pad/layout'
import { QUALITY } from '../quality'
import { CLOUD_BASE_M, CLOUD_TOP_M, rig } from '../rig'
import { plumeLight } from '../rocket/Plume'
import { rocketRefs } from '../rocket/refs'

// art direction of the deck's light. the scene's lights are tuned for meters around the rocket; the deck is
// kilometers away, so the lamps under it get their own gains (the real flame is millions of candela)
const KEY_GAIN = 1.6 // moon or sun on the clouds, times lightState.keyIntensity
const DIFFUSE_GAIN = 0.05 // the moon's light that soaks through the deck at night, as sky light from above
const SKY_GAIN = 5
const GROUND_GAIN = 2
const NIGHT_GLOW = new Color(0.0035, 0.0028, 0.0022) // the complex and the towns around it, lighting the deck from below
// the lamps under the deck: [softening radius m, phase anisotropy]. a lit cloud base scatters light many times,
// more like a matte wall than a single scattering would: UNDER_MS brightens all of them
const UNDER_MS = 3
// the flame lights the nearest part of the deck to about this, at full thrust (a real flame is ten million
// candela: under the deck it outshines the moon over kilometers). its intensity follows the distance to the deck,
// up to FLAME_REACH; inside the deck that leaves a glow right around the flame, and the rocket shows through
const FLAME_E = 14
const FLAME_REACH = 1600
const PLUME_SHAPE = [30, 0.6]
const LIGHT_CD = 900 // plumeLight at full thrust (rocket/Plume.tsx)
const PAD_GLOW_CD = 2.5e5 // the floodlit pad as one broad lamp under the deck
const PAD_GLOW = new Color(0.86, 0.88, 0.95)
const PAD_GLOW_Y = 40
const PAD_SHAPE = [900, 0.15]
const SEARCH_GAIN = 6 // times the searchlights' candela
const SEARCH_SHAPE = [100, 0.5]
const PLUME_REACH = 110 // m below the nozzles: the visible flame lies on this segment
const WIND = new Vector2(7, 2.5) // m/s, the deck drifts
const BOIL = 1.2 // m/s the fine detail rises and churns
const COVER: [number, number] = [0.36, 0.64]
const FADE_ALT: [number, number] = [24000, 36000] // the deck hands over to the earth's own clouds (task 16)

const v = new Vector3()

// how far an altitude is from the deck (0 inside it)
function toDeck(alt: number): number {
  return alt < CLOUD_BASE_M ? CLOUD_BASE_M - alt : Math.max(0, alt - CLOUD_TOP_M)
}

function wrap(x: number, p: number): number {
  return ((x % p) + p) % p
}

// a triangle that covers the screen
function screenTriangle(): BufferGeometry {
  const g = new BufferGeometry()
  g.setAttribute('position', new Float32BufferAttribute([-1, -1, 0, 3, -1, 0, -1, 3, 0], 3))
  return g
}

// volumetric cloud deck between CLOUD_BASE_M and CLOUD_TOP_M (sinking with rig.nearOffset like the rest of the near
// field): raymarched at QUALITY.cloudScale of the screen into two targets (the whole ray, and the part in front of
// the near effects), then upsampled by depth and composited first in the post chain. lit by the key light from
// lightState (the moon, then the rising sun), the flame (plumeLight), the floodlit pad and its two searchlights.
// the near effects (FX_NEAR_LAYER, FX_PAD_LAYER) are drawn once more on their own so the clouds go behind them
export class CloudsEffect extends Effect {
  private readonly march: ShaderMaterial
  private readonly quad: Mesh
  private readonly quadCam = new OrthographicCamera()
  private readonly low: WebGLRenderTarget
  private readonly fx: WebGLRenderTarget
  private readonly on: Uniform<number>
  private readonly lowSize: Uniform<Vector2>
  private camera: PerspectiveCamera | null = null
  private scene: Scene | null = null
  private depth: Texture | null = null
  private readonly camPos = new Vector3()
  private readonly clear = new Color()
  private readonly tmp = new Color()
  private readonly searchlights = ACTIVE_FLOODS.filter((f) => !f.mast).slice(0, UNDER_LIGHTS - 2)
  private readonly ownBlue: DataTexture | null // built here when the caller brings no blue noise

  constructor({ shape, weather, blue }: Pick<CloudNoise, 'shape' | 'weather'> & Partial<Pick<CloudNoise, 'blue'>>) {
    const on = new Uniform(0)
    const lowSize = new Uniform(new Vector2(1, 1))
    const low = new WebGLRenderTarget(1, 1, { count: 2, type: HalfFloatType, depthBuffer: false, minFilter: LinearFilter, magFilter: LinearFilter })
    low.textures[0].name = 'Clouds.All'
    low.textures[1].name = 'Clouds.Front'
    const fx = new WebGLRenderTarget(1, 1, { type: HalfFloatType, depthBuffer: false })
    fx.texture.name = 'Clouds.NearFx'
    super('CloudsEffect', compositeFragment, {
      attributes: EffectAttribute.DEPTH,
      blendFunction: BlendFunction.NORMAL,
      uniforms: new Map<string, Uniform>([
        ['tAll', new Uniform(low.textures[0])],
        ['tFront', new Uniform(low.textures[1])],
        ['tFx', new Uniform(fx.texture)],
        ['lowSize', lowSize],
        ['cloudsOn', on],
      ]),
    })
    this.on = on
    this.lowSize = lowSize
    this.ownBlue = blue ? null : blueTexture(blueNoise(BLUE_SIZE))
    this.low = low
    this.fx = fx

    const vec3s = () => Array.from({ length: UNDER_LIGHTS }, () => new Vector3())
    this.march = new ShaderMaterial({
      name: 'CloudsMarch',
      glslVersion: GLSL3,
      vertexShader: marchVertex,
      fragmentShader: marchFragment,
      defines: marchDefines({
        steps: QUALITY.cloudSteps,
        lightSteps: QUALITY.cloudLightSteps,
        underSteps: QUALITY.cloudUnderSteps,
        noiseSize: QUALITY.cloudNoiseSize,
        weatherSize: QUALITY.cloudWeatherSize,
      }),
      uniforms: {
        tDepth: { value: null },
        tShape: { value: shape },
        tWeather: { value: weather },
        tBlue: { value: blue ?? this.ownBlue },
        uFrame: { value: 0 },
        uProjInv: { value: null },
        uCamWorld: { value: null },
        uNear: { value: 0.5 },
        uFar: { value: 30000 },
        uCamAlt: { value: 0 },
        uWeatherOff: { value: new Vector2() },
        uShapeOff: { value: new Vector2() },
        uDetailOff: { value: new Vector3() },
        uAxis: { value: new Vector2() },
        uRocketAlt: { value: 0 },
        uCover: { value: new Vector2(...COVER) },
        uAirFade: { value: 1 / 60000 },
        uKeyDir: { value: new Vector3(0, 1, 0) },
        uKeyCol: { value: new Color() },
        uAmbTop: { value: new Color() },
        uAmbBottom: { value: new Color() },
        uLightPos: { value: vec3s() },
        uLightCol: { value: Array.from({ length: UNDER_LIGHTS }, () => new Color()) },
        uLightDir: { value: vec3s() },
        uLightShape: { value: Array.from({ length: UNDER_LIGHTS }, () => new Vector4(-2, -1, 1, 0)) },
        uUnderAim: { value: new Vector3() },
        uUnderOn: { value: 0 },
        uFxA: { value: new Vector3(0, 1e7, 0) },
        uFxB: { value: new Vector3(0, 1e7, 0) },
        uFxBelow: { value: 0 },
      },
      depthTest: false,
      depthWrite: false,
      blending: NoBlending,
    })
    this.quad = new Mesh(screenTriangle(), this.march)
    this.quad.frustumCulled = false
  }

  override set mainCamera(camera: Camera) {
    this.camera = camera instanceof PerspectiveCamera ? camera : null
  }

  override set mainScene(scene: Scene) {
    this.scene = scene
  }

  override setDepthTexture(depthTexture: Texture): void {
    this.depth = depthTexture
    this.march.uniforms.tDepth.value = depthTexture
  }

  override setSize(width: number, height: number): void {
    const w = Math.max(1, Math.round(width * QUALITY.cloudScale))
    const h = Math.max(1, Math.round(height * QUALITY.cloudScale))
    this.low.setSize(w, h)
    this.lowSize.value.set(w, h)
    this.fx.setSize(width, height)
  }

  override update(renderer: WebGLRenderer): void {
    const cam = this.camera
    if (!cam || !this.depth) {
      this.on.value = 0
      return
    }
    const pos = this.camPos.setFromMatrixPosition(cam.matrixWorld)
    const camAlt = pos.y + rig.nearOffset
    const fade = 1 - smoothstep(FADE_ALT[0], FADE_ALT[1], camAlt)
    this.on.value = fade
    if (fade <= 0) return

    this.updateUniforms(cam, pos, camAlt)
    renderer.setRenderTarget(this.low)
    renderer.render(this.quad, this.quadCam)
    this.renderNearFx(renderer, cam, camAlt < CLOUD_BASE_M)
  }

  private updateUniforms(cam: PerspectiveCamera, pos: Vector3, camAlt: number): void {
    const u = this.march.uniforms
    const t = rig.vtime
    u.uFrame.value = (u.uFrame.value + 1) % 4096
    u.uProjInv.value = cam.projectionMatrixInverse
    u.uCamWorld.value = cam.matrixWorld
    u.uNear.value = cam.near
    u.uFar.value = cam.far
    u.uCamAlt.value = camAlt
    // noise origins: the camera's place in the drifting deck, wrapped to each tile so the shader stays precise
    const dx = pos.x - WIND.x * t
    const dz = pos.z - WIND.y * t
    u.uWeatherOff.value.set(wrap(dx, WEATHER_TILE_M), wrap(dz, WEATHER_TILE_M))
    u.uShapeOff.value.set(wrap(dx, SHAPE_TILE_M), wrap(dz, SHAPE_TILE_M))
    u.uDetailOff.value.set(wrap(dx - WIND.x * t * 0.4, DETAIL_TILE_M), wrap(-BOIL * t, DETAIL_TILE_M), wrap(dz - WIND.y * t * 0.4, DETAIL_TILE_M))
    u.uAxis.value.set(-pos.x, -pos.z)
    u.uRocketAlt.value = rig.altM
    u.uAirFade.value = 1 / (60000 + 100000 * smoothstep(2000, 12000, camAlt))

    // the key light and the sky's: lightState is refreshed before the frame renders
    const s = lightState
    u.uKeyDir.value.copy(s.keyDir)
    u.uKeyCol.value.copy(s.keyColor).multiplyScalar(s.keyIntensity * KEY_GAIN)
    const night = 1 - smoothstep(1.6, 2.2, rig.stageF)
    u.uAmbTop.value.copy(s.fillSky).multiplyScalar(SKY_GAIN).add(this.tmp.copy(s.keyColor).multiplyScalar(s.keyIntensity * DIFFUSE_GAIN * night))
    u.uAmbBottom.value.copy(s.fillGround).multiplyScalar(GROUND_GAIN).add(this.tmp.copy(NIGHT_GLOW).multiplyScalar(night))

    // lamps under the deck: the flame, the floodlit pad, the searchlights
    const lp = u.uLightPos.value as Vector3[]
    const lc = u.uLightCol.value as Color[]
    const ld = u.uLightDir.value as Vector3[]
    const shape = u.uLightShape.value as Vector4[]
    plumeLight.getWorldPosition(lp[0]).sub(pos)
    // by day the flame's glow on the deck gives way to the sun
    const reach = Math.min(toDeck(lp[0].y + camAlt), FLAME_REACH)
    const flame = (plumeLight.intensity / LIGHT_CD) * FLAME_E * (0.25 + 0.75 * night) * (reach * reach + PLUME_SHAPE[0] ** 2)
    lc[0].copy(plumeLight.color).multiplyScalar(flame)
    shape[0].set(-2, -1, PLUME_SHAPE[0] ** 2, PLUME_SHAPE[1])
    const padOn = rig.altM <= HIDE_ALT_M ? 1 : 0
    lp[1].set(-pos.x, PAD_GLOW_Y - rig.nearOffset - pos.y, -pos.z)
    lc[1].copy(PAD_GLOW).multiplyScalar(PAD_GLOW_CD * padOn * UNDER_MS)
    shape[1].set(-2, -1, PAD_SHAPE[0] ** 2, PAD_SHAPE[1])
    for (let i = 0; i < UNDER_LIGHTS - 2; i++) {
      const f = this.searchlights[i]
      const k = i + 2
      if (!f) {
        lc[k].setRGB(0, 0, 0)
        continue
      }
      const head = floodPos(f)
      head.y -= rig.nearOffset
      ld[k].set(f.aim[0], f.aim[1] - rig.nearOffset, f.aim[2]).sub(head).normalize()
      lp[k].copy(head).sub(pos)
      lc[k].setRGB(...f.color).multiplyScalar(f.cd * SEARCH_GAIN * padOn * UNDER_MS)
      shape[k].set(Math.cos(f.angle), Math.cos(f.angle * (1 - f.penumbra)), SEARCH_SHAPE[0] ** 2, SEARCH_SHAPE[1])
    }
    // the shadow march aims at the flame while it burns, else at the pad
    const flameAtDeck = flame / Math.max(1, toDeck(lp[0].y + camAlt) ** 2)
    const padAtDeck = (PAD_GLOW_CD * padOn) / toDeck(PAD_GLOW_Y) ** 2
    u.uUnderAim.value.copy(flameAtDeck > padAtDeck * 0.5 ? lp[0] : lp[1])
    // skip the lamps once they are all far below (or the deck far above them)
    const lampNear = Math.max(flameAtDeck, padAtDeck * (1 - smoothstep(2000, 6000, camAlt)))
    u.uUnderOn.value = lampNear > 1e-4 ? 1 : 0

    // the plume's axis, where the near effects sit along each ray
    const root = rocketRefs.root
    if (root && plumeLight.intensity > 0) {
      u.uFxA.value.copy(root.localToWorld(v.set(0, 0, 0))).sub(pos)
      u.uFxB.value.copy(root.localToWorld(v.set(0, -PLUME_REACH, 0))).sub(pos)
    } else {
      u.uFxA.value.set(0, 1e7, 0)
      u.uFxB.value.set(0, 1e7, 0)
    }
    u.uFxBelow.value = camAlt < CLOUD_BASE_M ? 1 : 0
  }

  // the near effects alone, over transparent black: their light in rgb, their coverage in alpha
  private renderNearFx(renderer: WebGLRenderer, cam: PerspectiveCamera, below: boolean): void {
    const scene = this.scene
    renderer.getClearColor(this.clear)
    const clearAlpha = renderer.getClearAlpha()
    renderer.setRenderTarget(this.fx)
    renderer.setClearColor(0x000000, 0)
    renderer.clear(true, false, false)
    if (scene) {
      const mask = cam.layers.mask
      const background = scene.background
      const autoClear = renderer.autoClear
      const shadows = renderer.shadowMap.autoUpdate
      cam.layers.disableAll()
      cam.layers.enable(FX_NEAR_LAYER)
      if (below) cam.layers.enable(FX_PAD_LAYER)
      scene.background = null
      renderer.autoClear = false
      renderer.shadowMap.autoUpdate = false
      try {
        renderer.render(scene, cam)
      } finally {
        cam.layers.mask = mask
        scene.background = background
        renderer.autoClear = autoClear
        renderer.shadowMap.autoUpdate = shadows
      }
    }
    renderer.setClearColor(this.clear, clearAlpha)
  }

  override dispose(): void {
    this.march.dispose()
    this.ownBlue?.dispose()
    this.quad.geometry.dispose()
    this.low.dispose()
    this.fx.dispose()
    super.dispose()
  }
}
