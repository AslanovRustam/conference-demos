import {
  Data3DTexture,
  DataTexture,
  LinearFilter,
  LinearMipmapLinearFilter,
  LinearMipmapNearestFilter,
  NearestFilter,
  RedFormat,
  RepeatWrapping,
  RGFormat,
  UnsignedByteType,
} from 'three'
import { params } from '../../platform/params'
import { QUALITY } from '../quality'
import type { NoiseJob, NoiseResult } from './noise.worker'
import { blueNoise, rangeOf, shapeSlices, toBytes, weatherMap } from './noiseGen'

// the clouds' noise textures, generated once per page in web workers while the scene loads (the shape volume is
// split in z across a few workers, ~0.5 s on a laptop instead of ~2 s on one thread). the promise is cached: every
// caller gets the same textures. without workers (a file:// page, a blocked worker) it falls back to the main thread

export interface CloudNoise {
  shape: Data3DTexture // cloudNoiseSize^3, R perlin-worley, G worley fbm
  weather: DataTexture // cloudWeatherSize^2, R coverage, G cloud height
  blue: DataTexture // BLUE_SIZE^2 blue noise, the per-pixel jitter of the march
}

export const BLUE_SIZE = 64

// the blue noise tile as a texture, read texel for texel
export function blueTexture(data: Uint8Array): DataTexture {
  const tex = new DataTexture(data, BLUE_SIZE, BLUE_SIZE, RedFormat, UnsignedByteType)
  tex.wrapS = tex.wrapT = RepeatWrapping
  tex.magFilter = tex.minFilter = NearestFilter
  tex.generateMipmaps = false
  tex.unpackAlignment = 1
  tex.needsUpdate = true
  return tex
}

declare global {
  interface Window {
    __cloudNoise?: { ms: number; workers: number }
  }
}

// how long the last generation took, wall clock
export const cloudNoiseStats = { ms: 0, workers: 0 }

let pending: Promise<CloudNoise> | null = null

export function loadCloudNoise(): Promise<CloudNoise> {
  pending ??= generate()
  return pending
}

async function generate(): Promise<CloudNoise> {
  const t0 = performance.now()
  const size = QUALITY.cloudNoiseSize
  const weatherSize = QUALITY.cloudWeatherSize
  let parts: NoiseResult[]
  try {
    parts = await inWorkers(size, weatherSize)
  } catch {
    cloudNoiseStats.workers = 0
    const { pw, wf } = shapeSlices(size, 0, size)
    parts = [{ z0: 0, z1: size, pw, wf, weather: weatherMap(weatherSize), blue: blueNoise(BLUE_SIZE) }]
  }
  const noise = pack(parts, size, weatherSize)
  cloudNoiseStats.ms = Math.round(performance.now() - t0)
  if (params.debug) window.__cloudNoise = { ...cloudNoiseStats }
  return noise
}

function inWorkers(size: number, weatherSize: number): Promise<NoiseResult[]> {
  if (typeof Worker === 'undefined') return Promise.reject(new Error('no workers'))
  const cores = typeof navigator !== 'undefined' ? navigator.hardwareConcurrency || 4 : 4
  const count = Math.max(1, Math.min(4, cores - 1))
  cloudNoiseStats.workers = count
  const jobs = Array.from({ length: count }, (_, i): NoiseJob => ({
    size,
    z0: Math.round((i * size) / count),
    z1: Math.round(((i + 1) * size) / count),
    weather: i === count - 1 ? weatherSize : 0,
    blue: i === 0 ? BLUE_SIZE : 0,
  }))
  return Promise.all(
    jobs.map(
      (job) =>
        new Promise<NoiseResult>((resolve, reject) => {
          const worker = new Worker(new URL('./noise.worker.ts', import.meta.url), { type: 'module' })
          worker.onmessage = (e: MessageEvent<NoiseResult>) => {
            worker.terminate()
            resolve(e.data)
          }
          worker.onerror = (e) => {
            worker.terminate()
            reject(new Error(e.message || 'cloud noise worker failed'))
          }
          worker.postMessage(job)
        }),
    ),
  )
}

// stitches the slices, stretches each field over the full byte range and uploads both textures
function pack(parts: NoiseResult[], size: number, weatherSize: number): CloudNoise {
  const n = size * size * size
  const pw = new Float32Array(n)
  const wf = new Float32Array(n)
  let weather: Uint8Array | null = null
  let blue: Uint8Array | null = null
  for (const p of parts) {
    pw.set(p.pw, p.z0 * size * size)
    wf.set(p.wf, p.z0 * size * size)
    weather ??= p.weather
    blue ??= p.blue
  }
  const bytes = new Uint8Array(n * 2)
  const [pl, ph] = rangeOf(pw)
  const [wl, wh] = rangeOf(wf)
  toBytes(pw, bytes, 2, 0, pl, ph)
  toBytes(wf, bytes, 2, 1, wl, wh)

  const shape = new Data3DTexture(bytes, size, size, size)
  shape.format = RGFormat
  shape.type = UnsignedByteType
  shape.wrapS = shape.wrapT = shape.wrapR = RepeatWrapping
  shape.magFilter = LinearFilter
  shape.minFilter = LinearMipmapNearestFilter
  shape.generateMipmaps = true
  shape.unpackAlignment = 1
  shape.needsUpdate = true

  const map = new DataTexture(weather ?? weatherMap(weatherSize), weatherSize, weatherSize, RGFormat, UnsignedByteType)
  map.wrapS = map.wrapT = RepeatWrapping
  map.magFilter = LinearFilter
  map.minFilter = LinearMipmapLinearFilter
  map.generateMipmaps = true
  map.unpackAlignment = 1
  map.needsUpdate = true
  return { shape, weather: map, blue: blueTexture(blue ?? blueNoise(BLUE_SIZE)) }
}
