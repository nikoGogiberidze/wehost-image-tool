import { test, expect } from '@playwright/test'
import { stat, readdir } from 'node:fs/promises'
import path from 'node:path'
import sharp from 'sharp'

import { buildFixtures } from '../../scripts/make-fixtures.mjs'
import { launchApp, chooseMode, setLogo, addPhotos, runBatch } from './helpers.mjs'

let fixtures

test.beforeAll(async () => {
  fixtures = await buildFixtures()
})

test.describe('compress mode', () => {
  test('writes a smaller file for every input and rewrites the extension', async () => {
    const { page, outputDir, cleanup } = await launchApp()

    try {
      await chooseMode(page, 'Compress')
      await addPhotos(page, fixtures.photos)
      await runBatch(page)

      const written = await readdir(outputDir)
      expect(written).toHaveLength(fixtures.photos.length)

      // Default format is jpeg, so PNG sources come out as .jpg
      expect(written).toContain('apartment-02.jpg')
      expect(written).toContain('pool-01.jpg')
      expect(written.every((f) => f.endsWith('.jpg'))).toBe(true)

      for (const source of fixtures.photos) {
        const name = path.basename(source).replace(/\.[^.]+$/, '') + '.jpg'
        const [before, after] = await Promise.all([stat(source), stat(path.join(outputDir, name))])
        expect(after.size, `${name} should be non-empty`).toBeGreaterThan(0)
        expect(after.size, `${name} should shrink`).toBeLessThan(before.size)
      }
    } finally {
      await cleanup()
    }
  })

  test('honours the max-width resize setting', async () => {
    const { page, outputDir, cleanup } = await launchApp()

    try {
      await chooseMode(page, 'Compress')
      await addPhotos(page, fixtures.photos.slice(0, 2))
      await runBatch(page)

      // Default compress settings resize to 2400px wide
      for (const file of await readdir(outputDir)) {
        const meta = await sharp(path.join(outputDir, file)).metadata()
        expect(meta.width, `${file} should be capped at 2400px`).toBeLessThanOrEqual(2400)
      }
    } finally {
      await cleanup()
    }
  })
})

