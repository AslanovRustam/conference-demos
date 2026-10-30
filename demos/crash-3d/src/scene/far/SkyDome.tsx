import { useFrame } from '@react-three/fiber'
import { useEffect, useMemo } from 'react'
import { BufferAttribute, BufferGeometry, DoubleSide, Mesh, ShaderMaterial, Vector3 } from 'three'
import { ATMOSPHERE_KM, EARTH_R_KM, MIE, MIE_EXT, MIE_G, MIE_H_KM, OZONE, RAYLEIGH, RAYLEIGH_H_KM, horizonDip } from '../env/atmosphere'
import { lightState } from '../env/lightState'
import { QUALITY } from '../quality'
import { rig } from '../rig'
import { FAR_SKY_R } from './FarField'
import { cameraAltitudeM, moonSkyAt, skyExposureAt, skyFadeAt } from './skyCurves'

// the sky: single scattering (rayleigh, mie, ozone) through a spherical atmosphere, lit by the sun and the moon.
// the scattering integral runs per vertex (QUALITY.skySteps samples along the view ray, the light's optical depth
// from the analytic chapman function, the earth's shadow included), the phase functions per pixel. the mesh is a
// grid over azimuth and elevation whose rows crowd the horizon, and the horizon row follows the dip as the camera
// climbs, so the bright band at the horizon stays sharp. same constants as env/atmosphere.ts

const f = (x: number) => x.toExponential(6)
const vec3 = (v: [number, number, number]) => `vec3(${v.map(f).join(', ')})`

const vertex = /* glsl */ `
#define PI 3.141592653589793
const float R = ${EARTH_R_KM.toFixed(1)};
const float AT = ${ATMOSPHERE_KM.toFixed(1)};
const float HR = ${RAYLEIGH_H_KM.toFixed(2)};
const float HM = ${MIE_H_KM.toFixed(2)};
const vec3 BR = ${vec3(RAYLEIGH)};
const vec3 BRE = ${vec3(RAYLEIGH)} + ${vec3(OZONE)};
const float BM = ${f(MIE)};
const float BME = ${f(MIE_EXT)};
const float GROUND_ALBEDO = 0.08;
const float LAND_HAZE = 0.75;

uniform vec3 uSunDir;
uniform vec3 uMoonDir;
uniform float uAlt; // camera altitude, km
uniform float uHorizon; // elevation of the horizon, radians
uniform float uRadius;
uniform float uSunE;
uniform float uMoonE;

varying vec3 vDir;
varying vec3 vSunR;
varying vec3 vSunM;
varying vec3 vMoonR;
varying vec3 vMoonM;
varying vec3 vGround;

float chapman(float X, float x, float c) {
  float s = sqrt(X + x);
  if (c >= 0.0) return s / (s * c + 1.0) * exp(-x);
  float x0 = sqrt(1.0 - c * c) * (X + x);
  return 2.0 * sqrt(x0) * exp(min(X - x0, 60.0)) - s / (1.0 - s * c) * exp(-x);
}

// optical depth from altitude h towards a light at zenith cosine c
vec3 lightDepth(float h, float c) {
  return BRE * (HR * chapman(R / HR, h / HR, c)) + BME * (HM * chapman(R / HM, h / HM, c));
}

void main() {
  // the grid: x azimuth, y in -1..1, squared onto elevation around the horizon
  float v = position.y;
  float el = uHorizon + (v >= 0.0 ? (0.5 * PI - uHorizon) * v * v : -(0.5 * PI + uHorizon) * v * v);
  vec3 d = vec3(sin(position.x) * cos(el), sin(el), cos(position.x) * cos(el));
  vDir = d;

  float alt = min(uAlt, AT - 0.01);
  float r = R + alt;
  float b = r * d.y;
  float tEnd = -b + sqrt(max(b * b - (alt - AT) * (2.0 * R + alt + AT), 0.0));
  float dG = b * b - alt * (2.0 * R + alt);
  bool ground = d.y < 0.0 && dG > 0.0;
  if (ground) tEnd = -b - sqrt(dG);

  float odR = 0.0;
  float odM = 0.0;
  vec3 sR = vec3(0.0);
  vec3 sM = vec3(0.0);
  vec3 mR = vec3(0.0);
  vec3 mM = vec3(0.0);
  // samples crowd the camera end, where the air is densest
  for (int i = 0; i < SKY_STEPS; i++) {
    float x0 = float(i) / float(SKY_STEPS);
    float x1 = float(i + 1) / float(SKY_STEPS);
    float xm = 0.5 * (x0 + x1);
    float t = tEnd * xm * xm;
    float ds = tEnd * (x1 * x1 - x0 * x0);
    vec3 p = vec3(0.0, r, 0.0) + d * t;
    float rp = length(p);
    float h = max(rp - R, 0.0);
    float dR = exp(-h / HR) * ds;
    float dM = exp(-h / HM) * ds;
    vec3 view = BRE * (odR + 0.5 * dR) + BME * (odM + 0.5 * dM);
    odR += dR;
    odM += dM;
    vec3 up = p / rp;
    vec3 ts = exp(-(view + lightDepth(h, dot(up, uSunDir))));
    sR += dR * ts;
    sM += dM * ts;
    // the moonlit sky only counts at night (uniform branch: no cost once the sun is up)
    if (uMoonE > 0.0) {
      vec3 tm = exp(-(view + lightDepth(h, dot(up, uMoonDir))));
      mR += dR * tm;
      mM += dM * tm;
    }
  }
  // the land under the horizon glow stays dark: the haze over it fades a few degrees down (the near field's ground
  // ends dark, the clouds and the earth cover the rest)
  float land = 1.0 - LAND_HAZE * smoothstep(0.0, 0.05, uHorizon - el);
  vSunR = uSunE * land * BR * sR;
  vSunM = uSunE * land * BM * sM;
  vMoonR = uMoonE * land * BR * mR;
  vMoonM = uMoonE * land * BM * mM;

  // the ground under the haze: a dark land lit by whatever light reaches it
  vGround = vec3(0.0);
  if (ground) {
    vec3 up = normalize(vec3(0.0, r, 0.0) + d * tEnd);
    vec3 view = exp(-(BRE * odR + BME * odM));
    float cs = dot(up, uSunDir);
    float cm = dot(up, uMoonDir);
    vec3 irr = uSunE * max(cs, 0.0) * exp(-lightDepth(0.0, cs)) + uMoonE * max(cm, 0.0) * exp(-lightDepth(0.0, cm));
    vGround = GROUND_ALBEDO / PI * irr * view;
  }

  gl_Position = projectionMatrix * modelViewMatrix * vec4(d * uRadius, 1.0);
}
`

