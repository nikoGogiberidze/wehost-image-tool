// Generates the sample images the E2E suite and the screenshot capture run
// against. Everything is synthesised with Sharp so no binaries live in git and
// CI gets identical inputs every time.
import sharp from 'sharp'
import { mkdir, rm } from 'node:fs/promises'
import { fileURLToPath, pathToFileURL } from 'node:url'
import path from 'node:path'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
export const FIXTURE_DIR = path.join(root, 'tests', '__fixtures__')
export const PHOTO_DIR = path.join(FIXTURE_DIR, 'photos')
export const LOGO_PATH = path.join(FIXTURE_DIR, 'logo.png')

const TEAL = '#2dc4b5'

// Deterministic pseudo-random so fixtures are byte-stable across runs
function mulberry32(seed) {
  return function () {
    seed |= 0
    seed = (seed + 0x6d2b79f5) | 0
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

/** A landscape-ish scene with enough detail that JPEG compression is measurable. */
function scene(width, height, seed, label) {
  const rand = mulberry32(seed)
  const hue = Math.floor(rand() * 360)
  const horizon = Math.round(height * (0.55 + rand() * 0.15))

  const peaks = Array.from({ length: 5 }, (_, i) => {
    const x = (width / 4) * i
    const peakH = horizon - Math.round(rand() * height * 0.35) - height * 0.05
    return `M ${x - width / 5} ${horizon} L ${x} ${peakH} L ${x + width / 5} ${horizon} Z`
  }).join(' ')

  // Grain gives the encoder something real to chew on
  const speckles = Array.from({ length: 400 }, () => {
    const cx = Math.round(rand() * width)
    const cy = Math.round(rand() * height)
    const r = 1 + rand() * 3
    return `<circle cx="${cx}" cy="${cy}" r="${r.toFixed(1)}" fill="hsl(${hue}, 40%, ${(30 + rand() * 50).toFixed(0)}%)" fill-opacity="0.35"/>`
  }).join('')

  return Buffer.from(`
<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}">
  <defs>
    <linearGradient id="sky" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="hsl(${hue}, 65%, 62%)"/>
      <stop offset="100%" stop-color="hsl(${(hue + 40) % 360}, 55%, 82%)"/>
    </linearGradient>
    <linearGradient id="ground" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="hsl(${(hue + 180) % 360}, 35%, 38%)"/>
      <stop offset="100%" stop-color="hsl(${(hue + 200) % 360}, 30%, 18%)"/>
    </linearGradient>
  </defs>
  <rect width="${width}" height="${height}" fill="url(#sky)"/>
  <circle cx="${Math.round(width * (0.15 + rand() * 0.7))}" cy="${Math.round(horizon * 0.35)}" r="${Math.round(height * 0.07)}" fill="#fff" fill-opacity="0.85"/>
  <path d="${peaks}" fill="hsl(${(hue + 210) % 360}, 25%, 45%)" fill-opacity="0.9"/>
  <rect y="${horizon}" width="${width}" height="${height - horizon}" fill="url(#ground)"/>
  ${speckles}
  <text x="${Math.round(width * 0.04)}" y="${height - Math.round(height * 0.04)}"
        font-family="sans-serif" font-size="${Math.round(height * 0.07)}"
        font-weight="bold" fill="#ffffff" fill-opacity="0.75">${label}</text>
</svg>`)
}

/** A wordmark-style logo with transparency — what a real user would drop in. */
function logo() {
  return Buffer.from(`
<svg xmlns="http://www.w3.org/2000/svg" width="600" height="160">
  <text x="300" y="104" text-anchor="middle"
        font-family="Arial, Helvetica, sans-serif" font-size="76"
        font-weight="900" letter-spacing="8" fill="${TEAL}">WEHOST</text>
  <rect x="130" y="124" width="340" height="6" rx="3" fill="${TEAL}" fill-opacity="0.6"/>
</svg>`)
}

const PHOTOS = [
  { name: 'villa-01.jpg', width: 4000, height: 3000 },
  { name: 'villa-02.jpg', width: 3600, height: 2400 },
  { name: 'apartment-01.jpg', width: 3200, height: 2400 },
  { name: 'apartment-02.png', width: 2800, height: 2100 },
  { name: 'terrace-01.jpg', width: 3000, height: 2000 },
  { name: 'pool-01.png', width: 2400, height: 1800 }
]

export async function buildFixtures({ clean = true } = {}) {
  if (clean) await rm(FIXTURE_DIR, { recursive: true, force: true })
  await mkdir(PHOTO_DIR, { recursive: true })

  await sharp(logo()).png().toFile(LOGO_PATH)

  const written = []
  for (const [i, photo] of PHOTOS.entries()) {
    const target = path.join(PHOTO_DIR, photo.name)
    const label = photo.name.replace(/\.[^.]+$/, '')
    const pipeline = sharp(scene(photo.width, photo.height, i * 7919 + 13, label))

    if (photo.name.endsWith('.png')) {
      await pipeline.png({ compressionLevel: 6 }).toFile(target)
    } else {
      await pipeline.jpeg({ quality: 95 }).toFile(target)
    }
    written.push(target)
  }

  return { photos: written, logo: LOGO_PATH, dir: FIXTURE_DIR }
}

// Allow both `node scripts/make-fixtures.mjs` and importing from tests
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const { photos } = await buildFixtures()
  console.log(`✓ wrote ${photos.length} sample photos + logo to tests/__fixtures__/`)
}
