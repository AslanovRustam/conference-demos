import { blueNoise, shapeSlices, weatherMap } from './noiseGen'

// one job of the cloud noise: z slices z0..z1 of the shape volume, plus the weather map and the blue noise tile
// when their sizes are > 0. the arrays go back as transferables (no copy)
export interface NoiseJob {
  size: number
  z0: number
  z1: number
  weather: number
  blue: number
}

export interface NoiseResult {
  z0: number
  z1: number
  pw: Float32Array
  wf: Float32Array
  weather: Uint8Array | null
  blue: Uint8Array | null
}

self.onmessage = (e: MessageEvent<NoiseJob>) => {
  const { size, z0, z1, weather, blue } = e.data
  const { pw, wf } = shapeSlices(size, z0, z1)
  const map = weather > 0 ? weatherMap(weather) : null
  const tile = blue > 0 ? blueNoise(blue) : null
  const result: NoiseResult = { z0, z1, pw, wf, weather: map, blue: tile }
  const transfer: Transferable[] = [pw.buffer, wf.buffer]
  if (map) transfer.push(map.buffer)
  if (tile) transfer.push(tile.buffer)
  self.postMessage(result, { transfer })
}
