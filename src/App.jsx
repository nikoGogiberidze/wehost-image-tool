import React, { useState, useCallback, useEffect } from 'react'
import ModeSelector from './components/ModeSelector'
import DropZone from './components/DropZone'
import WatermarkSettings from './components/WatermarkSettings'
import CompressSettings from './components/CompressSettings'
import ProgressPanel from './components/ProgressPanel'
import WatermarkPreview from './components/WatermarkPreview'
import { useSettings } from './hooks/useSettings'
import { useProcessor } from './hooks/useProcessor'
import { storeSet, readLogo, saveFolder } from './utils/ipc'

const MODE_LABELS = {
  watermark: 'Watermark',
  compress: 'Compress',
  both: 'Watermark + Compress'
}

export default function App() {
  const [mode, setMode] = useState(null)
  const [files, setFiles] = useState([])
  const [logoBase64, setLogoBase64] = useState(null)
  const [previewFile, setPreviewFile] = useState(null)
  const [outputFolder, setOutputFolder] = useState(null)

  const { settings, loaded, setSetting, setWatermark, setCompress } = useSettings()
  const { processing, done, progress, start, reset } = useProcessor()

  useEffect(() => {
    if (!loaded) return
    if (settings.logoPath) {
      readLogo()
        .then(({ base64 }) => setLogoBase64(base64 || null))
        .catch(console.error)
    } else {
      setLogoBase64(null)
    }
  }, [loaded, settings.logoPath])

  const handleModeSelect = useCallback((selectedMode) => {
    setMode(selectedMode)
    storeSet('lastMode', selectedMode).catch(console.error)
  }, [])

  const handleLogoSaved = useCallback(
    (savedPath) => {
      setSetting('logoPath', savedPath)
    },
    [setSetting]
  )

  const handleProcess = useCallback(async () => {
    if (files.length === 0 || processing) return
    // Choose the output folder up front — images are saved to it as each one finishes
    let folderPath = null
    try {
      const res = await saveFolder()
      folderPath = res?.folderPath
    } catch (err) {
      console.error('Folder dialog error:', err)
    }
    if (!folderPath) return // user cancelled
    setOutputFolder(folderPath)
    await start({
      files,
      mode,
      watermarkSettings: settings.watermark,
      compressSettings: settings.compress,
      outputFolder: folderPath
    })
  }, [files, mode, processing, settings, start])

  const handleReset = useCallback(() => {
    reset()
    setFiles([])
    setOutputFolder(null)
  }, [reset])

  // ── Mode selection screen ────────────────────────────────────────────────
  if (!mode) {
    return <ModeSelector onSelect={handleModeSelect} />
  }

  const showWatermark = mode === 'watermark' || mode === 'both'
  const showCompress = mode === 'compress' || mode === 'both'

  // ── Main workspace ────────────────────────────────────────────────────────
  return (
    <div className="flex h-screen bg-wh-900 overflow-hidden">
      {previewFile && (
        <WatermarkPreview
          file={previewFile}
          settings={settings.watermark}
          logoBase64={logoBase64}
          onClose={() => setPreviewFile(null)}
        />
      )}
      {/* ── Left sidebar ──────────────────────────────────────────────────── */}
      <aside className="w-72 flex-shrink-0 bg-wh-850 border-r border-wh-700 flex flex-col">
        {/* Sidebar header */}
        <div className="px-4 py-4 border-b border-wh-700 flex items-center gap-3">
          <button
            onClick={() => {
              setMode(null)
              handleReset()
            }}
            className="w-7 h-7 rounded-lg bg-wh-750 hover:bg-wh-700 text-wh-300 hover:text-wh-100 flex items-center justify-center transition-colors"
            title="Back to mode selection"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              className="w-3.5 h-3.5"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M15 19l-7-7 7-7"
              />
            </svg>
          </button>
          <div>
            <div className="flex items-center gap-1.5">
              <span className="text-sm font-black tracking-widest text-wh-teal uppercase">
                WE<span className="text-wh-light">HOST</span>
              </span>
            </div>
            <p className="text-xs text-wh-300 mt-0.5">{MODE_LABELS[mode]}</p>
          </div>
        </div>

        {/* Settings scroll area */}
        <div className="flex-1 overflow-y-auto px-4 py-4">
          {showWatermark && loaded && (
            <WatermarkSettings
              settings={settings.watermark}
              logoPath={settings.logoPath}
              setWatermark={setWatermark}
              onLogoSaved={handleLogoSaved}
            />
          )}

          {showWatermark && showCompress && <div className="h-px bg-wh-700 my-5" />}

          {showCompress && loaded && (
            <CompressSettings settings={settings.compress} setCompress={setCompress} />
          )}
        </div>
      </aside>

      {/* ── Main area ─────────────────────────────────────────────────────── */}
      <main className="flex-1 flex flex-col overflow-hidden">
        {/* Top bar */}
        <div className="flex-shrink-0 px-6 py-4 border-b border-wh-700 flex items-center justify-between">
          <h1 className="text-base font-semibold text-wh-100">
            {processing ? 'Processing…' : done ? 'Done' : 'Upload Images'}
          </h1>
          {(processing || done) && (
            <button
              onClick={handleReset}
              className="px-3 py-1.5 text-xs rounded-lg bg-wh-750 text-wh-200 hover:bg-wh-700 transition-colors"
            >
              Start over
            </button>
          )}
        </div>

        {/* Content area */}
        <div className="flex-1 overflow-hidden px-6 py-5 flex flex-col">
          {processing || done ? (
            <ProgressPanel
              progress={progress}
              files={files}
              done={done}
              outputFolder={outputFolder}
            />
          ) : (
            <DropZone
              files={files}
              onFiles={setFiles}
              disabled={processing}
              onPreview={showWatermark ? setPreviewFile : null}
            />
          )}
        </div>

        {/* Action bar */}
        {!processing && !done && (
          <div className="flex-shrink-0 px-6 pb-5">
            <button
              onClick={handleProcess}
              disabled={files.length === 0}
              className="
                w-full py-3.5 rounded-xl font-bold text-sm tracking-wide uppercase
                bg-wh-teal hover:bg-wh-light text-wh-900
                disabled:opacity-40 disabled:cursor-not-allowed
                transition-colors duration-200
                flex items-center justify-center gap-2
              "
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                className="w-4 h-4"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z"
                />
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                />
              </svg>
              Process &amp; Save ({files.length} image{files.length !== 1 ? 's' : ''})
            </button>
            <p className="text-xs text-wh-400 text-center mt-2">
              You&apos;ll pick an output folder first — images are saved there as each one finishes
            </p>
          </div>
        )}
      </main>
    </div>
  )
}
