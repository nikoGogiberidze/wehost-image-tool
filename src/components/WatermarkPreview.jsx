import React, { useEffect, useRef, useState } from 'react'
import { generatePreview } from '../utils/ipc'
// Same module the Sharp pipeline uses — the preview and the output cannot drift
import { computeTilePositions, computeSinglePosition, scaleGap } from '../../shared/geometry.mjs'

export default function WatermarkPreview({ file, settings, logoBase64, onClose }) {
  const canvasRef = useRef(null)
  // Medium-res preview fetched on demand — the full-res image never enters the renderer
  const [previewData, setPreviewData] = useState(null) // { src, origWidth }

  useEffect(() => {
    if (!file?.path) return
    let cancelled = false
    setPreviewData(null)
    generatePreview(file.path, 1600)
      .then(({ base64, origWidth }) => {
        if (!cancelled && base64) {
          setPreviewData({ src: `data:image/jpeg;base64,${base64}`, origWidth })
        }
      })
      .catch(console.error)
    return () => {
      cancelled = true
    }
  }, [file])

  useEffect(() => {
    if (!previewData || !canvasRef.current) return
    const canvas = canvasRef.current
    const ctx = canvas.getContext('2d')

    const img = new Image()
    img.src = previewData.src
    img.onload = () => {
      canvas.width = img.naturalWidth
      canvas.height = img.naturalHeight
      ctx.clearRect(0, 0, canvas.width, canvas.height)
      ctx.drawImage(img, 0, 0)

      if (!logoBase64) return

      const logo = new Image()
      logo.src = `data:image/png;base64,${logoBase64}`
      logo.onload = () => {
        const { position, tiled, tileGap, opacity, sizePercent, rotation = 0 } = settings
        const imgWidth = img.naturalWidth
        const imgHeight = img.naturalHeight

        // tileGap is authored in original-image pixels; the preview is a capped
        // render, so rescale it exactly the way the pipeline does
        const gap = scaleGap(tileGap, imgWidth, previewData.origWidth)
        const logoW = Math.round(imgWidth * sizePercent)
        const logoH = Math.round(logo.naturalHeight * (logoW / logo.naturalWidth))
        const angle = (rotation * Math.PI) / 180

        ctx.globalAlpha = opacity

        // Canvas rotates about the centre, so the slot's centre is the anchor —
        // equivalent to the pipeline centring the rotated bitmap on the slot.
        const drawAt = ({ top, left }) => {
          ctx.save()
          ctx.translate(left + logoW / 2, top + logoH / 2)
          ctx.rotate(angle)
          ctx.drawImage(logo, -logoW / 2, -logoH / 2, logoW, logoH)
          ctx.restore()
        }

        if (tiled) {
          computeTilePositions({
            imgWidth,
            imgHeight,
            tileW: logoW,
            tileH: logoH,
            gap
          }).forEach(drawAt)
        } else {
          drawAt(computeSinglePosition({ imgWidth, imgHeight, logoW, logoH, position }))
        }

        ctx.globalAlpha = 1
      }
    }
  }, [previewData, settings, logoBase64])

  return (
    <div
      className="fixed inset-0 z-50 bg-black/85 flex items-center justify-center p-6"
      onClick={onClose}
    >
      <div className="relative flex flex-col" onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className="flex items-center justify-between mb-2 px-1">
          <p className="text-wh-300 text-sm truncate max-w-xl">{file.name}</p>
          <button
            onClick={onClose}
            className="ml-6 flex items-center gap-1.5 text-wh-300 hover:text-wh-100 text-xs transition-colors"
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
                d="M6 18L18 6M6 6l12 12"
              />
            </svg>
            Close
          </button>
        </div>

        {/* Canvas */}
        {!previewData && (
          <div className="flex items-center justify-center gap-2 text-wh-300 text-sm bg-wh-850 rounded-lg px-16 py-24">
            <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
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
            Generating preview…
          </div>
        )}
        <canvas
          ref={canvasRef}
          className="block rounded-lg shadow-2xl"
          style={{
            maxWidth: '85vw',
            maxHeight: '80vh',
            objectFit: 'contain',
            display: previewData ? 'block' : 'none'
          }}
        />

        {/* No logo hint */}
        {!logoBase64 && (
          <p className="text-center text-wh-400 text-xs mt-2">
            No watermark logo set — drop a PNG in the sidebar to preview it here
          </p>
        )}
      </div>
    </div>
  )
}
