import { useState, useEffect, useCallback } from 'react'
import { storeGet, storeSet } from '../utils/ipc'

const DEFAULTS = {
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

export function useSettings() {
  const [settings, setSettings] = useState(DEFAULTS)
  const [loaded, setLoaded] = useState(false)

  useEffect(() => {
    async function load() {
      try {
        const [logoRes, watermarkRes, compressRes, modeRes] = await Promise.all([
          storeGet('logoPath'),
          storeGet('watermark'),
          storeGet('compress'),
          storeGet('lastMode')
        ])
        setSettings({
          logoPath: logoRes?.value ?? DEFAULTS.logoPath,
          watermark: watermarkRes?.value ?? DEFAULTS.watermark,
          compress: compressRes?.value ?? DEFAULTS.compress,
          lastMode: modeRes?.value ?? DEFAULTS.lastMode
        })
      } catch (err) {
        console.warn('Could not load settings from store:', err)
      } finally {
        setLoaded(true)
      }
    }
    load()
  }, [])

  const setSetting = useCallback((key, value) => {
    setSettings((prev) => ({ ...prev, [key]: value }))
    storeSet(key, value).catch(console.error)
  }, [])

  const setWatermark = useCallback((patch) => {
    setSettings((prev) => {
      const next = { ...prev.watermark, ...patch }
      storeSet('watermark', next).catch(console.error)
      return { ...prev, watermark: next }
    })
  }, [])

  const setCompress = useCallback((patch) => {
    setSettings((prev) => {
      const next = { ...prev.compress, ...patch }
      storeSet('compress', next).catch(console.error)
      return { ...prev, compress: next }
    })
  }, [])

  return { settings, loaded, setSetting, setWatermark, setCompress }
}