test.describe('watermark mode', () => {
  test('stamps the logo without changing dimensions or filename', async () => {
    const { page, outputDir, cleanup } = await launchApp()

    try {
      await chooseMode(page, 'Watermark')
      await setLogo(page, fixtures.logo)
      await addPhotos(page, fixtures.photos.slice(0, 3))
      await runBatch(page)

      const written = await readdir(outputDir)
      expect(written.sort()).toEqual(
        fixtures.photos
          .slice(0, 3)
          .map((p) => path.basename(p))
          .sort()
      )

      // Watermark-only must not resize
      for (const source of fixtures.photos.slice(0, 3)) {
        const name = path.basename(source)
        const [src, out] = await Promise.all([
          sharp(source).metadata(),
          sharp(path.join(outputDir, name)).metadata()
        ])
        expect(out.width, `${name} width preserved`).toBe(src.width)
        expect(out.height, `${name} height preserved`).toBe(src.height)
      }
    } finally {
      await cleanup()
    }
  })

  test('actually modifies the pixels it claims to watermark', async () => {
    const { page, outputDir, cleanup } = await launchApp()

    try {
      await chooseMode(page, 'Watermark')
      await setLogo(page, fixtures.logo)
      await addPhotos(page, fixtures.photos.slice(0, 1))
      await runBatch(page)

      const source = fixtures.photos[0]
      const output = path.join(outputDir, path.basename(source))

      // The default position is bottom-right, inset by 2% of the width.
      // Crop that region from both images — they must differ.
      const meta = await sharp(source).metadata()
      const region = {
        left: Math.round(meta.width * 0.6),
        top: Math.round(meta.height * 0.75),
        width: Math.round(meta.width * 0.35),
        height: Math.round(meta.height * 0.2)
      }

      const [before, after] = await Promise.all([
        sharp(source).extract(region).raw().toBuffer(),
        sharp(output).extract(region).raw().toBuffer()
      ])

      expect(before.equals(after), 'watermark region should have changed').toBe(false)
    } finally {
      await cleanup()
    }
  })

  // Regression: the pipeline used to place corner watermarks with Sharp's
  // `gravity`, which pins them flush against the edge, while the preview canvas
  // inset them by 2%. The preview was therefore lying about the output. Both
  // sides now share computeSinglePosition, so the padding must be real.
  test('insets a corner watermark instead of pinning it flush to the edge', async () => {
    const { page, outputDir, cleanup } = await launchApp()

    try {
      await chooseMode(page, 'Watermark')
      await setLogo(page, fixtures.logo)
      await addPhotos(page, fixtures.photos.slice(0, 1))
      await runBatch(page)

      const source = fixtures.photos[0]
      const output = path.join(outputDir, path.basename(source))
      const { width, height } = await sharp(source).metadata()

      // Both files are JPEG, so re-encoding perturbs every pixel slightly and a
      // byte comparison proves nothing. Instead find the bounding box of
      // *meaningfully* changed pixels and check where its right edge lands.
      const quadrant = {
        left: Math.round(width / 2),
        top: Math.round(height / 2),
        width: width - Math.round(width / 2),
        height: height - Math.round(height / 2)
      }

      const [before, after] = await Promise.all([
        sharp(source).extract(quadrant).raw().toBuffer({ resolveWithObject: true }),
        sharp(output).extract(quadrant).raw().toBuffer({ resolveWithObject: true })
      ])

      const { width: qw, height: qh, channels } = before.info
      const THRESHOLD = 40 // well above JPEG ringing, well below the logo's contrast
      let maxChangedX = -1
      let maxChangedY = -1

      for (let y = 0; y < qh; y++) {
        for (let x = 0; x < qw; x++) {
          const i = (y * qw + x) * channels
          const delta =
            Math.abs(before.data[i] - after.data[i]) +
            Math.abs(before.data[i + 1] - after.data[i + 1]) +
            Math.abs(before.data[i + 2] - after.data[i + 2])
          if (delta > THRESHOLD) {
            if (x > maxChangedX) maxChangedX = x
            if (y > maxChangedY) maxChangedY = y
          }
        }
      }

      expect(maxChangedX, 'the watermark should be somewhere in this quadrant').toBeGreaterThan(0)

      const pad = Math.round(width * 0.02)
      const gapFromRight = qw - 1 - maxChangedX
      const gapFromBottom = qh - 1 - maxChangedY

      // Sharp's `gravity` would put these at ~0. They should sit at ~pad.
      expect(gapFromRight, 'watermark should be inset from the right edge').toBeGreaterThan(
        pad * 0.5
      )
      expect(gapFromBottom, 'watermark should be inset from the bottom edge').toBeGreaterThan(
        pad * 0.5
      )
    } finally {
      await cleanup()
    }
  })
})

test.describe('both mode', () => {
  test('compresses and watermarks in one pass', async () => {
    const { page, outputDir, cleanup } = await launchApp()

    try {
      await chooseMode(page, 'Both')
      await setLogo(page, fixtures.logo)
      await addPhotos(page, fixtures.photos.slice(0, 3))
      await runBatch(page)

      const written = await readdir(outputDir)
      expect(written).toHaveLength(3)

      for (const file of written) {
        const full = path.join(outputDir, file)
        const meta = await sharp(full).metadata()
        expect(file.endsWith('.jpg'), `${file} should be re-encoded to jpeg`).toBe(true)
        expect(meta.width, `${file} should be resized`).toBeLessThanOrEqual(2400)
        expect((await stat(full)).size).toBeGreaterThan(0)
      }
    } finally {
      await cleanup()
    }
  })
})

test.describe('error handling', () => {
  test('reports a clear error when watermarking without a logo', async () => {
    const { page, cleanup } = await launchApp()

    try {
      await chooseMode(page, 'Watermark')
      await addPhotos(page, fixtures.photos.slice(0, 1))
      await runBatch(page)

      // The batch completes, but the row must be marked failed and carry the
      // reason — it must not sit silently on "Queued" (regression: the invoke
      // reply can beat the progress events on a fast failure).
      await expect(page.getByText('Error', { exact: true })).toBeVisible()
      await expect(page.getByTitle(/No watermark logo set/i)).toHaveCount(1)
      await expect(page.getByText('Queued', { exact: true })).toHaveCount(0)
    } finally {
      await cleanup()
    }
  })
})
