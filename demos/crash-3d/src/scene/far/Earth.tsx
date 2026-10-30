import { useTexture } from '@react-three/drei'
import { useFrame } from '@react-three/fiber'
import { useEffect, useMemo, useRef } from 'react'
import {
  AddEquation,
  BackSide,
  CustomBlending,
  Group,
  OneFactor,
  OneMinusSrcAlphaFactor,
  Quaternion,
  ShaderMaterial,
  SphereGeometry,
  SRGBColorSpace,
  Vector3,
  ZeroFactor,
  type Material,
  type Texture,
} from 'three'
import { dirFromAzEl, lightState } from '../env/lightState'
import { shotFrame } from '../camera/shotFrame'
import { QUALITY } from '../quality'
import { rig } from '../rig'
import { FAR_EARTH_D } from './FarField'

const R_KM = 6371
const ATMO = 1.025 // atmosphere shell radius, in earth radii
const CLOUD_SHELL = 1.004
const FADE_IN = [1.8, 2.3] as const // stageF
const SPIN = 0.0015 // rad/s, a slow drift of the ground below
const EARTH_SUN_EL = (-6 * Math.PI) / 180 // dawn under the rocket: the ground's sun just below its horizon
// from far away the earth is staged for each shot: below and ahead of the camera, as a broadcast frames it
const AWAY = [3.2, 4.4] as const // stageF over which it moves from straight below to the shot's frame
const AWAY_DIP = (18 * Math.PI) / 180 // how far under the camera's horizon its centre sits then
const DEG = Math.PI / 180

// the point straight below the camera at the start: over europe (48°N, 10°E)
const BELOW_LAT = 48 * DEG
const BELOW_LON = 10 * DEG

const clamp01 = (x: number) => Math.min(1, Math.max(0, x))
const smooth = (a: number, b: number, x: number) => {
  const k = clamp01((x - a) / (b - a))
  return k * k * (3 - 2 * k)
}

// three's sphere uv: longitude 0 at +x, east towards -z, latitude up y
function surfacePoint(lat: number, lon: number, out = new Vector3()) {
  return out.set(Math.cos(lon) * Math.cos(lat), Math.sin(lat), -Math.sin(lon) * Math.cos(lat))
}

// opaque (far-field rule) but blended: premultiplied "over" with the alpha uniform, target alpha kept
function farBlend(m: Material) {
  m.transparent = false
  m.depthTest = false
  m.depthWrite = false
  m.blending = CustomBlending
  m.blendEquation = AddEquation
  m.blendSrc = OneFactor
  m.blendDst = OneMinusSrcAlphaFactor
  m.blendSrcAlpha = ZeroFactor
  m.blendDstAlpha = OneFactor
}

function farAdd(m: Material) {
  farBlend(m)
  m.blendDst = OneFactor
}

const surfaceVertex = /* glsl */ `
varying vec2 vUv;
varying vec3 vN;
varying vec3 vPos;
void main() {
  vUv = uv;
  vec4 w = modelMatrix * vec4(position, 1.0);
  vPos = w.xyz;
  vN = normalize(mat3(modelMatrix) * normal);
  gl_Position = projectionMatrix * viewMatrix * w;
}
`

