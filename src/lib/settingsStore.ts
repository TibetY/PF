import { useEffect, useState } from 'react'
import { DEFAULT_SETTINGS, type Settings } from './settings'

/**
 * Settings store: its own module, separate from session and log data, persisted to
 * localStorage. Changing a setting never touches session state.
 */
const KEY = 'pf.settings.v1'

function load(): Settings {
  try {
    const raw = localStorage.getItem(KEY)
    return { ...DEFAULT_SETTINGS, ...(raw ? (JSON.parse(raw) as Partial<Settings>) : {}) }
  } catch {
    return { ...DEFAULT_SETTINGS }
  }
}

let settings: Settings = load()
const listeners = new Set<() => void>()

/** Current settings, read at the moment of use (e.g. when a cue fires). */
export const getSettings = () => settings

export function subscribeSettings(l: () => void) {
  listeners.add(l)
  return () => {
    listeners.delete(l)
  }
}

export function updateSettings(patch: Partial<Settings>) {
  settings = { ...settings, ...patch }
  try {
    localStorage.setItem(KEY, JSON.stringify(settings))
  } catch {
    /* storage full or blocked: keep running in memory */
  }
  listeners.forEach((l) => l())
}

export function resetSettings() {
  settings = { ...DEFAULT_SETTINGS }
  try {
    localStorage.removeItem(KEY)
  } catch {
    /* ignore */
  }
  listeners.forEach((l) => l())
}

export function useSettings(): [Settings, (patch: Partial<Settings>) => void] {
  const [, force] = useState(0)
  useEffect(() => subscribeSettings(() => force((n) => n + 1)), [])
  return [settings, updateSettings]
}
