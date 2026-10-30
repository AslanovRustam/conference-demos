// Cabinet screen: an animated neon card (title, COMING SOON, loading bar) until a preview
// video exists; scanlines, noise and a glowing rim sit on top of both.
import { brandColors, brandFonts, brandLogo } from '@brand/tokens'
import * as THREE from 'three'

export const SCREEN_MODE = { title: 0, soon: 1, loading: 2 } as const

const vertex = /* glsl */ `
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`
const fragment = /* glsl */ `
  uniform float uTime;
  uniform int uMode;
  uniform sampler2D uTitle;
  uniform bool uHasTitle;
  uniform vec3 uColor;
  uniform sampler2D uVideo;
  uniform bool uHasVideo;
  uniform float uDim;
  uniform float uFlash;
  varying vec2 vUv;

  float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }

  void main() {
    vec2 uv = vUv;
    vec3 col;
    if (uHasVideo) {
      col = texture2D(uVideo, uv).rgb;
    } else {
      float sweep = 0.5 + 0.5 * sin((uv.x * 1.4 + uv.y * 0.6) * 6.0 - uTime * 1.6);
      col = mix(vec3(0.035, 0.0, 0.01), uColor * 0.4, pow(sweep, 6.0));
      vec2 g = abs(fract(uv * vec2(16.0, 9.0) - vec2(0.0, uTime * 0.4)) - 0.5);
      col += uColor * smoothstep(0.46, 0.5, max(g.x, g.y)) * smoothstep(0.55, 0.0, uv.y) * 0.4;
      if (uHasTitle) {
        vec4 t = texture2D(uTitle, uv);
        col = mix(col, t.rgb * 1.6, t.a);
      }
    }
    if (uMode == 2) {
      float x = fract(uTime * 0.7);
      float bar = step(abs(uv.y - 0.16), 0.012) * step(abs(uv.x - x), 0.12);
      col = mix(col * 0.55, vec3(1.6), bar);
    }
    col *= 0.96 + 0.04 * sin(uv.y * 700.0 - uTime * 8.0);
    col += (hash(floor(uv * vec2(480.0, 270.0)) + fract(uTime)) - 0.5) * 0.02;
    float edge = max(abs(uv.x - 0.5), abs(uv.y - 0.5)) * 2.0;
    col *= 1.0 - smoothstep(0.9, 1.0, edge) * 0.35;
    col += uColor * uFlash;
    gl_FragColor = vec4(col * uDim, 1.0);
  }
`

export function createScreenMaterial(): THREE.ShaderMaterial {
  return new THREE.ShaderMaterial({
    vertexShader: vertex,
    fragmentShader: fragment,
    toneMapped: false,
    uniforms: {
      uTime: { value: 0 },
      uMode: { value: SCREEN_MODE.title },
      uTitle: { value: null },
      uHasTitle: { value: false },
      uColor: { value: new THREE.Color(brandColors.red) },
      uVideo: { value: null },
      uHasVideo: { value: false },
      uDim: { value: 1 },
      uFlash: { value: 0 },
    },
  })
}

let logoImage: Promise<HTMLImageElement> | null = null
function loadLogo(): Promise<HTMLImageElement> {
  logoImage ??= new Promise((resolve, reject) => {
    const img = new Image()
    img.onload = () => resolve(img)
    img.onerror = reject
    img.src = brandLogo.red
  })
  return logoImage
}

/** Title card for a cabinet screen; with `logo` the Clickable wordmark replaces the title. */
export async function makeTitleTexture(title: string, subtitle?: string, logo = false): Promise<THREE.CanvasTexture> {
  // canvas text needs the brand fonts loaded first (shared/brand/README.md)
  await Promise.all([document.fonts.load(`900 120px Clickable`), document.fonts.load(`600 40px Montserrat`)])
  await document.fonts.ready
  const W = 1024
  const H = 576
  const canvas = document.createElement('canvas')
  canvas.width = W
  canvas.height = H
  const ctx = canvas.getContext('2d')!
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.shadowColor = brandColors.red
  ctx.shadowBlur = 28
  ctx.fillStyle = brandColors.white

  if (logo) {
    const img = await loadLogo()
    const w = W * 0.62
    const h = (w * img.height) / img.width
    ctx.drawImage(img, (W - w) / 2, H * 0.42 - h / 2, w, h)
  } else {
    let size = 132
    ctx.font = `900 ${size}px ${brandFonts.display}`
    while (ctx.measureText(title).width > W * 0.86 && size > 40) {
      size -= 4
      ctx.font = `900 ${size}px ${brandFonts.display}`
    }
    ctx.fillText(title, W / 2, subtitle ? H * 0.44 : H / 2)
  }
  if (subtitle) {
    ctx.shadowBlur = 12
    ctx.font = `600 40px ${brandFonts.body}`
    ctx.fillStyle = 'rgba(255,255,255,0.82)'
    ctx.fillText(subtitle, W / 2, logo ? H * 0.68 : H * 0.66)
  }

  const tex = new THREE.CanvasTexture(canvas)
  tex.colorSpace = THREE.SRGBColorSpace
  tex.anisotropy = 4
  return tex
}