const fragment = /* glsl */ `
#define PI 3.141592653589793
const float G = ${MIE_G.toFixed(3)};

uniform vec3 uSunDir;
uniform vec3 uMoonDir;
uniform float uFade;

varying vec3 vDir;
varying vec3 vSunR;
varying vec3 vSunM;
varying vec3 vMoonR;
varying vec3 vMoonM;
varying vec3 vGround;

float phaseR(float c) {
  return 3.0 / (16.0 * PI) * (1.0 + c * c);
}

// cornette-shanks
float phaseM(float c) {
  float g2 = G * G;
  return 3.0 / (8.0 * PI) * ((1.0 - g2) * (1.0 + c * c)) / ((2.0 + g2) * pow(1.0 + g2 - 2.0 * G * c, 1.5));
}

void main() {
  vec3 d = normalize(vDir);
  float cs = dot(d, uSunDir);
  float cm = dot(d, uMoonDir);
  vec3 c = vSunR * phaseR(cs) + vSunM * phaseM(cs) + vMoonR * phaseR(cm) + vMoonM * phaseM(cm) + vGround;
  gl_FragColor = vec4(c * uFade, 1.0);
}
`

function domeGeometry(segments: number, rings: number): BufferGeometry {
  const pos = new Float32Array((segments + 1) * (rings + 1) * 3)
  let k = 0
  for (let j = 0; j <= rings; j++) {
    for (let i = 0; i <= segments; i++) {
      pos[k++] = (i / segments) * Math.PI * 2
      pos[k++] = -1 + (2 * j) / rings
      pos[k++] = 0
    }
  }
  const index: number[] = []
  for (let j = 0; j < rings; j++) {
    for (let i = 0; i < segments; i++) {
      const a = j * (segments + 1) + i
      const c = a + segments + 1
      index.push(a, a + 1, c, a + 1, c + 1, c)
    }
  }
  const geo = new BufferGeometry()
  geo.setAttribute('position', new BufferAttribute(pos, 3))
  geo.setIndex(index)
  return geo
}

export function SkyDome() {
  const mesh = useMemo(() => {
    const [segments, rings] = QUALITY.skyGrid
    const material = new ShaderMaterial({
      vertexShader: vertex,
      fragmentShader: fragment,
      defines: { SKY_STEPS: QUALITY.skySteps },
      uniforms: {
        uSunDir: { value: new Vector3() },
        uMoonDir: { value: new Vector3() },
        uAlt: { value: 0 },
        uHorizon: { value: 0 },
        uRadius: { value: FAR_SKY_R },
        uSunE: { value: 0 },
        uMoonE: { value: 0 },
        uFade: { value: 1 },
      },
      side: DoubleSide,
      depthTest: false,
      depthWrite: false,
    })
    const m = new Mesh(domeGeometry(segments, rings), material)
    m.name = 'sky'
    m.renderOrder = -100
    m.frustumCulled = false // the shader places the vertices
    return m
  }, [])
  useEffect(
    () => () => {
      mesh.geometry.dispose()
      mesh.material.dispose()
    },
    [mesh],
  )

  useFrame(({ camera }) => {
    const fade = skyFadeAt(rig.stageF)
    mesh.visible = fade > 0
    if (!mesh.visible) return
    const u = mesh.material.uniforms
    const altM = cameraAltitudeM(camera.position.y, rig.nearOffset)
    const exposure = skyExposureAt(rig.stageF)
    u.uSunDir.value.copy(lightState.sunDir)
    u.uMoonDir.value.copy(lightState.moonDir)
    u.uAlt.value = altM / 1000
    u.uHorizon.value = -horizonDip(altM)
    u.uSunE.value = exposure
    u.uMoonE.value = exposure * moonSkyAt(rig.stageF)
    u.uFade.value = fade
  })

  return <primitive object={mesh} />
}
