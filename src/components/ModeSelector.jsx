import React from 'react'

const MODES = [
  {
    id: 'watermark',
    label: 'Watermark',
    icon: (
      <svg
        xmlns="http://www.w3.org/2000/svg"
        className="w-10 h-10"
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
    ),
    description: 'Add your logo watermark to images. Position, opacity, and tiling controls.'
  },
  {
    id: 'compress',
    label: 'Compress',
    icon: (
      <svg
        xmlns="http://www.w3.org/2000/svg"
        className="w-10 h-10"
        fill="none"
        viewBox="0 0 24 24"
        stroke="currentColor"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={1.5}
          d="M4 7v10c0 2.21 3.582 4 8 4s8-1.79 8-4V7M4 7c0 2.21 3.582 4 8 4s8-1.79 8-4M4 7c0-2.21 3.582-4 8-4s8 1.79 8 4"
        />
      </svg>
    ),
    description: 'Reduce file size with quality control. Export as JPEG, PNG, or WebP.'
  },
  {
    id: 'both',
    label: 'Both',
    icon: (
      <svg
        xmlns="http://www.w3.org/2000/svg"
        className="w-10 h-10"
        fill="none"
        viewBox="0 0 24 24"
        stroke="currentColor"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={1.5}
          d="M9 3H5a2 2 0 00-2 2v4m6-6h10a2 2 0 012 2v4M9 3v18m0 0h10a2 2 0 002-2V9M9 21H5a2 2 0 01-2-2V9m0 0h18"
        />
      </svg>
    ),
    description: 'Compress first, then watermark. Best for full production workflow.'
  }
]

export default function ModeSelector({ onSelect }) {
  return (
    <div className="flex flex-col items-center justify-center h-full bg-wh-900 px-6">
      {/* Branding */}
      <div className="mb-12 text-center">
        <div className="flex items-center justify-center gap-3 mb-3">
          {/* Wehost wordmark style */}
          <span className="text-3xl font-black tracking-widest text-wh-teal uppercase">
            WE<span className="text-wh-light">HOST</span>
          </span>
        </div>
        <p className="text-wh-300 text-sm tracking-wide">Image Tool — select a processing mode</p>
      </div>

      {/* Mode cards */}
      <div className="flex gap-5 w-full max-w-3xl">
        {MODES.map((mode) => (
          <button
            key={mode.id}
            onClick={() => onSelect(mode.id)}
            className="
              flex-1 flex flex-col items-center text-center gap-4 p-8
              bg-wh-800 border border-wh-700
              rounded-2xl cursor-pointer
              transition-all duration-200
              hover:border-wh-teal hover:bg-wh-750 hover:shadow-lg hover:shadow-wh-teal/10
              hover:-translate-y-1
              group
            "
          >
            <div className="text-wh-300 group-hover:text-wh-teal transition-colors duration-200">
              {mode.icon}
            </div>
            <div>
              <div className="text-wh-100 font-semibold text-lg mb-1">{mode.label}</div>
              <div className="text-wh-300 text-sm leading-relaxed">{mode.description}</div>
            </div>
            <div
              className="
              mt-auto px-5 py-2 rounded-lg text-sm font-medium
              bg-wh-750 text-wh-300
              group-hover:bg-wh-teal group-hover:text-wh-900
              transition-all duration-200
            "
            >
              Select
            </div>
          </button>
        ))}
      </div>

      <p className="mt-10 text-wh-400 text-xs">
        All processing is done locally — no internet required
      </p>
    </div>
  )
}
