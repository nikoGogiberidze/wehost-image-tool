import { _electron as electron } from '@playwright/test'
import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

export const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..')

// Selectors: DropZone's input takes many files, LogoDrop's takes one
export const PHOTO_INPUT = 'input[type=file][multiple]'
export const LOGO_INPUT = 'input[type=file]:not([multiple])'

/**
 * Launch the real Electron app against the built bundle.
 *
 * NODE_ENV=production is what flips main.js off the Vite dev server and onto
 * dist/index.html, so this exercises the same code path a packaged build runs.
 * Each launch gets a throwaway userData directory so tests never read or
 * clobber the developer's own saved settings and logo.
 */
export async function launchApp() {
  const userDataDir = await mkdtemp(path.join(tmpdir(), 'wehost-e2e-user-'))
  const outputDir = await mkdtemp(path.join(tmpdir(), 'wehost-e2e-out-'))

  const app = await electron.launch({
    args: [ROOT, `--user-data-dir=${userDataDir}`],
    env: { ...process.env, NODE_ENV: 'production' }
  })

  const page = await app.firstWindow()
  await page.waitForLoadState('domcontentloaded')

  // The output-folder picker is a native modal — stub it so the run is headless
  await app.evaluate(({ dialog }, folder) => {
    dialog.showOpenDialog = async () => ({ canceled: false, filePaths: [folder] })
  }, outputDir)

  const cleanup = async () => {
    await app.close().catch(() => {})
    await rm(userDataDir, { recursive: true, force: true }).catch(() => {})
    await rm(outputDir, { recursive: true, force: true }).catch(() => {})
  }

  return { app, page, outputDir, userDataDir, cleanup }
}

/** Pick a processing mode from the opening screen. */
export async function chooseMode(page, label) {
  await page
    .getByRole('button', { name: new RegExp(`^${label}`, 'i') })
    .first()
    .click()
}

/** Load the watermark logo through the real LogoDrop → logo:save IPC path. */
export async function setLogo(page, logoPath) {
  await page.locator(LOGO_INPUT).setInputFiles(logoPath)
  await page.getByText('Logo set').waitFor({ timeout: 20_000 })
}

/** Load photos through the real DropZone → webUtils.getPathForFile path. */
export async function addPhotos(page, photoPaths) {
  await page.locator(PHOTO_INPUT).setInputFiles(photoPaths)
  // The counter is pluralised ("1 image loaded" / "3 images loaded")
  await page
    .getByText(new RegExp(`^${photoPaths.length} images? loaded$`))
    .waitFor({ timeout: 30_000 })
}

/** Kick off processing and wait for every row to settle. */
export async function runBatch(page) {
  await page.getByRole('button', { name: /Process & Save/i }).click()
  await page.getByRole('heading', { name: 'Done' }).waitFor({ timeout: 90_000 })
}
