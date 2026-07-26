import React from 'react'
import LogoDrop from './LogoDrop'

const POSITIONS = [
  { id: 'northwest', label: '↖' },
  { id: 'north', label: '↑' },
  { id: 'northeast', label: '↗' },
  { id: 'west', label: '←' },
  { id: 'center', label: '·' },
  { id: 'east', label: '→' },
  { id: 'southwest', label: '↙' },
  { id: 'south', label: '↓' },
  { id: 'southeast', label: '↘' }
]

export default function WatermarkSettings({ settings, logoPath, setWatermark, onLogoSaved }) {
  const { position, tiled, tileGap, opacity, sizePercent, rotation = 0 } = settings

  return (
    <div className="flex flex-col gap-5">
      <LogoDrop logoPath={logoPath} onLogoSaved={onLogoSaved} />

      <div className="h-px bg-wh-700" />

      {/* Position picker */}
      <div>
        <label className="block text-xs font-semibold text-wh-100 mb-2 uppercase tracking-wider">
          Position
        </label>
        <div className="grid grid-cols-3 gap-1.5 w-fit">
          {POSITIONS.map((pos) => (
            <button
              key={pos.id}
              onClick={() => setWatermark({ position: pos.id })}
              title={pos.id}
              className={`
                w-9 h-9 rounded-lg text-base font-medium transition-all duration-150
                ${
                  position === pos.id
                    ? 'bg-wh-teal text-wh-900 shadow-md shadow-wh-teal/30'
                    : 'bg-wh-750 text-wh-300 hover:bg-wh-700 hover:text-wh-100'
                }
              `}
            >
              {pos.label}
            </button>
          ))}
        </div>
      </div>

      <div className="h-px bg-wh-700" />

      {/* Tile mode toggle */}
      <div>
        <label className="block text-xs font-semibold text-wh-100 mb-2 uppercase tracking-wider">
          Mode
        </label>
        <div className="flex gap-2">
          {['corner', 'tiled'].map((m) => (
            <button
              key={m}
              onClick={() => setWatermark({ tiled: m === 'tiled' })}
              className={`
                flex-1 py-2 rounded-lg text-sm font-medium capitalize transition-all duration-150
                ${
                  (m === 'tiled') === tiled
                    ? 'bg-wh-teal text-wh-900'
                    : 'bg-wh-750 text-wh-300 hover:bg-wh-700'
                }
              `}
            >
              {m}
            </button>
          ))}
        </div>

        {tiled && (
          <div className="mt-3">
            <div className="flex justify-between mb-1.5">
              <span className="text-xs text-wh-200">Tile gap</span>
              <span className="text-xs text-wh-100 font-mono">{tileGap}px</span>
            </div>
            <input
              type="range"
              min={50}
              max={1000}
              step={10}
              value={tileGap}
              onChange={(e) => setWatermark({ tileGap: Number(e.target.value) })}
              className="w-full"
            />
            <div className="flex justify-between mt-0.5">
              <span className="text-xs text-wh-200">Dense</span>
              <span className="text-xs text-wh-200">Sparse</span>
            </div>
          </div>
        )}
      </div>

      <div className="h-px bg-wh-700" />

      {/* Opacity */}
      <div>
        <div className="flex justify-between mb-1.5">
          <label className="text-xs font-semibold text-wh-300 uppercase tracking-wider">
            Opacity
          </label>
          <span className="text-xs text-wh-100 font-mono">{Math.round(opacity * 100)}%</span>
        </div>
        <input
          type="range"
          min={0}
          max={100}
          step={1}
          value={Math.round(opacity * 100)}
          onChange={(e) => setWatermark({ opacity: Number(e.target.value) / 100 })}
          className="w-full"
        />
        <div className="flex justify-between mt-0.5">
          <span className="text-xs text-wh-200">Invisible</span>
          <span className="text-xs text-wh-200">Opaque</span>
        </div>
      </div>

      <div className="h-px bg-wh-700" />

      {/* Rotation */}
      <div>
        <div className="flex justify-between mb-2">
          <label className="text-xs font-semibold text-wh-300 uppercase tracking-wider">
            Rotation
          </label>
          <span className="text-xs text-wh-100 font-mono">{rotation}°</span>
        </div>
        <div className="flex gap-1.5 mb-3">
          {[
            { label: '—', value: 0, title: 'Horizontal' },
            { label: '⟋', value: -45, title: 'Diagonal /' },
            { label: '|', value: 90, title: 'Vertical' },
            { label: '⟍', value: 45, title: 'Diagonal \\' }
          ].map(({ label, value, title }) => (
            <button
              key={value}
              onClick={() => setWatermark({ rotation: value })}
              title={title}
              className={`
                flex-1 py-2 rounded-lg text-sm font-bold transition-all duration-150
                ${
                  rotation === value
                    ? 'bg-wh-teal text-wh-900 shadow-md shadow-wh-teal/30'
                    : 'bg-wh-750 text-wh-300 hover:bg-wh-700 hover:text-wh-100'
                }
              `}
            >
              {label}
            </button>
          ))}
        </div>
        <input
          type="range"
          min={-180}
          max={180}
          step={1}
          value={rotation}
          onChange={(e) => setWatermark({ rotation: Number(e.target.value) })}
          className="w-full"
        />
        <div className="flex justify-between mt-0.5">
          <span className="text-xs text-wh-200">-180°</span>
          <span className="text-xs text-wh-200">180°</span>
        </div>
      </div>

      <div className="h-px bg-wh-700" />

      {/* Size */}
      <div>
        <div className="flex justify-between mb-1.5">
          <label className="text-xs font-semibold text-wh-300 uppercase tracking-wider">
            Logo size
          </label>
          <span className="text-xs text-wh-100 font-mono">
            {Math.round(sizePercent * 100)}% width
          </span>
        </div>
        <input
          type="range"
          min={5}
          max={40}
          step={1}
          value={Math.round(sizePercent * 100)}
          onChange={(e) => setWatermark({ sizePercent: Number(e.target.value) / 100 })}
          className="w-full"
        />
        <div className="flex justify-between mt-0.5">
          <span className="text-xs text-wh-200">Small</span>
          <span className="text-xs text-wh-200">Large</span>
        </div>
      </div>
    </div>
  )
}
