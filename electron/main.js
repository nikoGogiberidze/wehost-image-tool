const { app, BrowserWindow, ipcMain, dialog, shell } = require('electron')
const path = require('path')
const fs = require('fs')
const { promises: fsp } = require('fs')

const Store = require('electron-store')

// Placement geometry is shared with the renderer's preview canvas so the two
// can never disagree. It is ESM (the renderer needs that), and this file is
// CJS, so it is loaded once during startup via dynamic import.
let geometry
async function loadGeometry() {
  if (!geometry) geometry = await import('../shared/geometry.mjs')
  return geometry
}

let store

function getStore() {
  if (store) return store
  store = new Store({
    defaults: {
      logoPath: '',
      watermark: {
        position: 'southeast',
        tiled: false,
        tileGap: 150,
        opacity: 0.7,
        sizePercent: 0.12,
        rotation: 0
      },
      compress: {
        format: 'jpeg',
        quality: 82,
        resizeEnabled: true,
        maxWidth: 2400
      },
      lastMode: 'both'
    }
  })
  return store
}

let sharpModule

function getSharp() {
  if (sharpModule) return sharpModule
  // Sharp is a native module — require at runtime after app ready
  sharpModule = require('sharp')
  // Don't let libvips cache decoded images between files — keeps memory flat on big batches
  sharpModule.cache(false)
  // Leave 2 cores free for the UI so scrolling stays smooth while Sharp works
  const os = require('os')
  sharpModule.concurrency(Math.max(2, os.cpus().length - 2))
  return sharpModule
}

// Unpackaged runs load the Vite dev server. Setting NODE_ENV=production forces
// the built bundle instead, which is how the E2E suite drives the real app.
const isDev = !app.isPackaged && process.env.NODE_ENV !== 'production'

let mainWindow

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 800,
    minWidth: 960,
    minHeight: 640,
    backgroundColor: '#0f172a',
    titleBarStyle: 'default',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false
    }
  })

  if (isDev) {
    mainWindow.loadURL('http://localhost:5173')
    mainWindow.webContents.openDevTools()
  } else {
    mainWindow.loadFile(path.join(__dirname, '../dist/index.html'))
  }
}

app.whenReady().then(async () => {
  getStore()
  await loadGeometry()
  createWindow()
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})

// ─── IPC: store:get ───────────────────────────────────────────────────────────
ipcMain.handle('store:get', async (_event, { key }) => {
  const s = getStore()
  return { value: s.get(key) }
})

// ─── IPC: store:set ───────────────────────────────────────────────────────────
ipcMain.handle('store:set', async (_event, { key, value }) => {
  const s = getStore()
  s.set(key, value)
  return { ok: true }
})

// ─── IPC: logo:save ───────────────────────────────────────────────────────────
ipcMain.handle('logo:save', async (_event, { base64 }) => {
  const userData = app.getPath('userData')
  const savedPath = path.join(userData, 'watermark.png')
  const buffer = Buffer.from(base64, 'base64')
  await fsp.writeFile(savedPath, buffer)
  const s = getStore()
  s.set('logoPath', savedPath)
  return { savedPath }
})

// ─── IPC: logo:read ───────────────────────────────────────────────────────────
ipcMain.handle('logo:read', async () => {
  const s = getStore()
  const logoPath = s.get('logoPath')
  if (!logoPath || !fs.existsSync(logoPath)) return { base64: null }
  const data = await fsp.readFile(logoPath)
  return { base64: data.toString('base64') }
})

// ─── IPC: dialog:saveFolder ───────────────────────────────────────────────────
ipcMain.handle('dialog:saveFolder', async () => {
  const result = await dialog.showOpenDialog(mainWindow, {
    title: 'Choose output folder',
    properties: ['openDirectory', 'createDirectory']
  })
  if (result.canceled || result.filePaths.length === 0) return { folderPath: null }
  return { folderPath: result.filePaths[0] }
})

