import React, { memo } from 'react'
import { openFolder } from '../utils/ipc'

function formatBytes(bytes) {
  if (!bytes && bytes !== 0) return '—'
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

function savings(input, output) {
  if (!input || !output) return null
  return ((input - output) / input) * 100
}

const STATUS_BADGE = {
  queued: { label: 'Queued', cls: 'bg-wh-750 text-wh-300' },
  processing: { label: 'Processing', cls: 'bg-wh-teal/20 text-wh-teal animate-pulse' },
  done: { label: 'Done', cls: 'bg-emerald-500/20 text-emerald-400' },
  error: { label: 'Error', cls: 'bg-red-500/20 text-red-400' }
}

// Memoized row: only the row whose status changed re-renders on each progress event
const ProgressRow = memo(function ProgressRow({ row, preview }) {
  const badge = STATUS_BADGE[row.status] || STATUS_BADGE.queued
  const savePct = savings(row.inputSize, row.outputSize)

  return (
    <div className="flex items-center gap-3 bg-wh-800 rounded-xl px-3 py-2.5 border border-wh-700">
      <div className="w-10 h-10 rounded-lg bg-wh-750 overflow-hidden flex-shrink-0">
        {preview && (
          <img
            src={preview}
            alt={row.filename}
            loading="lazy"
            decoding="async"
            className="w-full h-full object-cover"
          />
        )}
      </div>

      <div className="flex-1 min-w-0">
        <p className="text-xs text-wh-100 truncate font-medium" title={row.filename}>
          {row.filename}
        </p>
        <div className="flex items-center gap-1.5 mt-0.5">
          <span className="text-xs text-wh-300">{formatBytes(row.inputSize)}</span>
          {row.outputSize && (
            <>
              <span className="text-xs text-wh-400">→</span>
              <span className="text-xs text-wh-200">{formatBytes(row.outputSize)}</span>
            </>
          )}
          {savePct !== null && savePct > 0 && (
            <span className="text-xs text-emerald-400 font-medium">-{savePct.toFixed(1)}%</span>
          )}
          {row.error && (
            <span className="text-xs text-red-400 truncate" title={row.error}>
              {row.error}
            </span>
          )}
        </div>
      </div>

      <span className={`text-xs px-2 py-0.5 rounded-full font-medium flex-shrink-0 ${badge.cls}`}>
        {badge.label}
      </span>
    </div>
  )
})

export default function ProgressPanel({ progress, files, done, outputFolder }) {
  const completed = progress.filter((p) => p.status === 'done' || p.status === 'error').length
  const total = progress.length
  const pct = total > 0 ? (completed / total) * 100 : 0

  const totalInputBytes = progress.reduce((s, p) => s + (p.inputSize || 0), 0)
  const totalOutputBytes = progress.reduce((s, p) => s + (p.outputSize || p.inputSize || 0), 0)
  const totalSaved = totalInputBytes - totalOutputBytes

  const handleOpenFolder = () => {
    if (outputFolder) openFolder(outputFolder).catch(console.error)
  }

  const previewMap = {}
  if (files) {
    files.forEach((f) => {
      previewMap[f.name] = f.preview
    })
  }

  return (
    <div className="flex flex-col h-full">
      {/* Overall progress */}
      <div className="flex-shrink-0 mb-4">
        <div className="flex items-center justify-between mb-2">
          <span className="text-sm font-medium text-wh-100">
            {completed} / {total} images
          </span>
          {done && totalSaved > 0 && (
            <span className="text-xs text-emerald-400 font-medium">
              Saved {formatBytes(totalSaved)} total
            </span>
          )}
        </div>
        <div className="w-full h-2 bg-wh-750 rounded-full overflow-hidden">
          <div
            className="h-full bg-wh-teal rounded-full transition-all duration-300"
            style={{ width: `${pct}%` }}
          />
        </div>
      </div>

      {/* Per-image rows */}
      <div className="flex-1 overflow-y-auto space-y-1.5 pr-1">
        {progress.map((row, i) => (
          <ProgressRow key={row.filename + i} row={row} preview={previewMap[row.filename]} />
        ))}
      </div>

      {/* Done summary — files are already saved as they finished processing */}
      {done && (
        <div className="flex-shrink-0 mt-4 pt-4 border-t border-wh-700">
          <p className="text-xs text-wh-200 text-center mb-1">
            <span className="text-wh-100 font-semibold">
              {progress.filter((p) => p.status === 'done').length}
            </span>{' '}
            image{progress.filter((p) => p.status === 'done').length !== 1 ? 's' : ''} saved
            {totalSaved > 0 && (
              <>
                {' '}
                — <span className="text-emerald-400 font-semibold">
                  {formatBytes(totalSaved)}
                </span>{' '}
                smaller
              </>
            )}
          </p>
          {outputFolder && (
            <p className="text-xs text-wh-400 text-center mb-3 truncate" title={outputFolder}>
              {outputFolder}
            </p>
          )}
          <button
            onClick={handleOpenFolder}
            disabled={!outputFolder}
            className="
              w-full py-3 rounded-xl font-bold text-sm uppercase tracking-wide
              bg-wh-teal hover:bg-wh-light text-wh-900
              disabled:opacity-50 disabled:cursor-not-allowed
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
                d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z"
              />
            </svg>
            Open Folder
          </button>
        </div>
      )}
    </div>
  )
}