const surfaceFragment = /* glsl */ `
uniform sampler2D uDay;
uniform sampler2D uNight;
uniform sampler2D uClouds;
uniform sampler2D uSpec;
uniform vec3 uSun;
uniform vec3 uShadow; // uv offset of the cloud shadows (xy) and their strength (z)
uniform float uAlpha;
varying vec2 vUv;
varying vec3 vN;
varying vec3 vPos;
float hash12(vec2 p) {
  vec3 p3 = fract(vec3(p.xyx) * 0.1031);
  p3 += dot(p3, p3.yzx + 33.33);
  return fract((p3.x + p3.y) * p3.z);
}
void main() {
  vec3 N = normalize(vN);
  vec3 V = normalize(cameraPosition - vPos);
  float ndl = dot(N, uSun);
  float day = smoothstep(-0.1, 0.16, ndl);
  vec3 ground = texture2D(uDay, vUv).rgb;
  float shadow = texture2D(uClouds, vUv + uShadow.xy).r;
  ground *= 1.0 - uShadow.z * shadow;
  // a warm band along the terminator, where the light comes through a lot of air
  vec3 sunCol = mix(vec3(1.25, 0.55, 0.25), vec3(1.0, 0.97, 0.92), smoothstep(0.0, 0.25, ndl));
  vec3 col = ground * sunCol * max(ndl, 0.0) * 2.2;
  // city lights on the night side only, dimmed under clouds. from low orbit one texel of the map covers many
  // pixels, so the lit areas break up into a sparkle of small lights; from far away (several cells per pixel)
  // the sparkle averages out to the plain map
  vec3 lights = pow(texture2D(uNight, vUv).rgb, vec3(1.35));
  vec2 cell = vUv * vec2(49152.0, 24576.0);
  float sparkle = 0.25 + 1.6 * smoothstep(0.62, 1.0, hash12(floor(cell)));
  sparkle = mix(sparkle, 0.75, smoothstep(0.4, 1.6, length(fwidth(cell))));
  float cloudHere = texture2D(uClouds, vUv).r;
  col += lights * sparkle * vec3(1.6, 1.25, 0.8) * 2.0 * (1.0 - day) * (1.0 - 0.7 * cloudHere);
  // the sun's glint on the water
  float water = texture2D(uSpec, vUv).r;
  vec3 H = normalize(uSun + V);
  col += vec3(1.0, 0.9, 0.75) * pow(max(dot(N, H), 0.0), 160.0) * water * day * 9.0;
  // daylight haze towards the limb
  float limb = pow(1.0 - max(dot(N, V), 0.0), 3.0);
  col = mix(col, vec3(0.35, 0.55, 1.0) * max(ndl, 0.0) * 1.4, limb * 0.6);
  gl_FragColor = vec4(col * uAlpha, uAlpha);
}
`

const cloudFragment = /* glsl */ `
uniform sampler2D uClouds;
uniform vec3 uSun;
uniform float uAlpha;
varying vec2 vUv;
varying vec3 vN;
varying vec3 vPos;
float hash12(vec2 p) {
  vec3 p3 = fract(vec3(p.xyx) * 0.1031);
  p3 += dot(p3, p3.yzx + 33.33);
  return fract((p3.x + p3.y) * p3.z);
}
float vnoise(vec2 p) {
  vec2 i = floor(p);
  vec2 f = fract(p);
  f = f * f * (3.0 - 2.0 * f);
  return mix(mix(hash12(i), hash12(i + vec2(1.0, 0.0)), f.x), mix(hash12(i + vec2(0.0, 1.0)), hash12(i + vec2(1.0, 1.0)), f.x), f.y);
}
void main() {
  vec3 N = normalize(vN);
  float ndl = dot(N, uSun);
  // seen from low up, a texel of the cloud map spans many pixels: a finer procedural texture breaks up its
  // blocks, and fades out where the map is already sharp enough
  vec2 cell = vUv * vec2(4096.0, 2048.0);
  float detail = vnoise(cell * 1.7) * 0.6 + vnoise(cell * 4.3) * 0.4;
  float near = 1.0 - smoothstep(0.3, 1.5, length(fwidth(cell)));
  float c = texture2D(uClouds, vUv).r;
  c = mix(c, c * (0.45 + 1.1 * detail), near);
  float a = smoothstep(0.08, 0.8, c) * uAlpha;
  vec3 sunCol = mix(vec3(1.3, 0.5, 0.25), vec3(1.0), smoothstep(0.0, 0.25, ndl));
  // lit tops, a faint grey on the night side where the moon and the cities touch them
  vec3 col = sunCol * max(ndl, 0.0) * 1.6 + vec3(0.012, 0.014, 0.02);
  gl_FragColor = vec4(col * a, a);
}
`

const atmosphereFragment = /* glsl */ `
uniform vec3 uSun;
uniform float uAlpha;
varying vec3 vN;
varying vec3 vPos;
void main() {
  // the shell is seen from inside out (back faces): bright where the line of sight grazes the limb
  vec3 N = normalize(-vN);
  vec3 V = normalize(cameraPosition - vPos);
  float rim = pow(1.0 - abs(dot(N, V)), 4.0);
  float ndl = dot(normalize(vN), uSun);
  float lit = smoothstep(-0.25, 0.35, ndl);
  // rayleigh blue on the day side, red-orange at the terminator
  vec3 col = mix(vec3(1.0, 0.35, 0.12), vec3(0.32, 0.6, 1.0), smoothstep(-0.05, 0.3, ndl));
  float a = rim * lit * uAlpha;
  gl_FragColor = vec4(col * a * 2.4, 0.0);
}
`

