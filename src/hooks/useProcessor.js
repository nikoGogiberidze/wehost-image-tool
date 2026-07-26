import { useState, useCallback, useRef } from 'react'

export function useProcessor() {
  const [processing, setProcessing] = useState(false)
  const [done, setDone] = useState(false)
  const [progress, setProgress] = useState([]) // array of per-image status objects
  const unsubRef = useRef(null)

  const start = useCallback(
    async ({ files, mode, watermarkSettings, compressSettings, outputFolder }) => {
      setProcessing(true)
      setDone(false)

      // Init progress rows as queued
      const initial = files.map((f, i) => ({
        index: i,
        filename: f.name,
        inputSize: f.size,
        outputSize: null,
        status: 'queued'
      }))
      setProgress(initial)

      // Subscribe to progress events
      if (unsubRef.current) unsubRef.current()
      unsubRef.current = window.electronAPI.onProgress((data) => {
        setProgress((prev) => {
          const next = [...prev]
          next[data.index] = { ...next[data.index], ...data }
          return next
        })
      })

      try {
        // Send disk paths only — the main process reads each file itself and
        // writes results straight to the output folder as they finish
        const payload = {
          files: files.map((f) => ({ name: f.name, size: f.size, path: f.path })),
          mode,
          watermarkSettings,
          compressSettings,
          outputFolder
        }
        const response = await window.electronAPI.processImages(payload)
        if (response?.results) {
          // Reconcile against the returned results, which are authoritative.
          // Progress events and the invoke reply travel on separate IPC channels,
          // so a batch that fails fast (e.g. no logo set) can have its reply
          // arrive first — the listener is then torn down below before the
          // per-file events land, leaving every row stuck on "Queued" with the
          // reason never shown to the user.
          setProgress((prev) =>
            prev.map((row, i) => {
              const result = response.results[i]
              if (!result) return row
              return result.error
                ? { ...row, status: 'error', error: result.error }
                : {
                    ...row,
                    status: 'done',
                    outputName: result.name,
                    outputSize: result.outputSize ?? row.outputSize
                  }
            })
          )
        }
      } catch (err) {
        console.error('Processing error:', err)
      } finally {
        if (unsubRef.current) {
          unsubRef.current()
          unsubRef.current = null
        }
        setProcessing(false)
        setDone(true)
      }
    },
    []
  )

  const reset = useCallback(() => {
    setProcessing(false)
    setDone(false)
    setProgress([])
  }, [])

  return { processing, done, progress, start, reset }
}
