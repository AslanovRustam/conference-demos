// one-off: downloads the NASA imagery (public domain) and prepares the textures the game ships with.
// the results are committed under public/textures; the game never downloads anything.
// usage: npm run textures   (sources are cached in .texcache/)
import { createWriteStream, existsSync, mkdirSync } from 'node:fs'
import { pipeline } from 'node:stream/promises'
import { Readable } from 'node:stream'
import sharp from 'sharp'

sharp.cache(false)

const SOURCES = {
  // Blue Marble Next Generation, December, with topography and bathymetry (NASA Visible Earth)
  day: 'https://eoimages.gsfc.nasa.gov/images/imagerecords/73000/73909/world.topo.bathy.200412.3x21600x10800.jpg',
  // Black Marble 2016, night lights (NASA Earth Observatory)
  night: 'https://eoimages.gsfc.nasa.gov/images/imagerecords/144000/144898/BlackMarble_2016_3km.jpg',
  // Blue Marble cloud cover composite
  clouds: 'https://eoimages.gsfc.nasa.gov/images/imagerecords/57000/57747/cloud_combined_8192.tif',
  // CGI Moon Kit, LRO colour mosaic (NASA Scientific Visualization Studio)
  moon: 'https://svs.gsfc.nasa.gov/vis/a000000/a004700/a004720/lroc_color_poles_4k.tif',
}

const CACHE = '.texcache'
const EARTH = 'public/textures/earth/8k'
const MOON = 'public/textures/moon'

async function fetchOnce(name, url) {
  const file = `${CACHE}/${name}${url.slice(url.lastIndexOf('.'))}`
  if (existsSync(file)) return file
  console.log('downloading', name, url)
  const res = await fetch(url)
  if (!res.ok) throw new Error(`${url}: ${res.status}`)
  await pipeline(Readable.fromWeb(res.body), createWriteStream(file))
  return file
}

const big = (file) => sharp(file, { limitInputPixels: false })

for (const dir of [CACHE, EARTH, MOON]) mkdirSync(dir, { recursive: true })
const src = {}
for (const [name, url] of Object.entries(SOURCES)) src[name] = await fetchOnce(name, url)

await big(src.day).resize(8192, 4096, { kernel: 'lanczos3' }).jpeg({ quality: 85, mozjpeg: true }).toFile(`${EARTH}/day.jpg`)
await big(src.night).resize(8192, 4096, { kernel: 'lanczos3' }).jpeg({ quality: 85, mozjpeg: true }).toFile(`${EARTH}/night.jpg`)
await big(src.clouds).resize(4096, 2048).grayscale().jpeg({ quality: 85, mozjpeg: true }).toFile(`${EARTH}/clouds.jpg`)
await big(src.moon).resize(4096, 2048).removeAlpha().jpeg({ quality: 85, mozjpeg: true }).toFile(`${MOON}/moon-4k.jpg`)

// ocean mask for the sun glint: the bathymetry blues stand out from land, ice and desert
const W = 2048
const H = 1024
const { data } = await big(src.day).resize(W, H).removeAlpha().raw().toBuffer({ resolveWithObject: true })
const mask = Buffer.alloc(W * H)
for (let i = 0; i < W * H; i++) {
  const r = data[i * 3]
  const g = data[i * 3 + 1]
  const b = data[i * 3 + 2]
  // water, shallow or deep navy, is bluer than it is red or green; ice and snow are bright grey-white,
  // forests and tundra green or brown
  mask[i] = b > r + 2 && b >= g && r + g + b < 560 ? 255 : 0
}
await sharp(mask, { raw: { width: W, height: H, channels: 1 } })
  .blur(1.2)
  .jpeg({ quality: 90 })
  .toFile(`${EARTH}/specular.jpg`)

console.log('done')