// ─── IPC: process:images ─────────────────────────────────────────────────────
// Files arrive as disk paths (not base64) and each result is written to the
// output folder as soon as it finishes — memory stays flat regardless of batch size.
ipcMain.handle(
  'process:images',
  async (_event, { files, mode, watermarkSettings, compressSettings, outputFolder }) => {
    const { scaleGap, computeTilePositions, computeSinglePosition, resolveOutputName } =
      await loadGeometry()

    let sharp
    try {
      sharp = getSharp()
    } catch (err) {
      console.error('Sharp not available:', err)
      return { error: 'Sharp not available: ' + err.message }
    }

    if (!outputFolder) {
      return { error: 'No output folder selected.' }
    }

    const results = []

    for (let i = 0; i < files.length; i++) {
      const file = files[i]

      mainWindow.webContents.send('process:progress', {
        index: i,
        total: files.length,
        filename: file.name,
        status: 'processing',
        inputSize: file.size,
        outputSize: null
      })

      try {
        if (!file.path || !fs.existsSync(file.path)) {
          throw new Error('Source file not found — it may have been moved or deleted.')
        }

        // `buffer` holds the intermediate result; while null, the source path is used directly
        let buffer = null

        // ── Compress ──────────────────────────────────────────────────────────
        if (mode === 'compress' || mode === 'both') {
          const { format, quality, resizeEnabled, maxWidth } = compressSettings
          let pipeline = sharp(file.path)

          if (resizeEnabled && maxWidth) {
            pipeline = pipeline.resize({ width: maxWidth, withoutEnlargement: true })
          }

          if (format === 'jpeg') {
            pipeline = pipeline.jpeg({ quality, mozjpeg: true })
          } else if (format === 'png') {
            pipeline = pipeline.png({ quality })
          } else if (format === 'webp') {
            pipeline = pipeline.webp({ quality })
          }

          buffer = await pipeline.toBuffer()
        }

        // ── Watermark ─────────────────────────────────────────────────────────
        if (mode === 'watermark' || mode === 'both') {
          const s = getStore()
          const logoPath = s.get('logoPath')

          if (!logoPath || !fs.existsSync(logoPath)) {
            throw new Error('No watermark logo set — drop a PNG logo in the sidebar first.')
          }

          {
            const {
              position,
              tiled,
              tileGap,
              opacity,
              sizePercent,
              rotation = 0
            } = watermarkSettings

            // Use the compressed buffer if present, otherwise read straight from disk
            const input = buffer || file.path
            const meta = await sharp(input).metadata()
            const imgWidth = meta.width
            const imgHeight = meta.height
            const logoWidth = Math.round(imgWidth * sizePercent)

            // tileGap is defined in ORIGINAL-image pixels (what the preview shows).
            // In "both" mode the image was already resized during compression, so
            // scale the gap by the same ratio — otherwise a large gap on a shrunken
            // image produces far fewer tiles than the preview promised.
            let effectiveGap = tileGap
            if (buffer) {
              const origMeta = await sharp(file.path).metadata()
              effectiveGap = scaleGap(tileGap, imgWidth, origMeta.width)
            }

            // Resize + apply opacity to logo
            const logoBuffer = await sharp(logoPath)
              .resize({ width: logoWidth, withoutEnlargement: false })
              .ensureAlpha()
              .toBuffer()

            // Apply opacity by manipulating the alpha channel
            const { data: rawData, info } = await sharp(logoBuffer)
              .raw()
              .toBuffer({ resolveWithObject: true })

            const channels = info.channels // 4 for RGBA
            for (let px = 0; px < rawData.length; px += channels) {
              rawData[px + 3] = Math.round(rawData[px + 3] * opacity)
            }

            let opaqueLogoBuffer = await sharp(rawData, {
              raw: { width: info.width, height: info.height, channels }
            })
              .png()
              .toBuffer()

            // Original logo dimensions (pre-rotation) used for tiled stepping
            const origLogoW = logoWidth
            const origLogoH = info.height

            // Apply rotation if needed
            let finalLogoW = origLogoW
            let finalLogoH = origLogoH
            if (rotation !== 0) {
              opaqueLogoBuffer = await sharp(opaqueLogoBuffer)
                .rotate(rotation, { background: { r: 0, g: 0, b: 0, alpha: 0 } })
                .toBuffer()
              const rotMeta = await sharp(opaqueLogoBuffer).metadata()
              finalLogoW = rotMeta.width
              finalLogoH = rotMeta.height
            }

            if (tiled) {
              // Step using original (pre-rotation) dimensions so the gap stays even
              const positions = computeTilePositions({
                imgWidth,
                imgHeight,
                tileW: origLogoW,
                tileH: origLogoH,
                finalW: finalLogoW,
                finalH: finalLogoH,
                gap: effectiveGap
              })
              if (positions.length > 0) {
                const compositeInputs = positions.map(({ top, left }) => ({
                  input: opaqueLogoBuffer,
                  top,
                  left
                }))
                buffer = await sharp(input).composite(compositeInputs).toBuffer()
              }
            } else {
              // Explicit offsets rather than Sharp's `gravity`: gravity pins the
              // logo flush against the edge, but the preview insets it. Sharing
              // computeSinglePosition keeps the two identical.
              const { top, left } = computeSinglePosition({
                imgWidth,
                imgHeight,
                logoW: origLogoW,
                logoH: origLogoH,
                finalW: finalLogoW,
                finalH: finalLogoH,
                position
              })
              buffer = await sharp(input)
                .composite([{ input: opaqueLogoBuffer, top, left, blend: 'over' }])
                .toBuffer()
            }
          }
        }

        // Edge case: nothing produced a buffer (e.g. tiled watermark on a tiny
        // image with no tiles placed) — pass the original file through unchanged
        if (!buffer) {
          buffer = await fsp.readFile(file.path)
        }

        // Rename extension when compressing to a different format
        const outputName = resolveOutputName(file.name, mode, compressSettings?.format)

        // Write immediately and release the buffer — nothing accumulates in memory
        const outPath = path.join(outputFolder, outputName)
        await fsp.writeFile(outPath, buffer)
        const outputSize = buffer.length
        buffer = null

        results.push({ name: outputName, outputSize, outPath })

        mainWindow.webContents.send('process:progress', {
          index: i,
          total: files.length,
          filename: file.name,
          outputName,
          status: 'done',
          inputSize: file.size,
          outputSize
        })
      } catch (err) {
        console.error(`Error processing ${file.name}:`, err)
        results.push({ name: file.name, error: err.message })
        mainWindow.webContents.send('process:progress', {
          index: i,
          total: files.length,
          filename: file.name,
          status: 'error',
          inputSize: file.size,
          outputSize: null,
          error: err.message
        })
      }
    }

    return { results, outputFolder }
  }
)

