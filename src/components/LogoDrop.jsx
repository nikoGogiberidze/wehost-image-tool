import React, { useCallback, useRef, useState, useEffect } from 'react'

export default function LogoDrop({ logoPath, onLogoSaved }) {
  const [dragging, setDragging] = useState(false)
  const [previewUrl, setPreviewUrl] = useState(null)
  const inputRef = useRef(null)

  useEffect(() => {
    if (logoPath) {
      const url = 'file:///' + logoPath.replace(/\\/g, '/')
      setPreviewUrl(url)
    } else {
      setPreviewUrl(null)
    }
  }, [logoPath])

  const handleFile = useCallback(
    async (file) => {
      if (!file || !file.type.startsWith('image/')) return

      const reader = new FileReader()
      reader.onload = async () => {
        const base64 = reader.result.split(',')[1]
        try {
          const result = await window.electronAPI.saveLogo(base64, file.path || file.name)
          if (result?.savedPath) {
            onLogoSaved(result.savedPath)
            setPreviewUrl('file:///' + result.savedPath.replace(/\\/g, '/') + '?t=' + Date.now())
          }
        } catch (err) {
          console.error('Logo save error:', err)
        }
      }
      reader.readAsDataURL(file)
    },
    [onLogoSaved]
  )

  const onDrop = useCallback(
    (e) => {
      e.preventDefault()
      setDragging(false)
      handleFile(e.dataTransfer.files[0])
    },
    [handleFile]
  )

  const onDragOver = (e) => {
    e.preventDefault()
    setDragging(true)
  }
  const onDragLeave = () => setDragging(false)
  const onInputChange = (e) => {
    handleFile(e.target.files[0])
    e.target.value = ''
  }

  return (
    <div>
      <label className="block text-xs font-semibold text-wh-300 mb-2 uppercase tracking-wider">
        Watermark Logo
      </label>
      <div
        className={`
          relative flex items-center gap-3 p-3 rounded-xl border cursor-pointer
          transition-all duration-200
          ${
            dragging
              ? 'border-wh-teal bg-wh-teal/10'
              : 'border-wh-700 bg-wh-800 hover:border-wh-650'
          }
        `}
        onDrop={onDrop}
        onDragOver={onDragOver}
        onDragLeave={onDragLeave}
        onClick={() => inputRef.current?.click()}
      >
        <div className="w-12 h-12 rounded-lg bg-wh-750 flex items-center justify-center flex-shrink-0 overflow-hidden">
          {previewUrl ? (
            <img
              src={previewUrl}
              alt="Logo"
              className="w-full h-full object-contain"
              onError={() => setPreviewUrl(null)}
            />
          ) : (
            <svg
              xmlns="http://www.w3.org/2000/svg"
              className="w-6 h-6 text-wh-400"
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
          )}
        </div>

        <div className="flex-1 min-w-0">
          {logoPath ? (
            <>
              <p className="text-xs text-wh-200 font-medium">Logo set</p>
              <p className="text-xs text-wh-400">Drop to replace</p>
            </>
          ) : (
            <>
              <p className="text-xs text-wh-200 font-medium">Drop PNG here</p>
              <p className="text-xs text-wh-400">or click to browse</p>
            </>
          )}
        </div>

        {logoPath && (
          <div className="w-2 h-2 rounded-full bg-wh-teal flex-shrink-0" title="Logo loaded" />
        )}
      </div>

      <input
        ref={inputRef}
        type="file"
        accept="image/png,image/jpeg,image/webp"
        className="hidden"
        onChange={onInputChange}
      />
    </div>
  )
}
