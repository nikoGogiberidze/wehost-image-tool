import { test, expect, _electron as electron } from '@playwright/test'
import { existsSync } from 'node:fs'
import { mkdtemp, rm, readdir } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'

import { buildFixtures } from '../../scripts/make-fixtures.mjs'
import { ROOT, PHOTO_INPUT, LOGO_INPUT } from './helpers.mjs'

// The packaged app loads shared/geometry.mjs from inside the asar archive via a
// dynamic import(). That works unpackaged, but asar is a virtual filesystem —
// this suite is the only thing that proves it still resolves once packaged.
const EXE = path.join(ROOT, 'release', 'win-unpacked', 'Wehost Image Tool.exe')

test.describe('packaged build', () => {
  test.skip(
    () => !existsSync(EXE),
    'run `npm run dist` first — this suite checks the packaged binary'
  )

  test('processes a batch from inside the asar archive', async () => {
    const fixtures = await buildFixtures({ clean: false })
    const userDataDir = await mkdtemp(path.join(tmpdir(), 'wehost-pkg-user-'))
    const outputDir = await mkdtemp(path.join(tmpdir(), 'wehost-pkg-out-'))

    const app = await electron.launch({
      executablePath: EXE,
      args: [`--user-data-dir=${userDataDir}`]
    })

    try {
      const page = await app.firstWindow()
      await page.waitForLoadState('domcontentloaded')

      await app.evaluate(({ dialog }, folder) => {
        dialog.showOpenDialog = async () => ({ canceled: false, filePaths: [folder] })
      }, outputDir)

      // "Both" exercises compression, the asar-loaded geometry module and the
      // watermark composite in one pass
      await page.getByRole('button', { name: /^Both/i }).first().click()
      await page.locator(LOGO_INPUT).setInputFiles(fixtures.logo)
      await page.getByText('Logo set').waitFor({ timeout: 20_000 })
      await page.locator(PHOTO_INPUT).setInputFiles(fixtures.photos.slice(0, 2))
      await page.getByText(/^2 images loaded$/).waitFor({ timeout: 30_000 })

      await page.getByRole('button', { name: /Process & Save/i }).click()
      await page.getByRole('heading', { name: 'Done' }).waitFor({ timeout: 90_000 })

      // If the dynamic import had failed, the handler would have thrown before
      // writing anything at all
      const written = await readdir(outputDir)
      expect(written).toHaveLength(2)
      expect(written.every((f) => f.endsWith('.jpg'))).toBe(true)
      await expect(page.getByText('Error', { exact: true })).toHaveCount(0)
    } finally {
      await app.close().catch(() => {})
      await rm(userDataDir, { recursive: true, force: true }).catch(() => {})
      await rm(outputDir, { recursive: true, force: true }).catch(() => {})
    }
  })
})