// ─── IPC: thumb:generate ─────────────────────────────────────────────────────
// Small thumbnail for the file grid — the renderer never holds full-res copies
ipcMain.handle('thumb:generate', async (_event, { filePath }) => {
  try {
    const sharp = getSharp()
    const buf = await sharp(filePath)
      .resize({ width: 320, height: 320, fit: 'inside', withoutEnlargement: true })
      .jpeg({ quality: 70 })
      .toBuffer()
    return { base64: buf.toString('base64') }
  } catch (err) {
    console.error('Thumbnail error:', err)
    return { base64: null, error: err.message }
  }
})

// ─── IPC: preview:generate ───────────────────────────────────────────────────
// Medium-res preview for the watermark preview modal (capped width, not full-res)
ipcMain.handle('preview:generate', async (_event, { filePath, maxWidth = 1600 }) => {
  try {
    const sharp = getSharp()
    const meta = await sharp(filePath).metadata()
    const buf = await sharp(filePath)
      .resize({ width: maxWidth, withoutEnlargement: true })
      .jpeg({ quality: 82 })
      .toBuffer()
    return { base64: buf.toString('base64'), origWidth: meta.width, origHeight: meta.height }
  } catch (err) {
    console.error('Preview error:', err)
    return { base64: null, error: err.message }
  }
})

// ─── IPC: shell:openFolder ───────────────────────────────────────────────────
ipcMain.handle('shell:openFolder', async (_event, { folderPath }) => {
  await shell.openPath(folderPath)
  return { ok: true }
})
