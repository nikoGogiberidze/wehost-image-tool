// Generates build/icon.png, the source electron-builder converts into the
// Windows .ico. Kept as a script rather than a committed binary so the icon is
// reproducible and reviewable as code.
import sharp from 'sharp'
import { mkdir } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import path from 'node:path'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const outDir = path.join(root, 'build')

const BG = '#0b2434' // wh-900
const TEAL = '#2dc4b5' // wh-teal
const LIGHT = '#e0f2f0' // wh-100

const svg = `
<svg xmlns="http://www.w3.org/2000/svg" width="512" height="512" viewBox="0 0 512 512">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="#0f3041"/>
      <stop offset="100%" stop-color="${BG}"/>
    </linearGradient>
  </defs>

  <rect width="512" height="512" rx="112" fill="url(#bg)"/>
  <rect x="6" y="6" width="500" height="500" rx="106" fill="none" stroke="${TEAL}" stroke-opacity="0.25" stroke-width="3"/>

  <!-- Photo frame -->
  <rect x="112" y="136" width="288" height="216" rx="24" fill="none" stroke="${LIGHT}" stroke-opacity="0.55" stroke-width="14"/>
  <!-- Mountains inside the frame -->
  <path d="M136 312 L206 236 L256 288 L306 244 L376 312 Z" fill="${TEAL}" fill-opacity="0.85"/>
  <circle cx="330" cy="188" r="22" fill="${LIGHT}" fill-opacity="0.7"/>

  <!-- Watermark tile marks -->
  <g fill="${TEAL}" fill-opacity="0.9">
    <rect x="150" y="386" width="58" height="12" rx="6"/>
    <rect x="227" y="386" width="58" height="12" rx="6"/>
    <rect x="304" y="386" width="58" height="12" rx="6"/>
  </g>
</svg>`

await mkdir(outDir, { recursive: true })

const target = path.join(outDir, 'icon.png')
await sharp(Buffer.from(svg)).resize(512, 512).png({ compressionLevel: 9 }).toFile(target)

console.log(`✓ wrote ${path.relative(root, target)} (512×512)`)
