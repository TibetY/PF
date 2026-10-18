import { useEffect, useState } from 'react'
import type { Theme } from './settings'

/** Applies the theme to <html> and returns whether dark mode is active. */
export function useTheme(theme: Theme) {
  const [systemDark, setSystemDark] = useState(() => window.matchMedia('(prefers-color-scheme: dark)').matches)
  useEffect(() => {
    const mq = window.matchMedia('(prefers-color-scheme: dark)')
    const on = (e: MediaQueryListEvent) => setSystemDark(e.matches)
    mq.addEventListener('change', on)
    return () => mq.removeEventListener('change', on)
  }, [])
  const dark = theme === 'dark' || (theme === 'system' && systemDark)
  useEffect(() => {
    document.documentElement.classList.toggle('dark', dark)
    document.querySelectorAll('meta[name="theme-color"]').forEach((m) => m.setAttribute('content', dark ? '#0f1419' : '#f6f7f9'))
  }, [dark])
  return dark
}
