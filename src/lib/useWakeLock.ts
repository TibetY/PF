import { useEffect, useRef, useState } from 'react'

type Sentinel = { release: () => Promise<void>; released: boolean; addEventListener: (t: 'release', cb: () => void) => void }

/** Keeps the screen awake while `active` is true (Screen Wake Lock API; needs HTTPS on phones). */
export function useWakeLock(active: boolean) {
  const supported = typeof navigator !== 'undefined' && 'wakeLock' in navigator && window.isSecureContext
  const [locked, setLocked] = useState(false)
  const sentinel = useRef<Sentinel | null>(null)

  useEffect(() => {
    if (!supported) return
    let cancelled = false
    const acquire = async () => {
      if (!active || document.visibilityState !== 'visible') return
      if (sentinel.current && !sentinel.current.released) return
      try {
        const s = (await (navigator as unknown as { wakeLock: { request: (t: 'screen') => Promise<Sentinel> } }).wakeLock.request('screen'))
        if (cancelled) {
          void s.release()
          return
        }
        sentinel.current = s
        setLocked(true)
        s.addEventListener('release', () => setLocked(false))
      } catch {
        setLocked(false)
      }
    }
    const onVis = () => void acquire()
    if (active) void acquire()
    else if (sentinel.current) {
      void sentinel.current.release()
      sentinel.current = null
    }
    document.addEventListener('visibilitychange', onVis)
    return () => {
      cancelled = true
      document.removeEventListener('visibilitychange', onVis)
    }
  }, [active, supported])

  useEffect(
    () => () => {
      if (sentinel.current) void sentinel.current.release()
    },
    [],
  )

  return { supported, locked }
}
