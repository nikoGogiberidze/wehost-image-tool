import React from 'react'

const FORMATS = [
  { id: 'jpeg', label: 'JPEG' },
  { id: 'png', label: 'PNG' },
  { id: 'webp', label: 'WebP' }
]

function qualityLabel(q) {
  if (q >= 90) return 'High quality'
  if (q >= 80) return 'Web optimized'
  if (q < 70) return 'Small file'
  return 'Balanced'
}

function qualityColor(q) {
  if (q >= 90) return 'text-emerald-400'
  if (q >= 80) return 'text-wh-teal'
  if (q < 70) return 'text-amber-400'
  return 'text-wh-300'
}

export default function CompressSettings({ settings, setCompress }) {
  const { format, quality, resizeEnabled, maxWidth } = settings

  return (
    <div className="flex flex-col gap-5">
      {/* Output format */}
      <div>
        <label className="block text-xs font-semibold text-wh-300 mb-2 uppercase tracking-wider">
          Output Format
        </label>
        <div className="flex gap-1.5">
          {FORMATS.map((f) => (
            <button
              key={f.id}
              onClick={() => setCompress({ format: f.id })}
              className={`
                flex-1 py-2 rounded-lg text-sm font-medium transition-all duration-150
                ${
                  format === f.id
                    ? 'bg-wh-teal text-wh-900'
                    : 'bg-wh-750 text-wh-300 hover:bg-wh-700'
                }
              `}
            >
              {f.label}
            </button>
          ))}
        </div>
      </div>

      <div className="h-px bg-wh-700" />

      {/* Quality */}
      <div>
        <div className="flex justify-between items-center mb-1.5">
          <label className="text-xs font-semibold text-wh-100 uppercase tracking-wider">
            Quality
          </label>
          <div className="flex items-center gap-1.5">
            <span className={`text-xs font-medium ${qualityColor(quality)}`}>
              {qualityLabel(quality)}
            </span>
            <span className="text-xs text-wh-100 font-mono bg-wh-750 px-1.5 py-0.5 rounded">
              {quality}
            </span>
          </div>
        </div>
        <input
          type="range"
          min={1}
          max={100}
          step={1}
          value={quality}
          onChange={(e) => setCompress({ quality: Number(e.target.value) })}
          className="w-full"
        />
        <div className="flex justify-between mt-0.5">
          <span className="text-xs text-wh-300">Smallest</span>
          <span className="text-xs text-wh-300">Best quality</span>
        </div>
      </div>

      <div className="h-px bg-wh-700" />

      {/* Resize cap */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <label className="text-xs font-semibold text-wh-100 uppercase tracking-wider">
            Max Width
          </label>
          <button
            onClick={() => setCompress({ resizeEnabled: !resizeEnabled })}
            className={`
              relative inline-flex h-5 w-9 items-center rounded-full transition-colors duration-200
              ${resizeEnabled ? 'bg-wh-teal' : 'bg-wh-700'}
            `}
          >
            <span
              className={`
                inline-block h-3.5 w-3.5 transform rounded-full bg-wh-900 transition-transform duration-200
                ${resizeEnabled ? 'translate-x-4' : 'translate-x-1'}
              `}
            />
          </button>
        </div>

        {resizeEnabled && (
          <div className="flex items-center gap-2">
            <input
              type="number"
              min={100}
              max={8000}
              step={100}
              value={maxWidth}
              onChange={(e) => setCompress({ maxWidth: Number(e.target.value) })}
              className="
                flex-1 bg-wh-750 border border-wh-700 rounded-lg
                px-3 py-2 text-sm text-wh-100
                focus:outline-none focus:border-wh-teal
              "
            />
            <span className="text-wh-200 text-sm">px</span>
          </div>
        )}

        {resizeEnabled && (
          <p className="text-xs text-wh-300 mt-1.5">Images wider than this will be resized down</p>
        )}
      </div>
    </div>
  )
}
