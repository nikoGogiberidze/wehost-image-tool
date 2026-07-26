import React, { useCallback, useRef, useState, memo } from 'react'
import { getPathForFile, generateThumbnail } from '../utils/ipc'

const ACCEPTED = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp']
const ACCEPTED_EXT = ['.jpg', '.jpeg', '.png', '.webp']

function formatBytes(bytes) {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

// Memoized tile: a thumbnail arriving for one file only re-renders that tile,
// not the whole grid — keeps big batches responsive
const FileTile = memo(function FileTile({ file, onPreview, onRemove }) {
  return (
    <div
      className={`relative group bg-wh-800 rounded-xl overflow-hidden border border-wh-700 ${onPreview ? 'cursor-pointer hover:border-wh-teal/60 transition-colors' : ''}`}
      onClick={() => onPreview?.(file)}
    >
      {file.preview ? (
        <img
          src={file.preview}
          alt={file.name}
          loading="lazy"
          decoding="async"
          className="w-full aspect-square object-cover"
        />
      ) : (
        <div className="w-full aspect-square flex items-center justify-center bg-wh-750">
          <svg className="w-6 h-6 text-wh-400 animate-spin" fill="none" viewBox="0 0 24 24">
            <circle
              className="opacity-25"
              cx="12"
              cy="12"
              r="10"
              stroke="currentColor"
              strokeWidth="4"
            />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
          </svg>
        </div>
      )}
      {/* Remove button */}
      <button
        onClick={(e) => {
          e.stopPropagation()
          onRemove(file.name)
        }}
        className="
          absolute top-1.5 right-1.5 w-5 h-5 rounded-full
          bg-wh-900/80 text-wh-100 text-xs
          opacity-0 group-hover:opacity-100 transition-opacity
          flex items-center justify-center
          hover:bg-red-500
        "
      >
        ×
      </button>
      <div className="px-2 py-1.5 border-t border-wh-700">
        <p className="text-xs text-wh-100 truncate" title={file.name}>
          {file.name}
        </p>
        <div className="flex items-center justify-between">
          <p className="text-xs text-wh-400">{formatBytes(file.size)}</p>
          {onPreview && (
            <p className="text-xs text-wh-teal opacity-0 group-hover:opacity-100 transition-opacity">
              Preview ›
            </p>
          )}
        </div>
      </div>
    </div>
  )
})

export default function DropZone({ files, onFiles, disabled, onPreview }) {
  const [dragging, setDragging] = useState(false)
  const inputRef = useRef(null)

  const processFiles = useCallback(
    async (rawFiles) => {
      if (!window.electronAPI) return // browser preview (Vite only) — no file access

      const valid = Array.from(rawFiles).filter((f) => ACCEPTED.includes(f.type))
      if (valid.length === 0) return

      // Only keep name, size and disk path — the image bytes stay on disk.
      // Thumbnails are generated below; `preview: null` shows a placeholder meanwhile.
      const existingNames = new Set(files.map((f) => f.name))
      const unique = valid
        .map((f) => ({
          name: f.name,
          size: f.size,
          type: f.type,
          path: getPathForFile(f),
          preview: null
        }))
        .filter((f) => f.path && !existingNames.has(f.name))
      if (unique.length === 0) return

      onFiles((prev) => {
        const names = new Set(prev.map((f) => f.name))
        return [...prev, ...unique.filter((f) => !names.has(f.name))]
      })

      // Generate thumbnails one at a time so large batches never spike memory.
      // Flush to state in small batches to keep re-renders (and UI jank) low.
      const pending = []
      const flush = () => {
        if (pending.length === 0) return
        const batch = pending.splice(0)
        onFiles((prev) =>
          prev.map((f) => {
            const hit = batch.find((b) => b.path === f.path)
            return hit && !f.preview ? { ...f, preview: hit.preview } : f
          })
        )
      }
      for (const entry of unique) {
        try {
          const { base64 } = await generateThumbnail(entry.path)
          if (base64) {
            pending.push({ path: entry.path, preview: `data:image/jpeg;base64,${base64}` })
          }
        } catch (err) {
          console.error('Thumbnail error:', err)
        }
        if (pending.length >= 3) flush()
      }
      flush()
    },
    [onFiles, files]
  )

  const onDrop = useCallback(
    (e) => {
      e.preventDefault()
      setDragging(false)
      if (disabled) return
      processFiles(e.dataTransfer.files)
    },
    [processFiles, disabled]
  )

  const onDragOver = useCallback(
    (e) => {
      e.preventDefault()
      if (!disabled) setDragging(true)
    },
    [disabled]
  )

  const onDragLeave = useCallback(() => setDragging(false), [])
  const onInputChange = useCallback(
    (e) => {
      processFiles(e.target.files)
      e.target.value = ''
    },
    [processFiles]
  )

  const removeFile = useCallback(
    (name) => {
      onFiles((prev) => prev.filter((f) => f.name !== name))
    },
    [onFiles]
  )

  const clearAll = () => {
    onFiles([])
  }

  if (files.length > 0) {
    return (
      <div className="flex flex-col h-full">
        {/* Header */}
        <div className="flex items-center justify-between mb-3 flex-shrink-0">
          <span className="text-wh-100 text-sm">
            {files.length} image{files.length !== 1 ? 's' : ''} loaded
          </span>
          <div className="flex gap-2">
            <button
              onClick={() => inputRef.current?.click()}
              className="px-3 py-1.5 text-xs rounded-lg bg-wh-750 text-wh-200 hover:bg-wh-700 transition-colors"
            >
              Add more
            </button>
            <button
              onClick={clearAll}
              className="px-3 py-1.5 text-xs rounded-lg bg-wh-750 text-red-400 hover:bg-red-900/20 hover:text-red-300 transition-colors"
            >
              Clear all
            </button>
          </div>
        </div>

        {/* Grid */}
        <div className="flex-1 overflow-y-auto">
          <div className="grid grid-cols-3 gap-3 pb-2">
            {files.map((file) => (
              <FileTile key={file.name} file={file} onPreview={onPreview} onRemove={removeFile} />
            ))}
          </div>
        </div>

        <input
          ref={inputRef}
          type="file"
          multiple
          accept={ACCEPTED_EXT.join(',')}
          className="hidden"
          onChange={onInputChange}
        />
      </div>
    )
  }

  return (
    <div
      className={`
        flex flex-col items-center justify-center h-full
        border-2 border-dashed rounded-2xl cursor-pointer
        transition-all duration-200
        ${
          dragging
            ? 'border-wh-teal bg-wh-teal/10'
            : 'border-wh-700 bg-wh-800/40 hover:border-wh-650 hover:bg-wh-800/60'
        }
        ${disabled ? 'opacity-50 cursor-not-allowed' : ''}
      `}
      onDrop={onDrop}
      onDragOver={onDragOver}
      onDragLeave={onDragLeave}
      onClick={() => !disabled && inputRef.current?.click()}
    >
      <svg
        xmlns="http://www.w3.org/2000/svg"
        className="w-12 h-12 text-wh-400 mb-4"
        fill="none"
        viewBox="0 0 24 24"
        stroke="currentColor"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={1.5}
          d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"
        />
      </svg>
      <p className="text-wh-100 font-medium mb-1">
        {dragging ? 'Drop images here' : 'Drag & drop images here'}
      </p>
      <p className="text-wh-300 text-sm mb-4">or click to browse</p>
      <p className="text-wh-300 text-xs">JPG, JPEG, PNG, WebP supported</p>

      <input
        ref={inputRef}
        type="file"
        multiple
        accept={ACCEPTED_EXT.join(',')}
        className="hidden"
        onChange={onInputChange}
      />
    </div>
  )
}
