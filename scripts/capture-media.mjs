// Drives the real Electron app to produce the README's screenshots and demo
// GIF. Everything here is the actual application — no mockups — so the images
// can never drift from what the app really looks like.
//
//   npm run build && npm run screenshots
import { mkdir, rm, writeFile, readdir } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import sharp from 'sharp'
import GIFEncoder from 'gif-encoder-2'

import { buildFixtures } from './make-fixtures.mjs'
import { launchApp, chooseMode, setLogo, addPhotos } from '../tests/e2e/helpers.mjs'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const OUT = path.join(ROOT, 'docs', 'screenshots')

const SHOT_WIDTH = 1000 // downscaled from the 1280px window for a sane repo size
const GIF_WIDTH = 800
const GIF_DELAY = 220 // ms per frame

async function shot(page, name, { clip } = {}) {
  const raw = await page.screenshot({ clip })
  const target = path.join(OUT, name)
  await sharp(raw).resize({ width: SHOT_WIDTH, withoutEnlargement: true }).png().toFile(target)
  console.log(`  ✓ ${name}`)
}

async function captureScreenshots(fixtures) {
  console.log('Screenshots:')
  const { page, cleanup } = await launchApp()

  try {
    await page.setViewportSize({ width: 1280, height: 800 })

    // 01 — the opening mode selector
    await shot(page, '01-mode-select.png')

    // 02 — thumbnail grid after loading a batch
    await chooseMode(page, 'Both')
    await setLogo(page, fixtures.logo)
    await addPhotos(page, fixtures.photos)
    await page.waitForTimeout(1200) // let the last thumbnails land
    await shot(page, '02-dropzone.png')

    // 03 — the settings sidebar, tiled + diagonal watermark turned on.
    // Note the button labels are lowercase in the DOM ("tiled"); the capital
    // letter you see in the UI comes from a CSS `capitalize`.
    await page.getByRole('button', { name: 'tiled', exact: true }).click()
    await page.getByTitle('Diagonal /').click()
    await page.waitForTimeout(300)
    await shot(page, '03-settings.png')

    // 04 — the live preview modal (the best-looking screen)
    await page.locator('.grid > div').first().click()
    await page.waitForTimeout(2500) // preview render + logo draw
    await shot(page, '04-preview.png')
    await page.getByRole('button', { name: /Close/i }).click()
    await page.waitForTimeout(400)

    return cleanup
  } catch (err) {
    await cleanup()
    throw err
  }
}

async function captureRun(fixtures) {
  console.log('Batch run (frames + final screenshot):')
  const { page, cleanup } = await launchApp()
  const frames = []

  try {
    await page.setViewportSize({ width: 1280, height: 800 })
    await chooseMode(page, 'Both')
    await setLogo(page, fixtures.logo)
    await addPhotos(page, fixtures.photos)
    await page.waitForTimeout(1500)

    // Hold on the loaded grid for a beat so the GIF opens on something readable
    for (let i = 0; i < 6; i++) frames.push(await page.screenshot())

    let capturing = true
    const ticker = (async () => {
      while (capturing) {
        frames.push(await page.screenshot())
        await page.waitForTimeout(90)
      }
    })()

    await page.getByRole('button', { name: /Process & Save/i }).click()
    await page.getByRole('heading', { name: 'Done' }).waitFor({ timeout: 120_000 })

    capturing = false
    await ticker

    // Linger on the finished state
    await page.waitForTimeout(400)
    for (let i = 0; i < 10; i++) frames.push(await page.screenshot())

    await shot(page, '05-progress-done.png')

    return { frames, cleanup }
  } catch (err) {
    await cleanup()
    throw err
  }
}

async function writeGif(frames) {
  console.log(`GIF: encoding ${frames.length} frames…`)

  // Keep the GIF small enough for GitHub to render inline
  const MAX_FRAMES = 46
  const step = Math.max(1, Math.floor(frames.length / MAX_FRAMES))
  const picked = frames.filter((_, i) => i % step === 0).slice(0, MAX_FRAMES)

  const first = await sharp(picked[0]).resize({ width: GIF_WIDTH }).raw().toBuffer({
    resolveWithObject: true
  })
  const { width, height } = first.info

  const encoder = new GIFEncoder(width, height, 'neuquant', true, picked.length)
  encoder.setDelay(GIF_DELAY)
  encoder.setQuality(12)
  encoder.setRepeat(0)
  encoder.start()

  for (const frame of picked) {
    const { data } = await sharp(frame)
      .resize({ width: GIF_WIDTH })
      .ensureAlpha()
      .raw()
      .toBuffer({ resolveWithObject: true })
    encoder.addFrame(data)
  }

  encoder.finish()
  const target = path.join(OUT, 'demo.gif')
  await writeFile(target, encoder.out.getData())
  return target
}

async function main() {
  await rm(OUT, { recursive: true, force: true })
  await mkdir(OUT, { recursive: true })

  const fixtures = await buildFixtures()

  const cleanupShots = await captureScreenshots(fixtures)
  await cleanupShots()

  const { frames, cleanup } = await captureRun(fixtures)
  await cleanup()

  const gif = await writeGif(frames)

  console.log('\nWrote to docs/screenshots/:')
  for (const file of (await readdir(OUT)).sort()) {
    console.log(`  ${file}`)
  }
  console.log(`\nGIF: ${gif}`)
}

await main()