function shaderMaterial(fragmentShader: string, uniforms: ShaderMaterial['uniforms']) {
  return new ShaderMaterial({ vertexShader: surfaceVertex, fragmentShader, uniforms })
}

// the earth from orbit: day and night ground, city lights, a cloud layer with shadows, the ocean glint, and an
// atmosphere rim; a far-field sphere whose size keeps the true angular size for the altitude
export function Earth() {
  const base = import.meta.env.BASE_URL + QUALITY.earthTextures
  const [day, night, clouds, spec] = useTexture([`${base}day.jpg`, `${base}night.jpg`, `${base}clouds.jpg`, `${base}specular.jpg`]) as Texture[]
  const geo = useMemo(() => new SphereGeometry(1, 384, 192), [])
  const mats = useMemo(() => {
    day.colorSpace = SRGBColorSpace
    night.colorSpace = SRGBColorSpace
    for (const t of [day, night, clouds, spec]) t.anisotropy = 8
    const sun = { value: new Vector3() }
    const alpha = { value: 0 }
    const surface = shaderMaterial(surfaceFragment, {
      uDay: { value: day },
      uNight: { value: night },
      uClouds: { value: clouds },
      uSpec: { value: spec },
      uSun: sun,
      uShadow: { value: new Vector3() },
      uAlpha: alpha,
    })
    const cloud = shaderMaterial(cloudFragment, { uClouds: { value: clouds }, uSun: sun, uAlpha: alpha })
    const atmo = shaderMaterial(atmosphereFragment, { uSun: sun, uAlpha: alpha })
    atmo.side = BackSide
    farBlend(surface)
    farBlend(cloud)
    farAdd(atmo)
    return { surface, cloud, atmo, sun, alpha }
  }, [day, night, clouds, spec])
  const group = useRef<Group>(null)
  const tmp = useMemo(
    () => ({ align: new Quaternion(), spin: new Quaternion(), local: new Vector3(), dir: new Vector3(), face: new Vector3(), framed: new Vector3(), spinAxis: new Vector3() }),
    [],
  )

  useEffect(
    () => () => {
      geo.dispose()
      mats.surface.dispose()
      mats.cloud.dispose()
      mats.atmo.dispose()
    },
    [geo, mats],
  )

  useFrame(() => {
    const g = group.current
    if (!g) return
    const a = smooth(FADE_IN[0], FADE_IN[1], rig.stageF)
    g.visible = a > 0.001
    if (!g.visible) return
    mats.alpha.value = a
    const r = FAR_EARTH_D * (R_KM / (R_KM + rig.altM / 1000))
    // straight below at first; further out it slides in front of the shot
    const f = shotFrame.forward
    tmp.framed.set(f.x * Math.cos(AWAY_DIP), -Math.sin(AWAY_DIP), f.z * Math.cos(AWAY_DIP))
    tmp.dir.set(0, -1, 0).lerp(tmp.framed, smooth(AWAY[0], AWAY[1], rig.stageF)).normalize()
    g.position.copy(tmp.dir).multiplyScalar(FAR_EARTH_D)
    g.scale.setScalar(r)
    // europe turned towards the camera, turning slowly around the earth's own axis
    surfacePoint(BELOW_LAT, BELOW_LON, tmp.local)
    tmp.align.setFromUnitVectors(tmp.local, tmp.face.copy(tmp.dir).negate())
    tmp.spin.setFromAxisAngle(tmp.spinAxis.set(0, 1, 0), rig.vtime * SPIN)
    g.quaternion.copy(tmp.align).multiply(tmp.spin)
    // the ground's sun: the flight's sun azimuth, just under the local horizon (dawn below the rocket)
    const s = lightState.sunDir
    dirFromAzEl(Math.atan2(s.x, s.z), EARTH_SUN_EL, mats.sun.value)
    const shadow = mats.surface.uniforms.uShadow.value as Vector3
    shadow.set(-0.0008, 0.0005, 0.45)
  })

  return (
    <group ref={group} visible={false}>
      <mesh geometry={geo} material={mats.surface} frustumCulled={false} renderOrder={-60} />
      <mesh geometry={geo} material={mats.cloud} scale={CLOUD_SHELL} frustumCulled={false} renderOrder={-59} />
      <mesh geometry={geo} material={mats.atmo} scale={ATMO} frustumCulled={false} renderOrder={-50} />
    </group>
  )
}
