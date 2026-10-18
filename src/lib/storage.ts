import { useCallback, useEffect, useState } from 'react'
import type { ExerciseId } from '../data/exercises'
import { DEFAULT_SETTINGS, type Settings, type Side } from './settings'

export interface SessionLog {
  id: string
  exerciseId: ExerciseId
  /** Local date, YYYY-MM-DD. */
  date: string
  /** Completion time, epoch ms. */
  ts: number
  sides: Side[]
  /** True when logged by hand rather than with the timer. */
  manual?: boolean
}

/** Morning first-step pain, keyed by YYYY-MM-DD. */
export type PainLog = Record<string, number>

const KEYS = { settings: 'pf.settings.v1', log: 'pf.log.v1', pain: 'pf.pain.v1' }

function read<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key)
    return raw ? (JSON.parse(raw) as T) : fallback
  } catch {
    return fallback
  }
}

function write(key: string, value: unknown) {
  try {
    localStorage.setItem(key, JSON.stringify(value))
  } catch {
    /* storage full or blocked: keep running in memory */
  }
}

// One tiny shared store so every component sees the same data.
type Listener = () => void
const listeners = new Set<Listener>()
let state = {
  settings: { ...DEFAULT_SETTINGS, ...read<Partial<Settings>>(KEYS.settings, {}) } as Settings,
  log: read<SessionLog[]>(KEYS.log, []),
  pain: read<PainLog>(KEYS.pain, {}),
}
function emit() {
  listeners.forEach((l) => l())
}

function useStore<T>(select: (s: typeof state) => T): T {
  const [, force] = useState(0)
  useEffect(() => {
    const l = () => force((n) => n + 1)
    listeners.add(l)
    return () => {
      listeners.delete(l)
    }
  }, [])
  return select(state)
}

export function useSettings(): [Settings, (patch: Partial<Settings>) => void] {
  const settings = useStore((s) => s.settings)
  const update = useCallback((patch: Partial<Settings>) => {
    state = { ...state, settings: { ...state.settings, ...patch } }
    write(KEYS.settings, state.settings)
    emit()
  }, [])
  return [settings, update]
}

export function useLog() {
  const log = useStore((s) => s.log)
  const add = useCallback((entry: Omit<SessionLog, 'id' | 'ts' | 'date'> & { date?: string }) => {
    const now = Date.now()
    const full: SessionLog = {
      id: `${now}-${Math.random().toString(36).slice(2, 8)}`,
      ts: now,
      date: entry.date ?? todayKey(),
      ...entry,
    } as SessionLog
    state = { ...state, log: [...state.log, full] }
    write(KEYS.log, state.log)
    emit()
  }, [])
  const remove = useCallback((id: string) => {
    state = { ...state, log: state.log.filter((e) => e.id !== id) }
    write(KEYS.log, state.log)
    emit()
  }, [])
  return { log, add, remove }
}

export function usePain(): [PainLog, (date: string, value: number | null) => void] {
  const pain = useStore((s) => s.pain)
  const set = useCallback((date: string, value: number | null) => {
    const next = { ...state.pain }
    if (value === null) delete next[date]
    else next[date] = value
    state = { ...state, pain: next }
    write(KEYS.pain, next)
    emit()
  }, [])
  return [pain, set]
}

export function clearAllData() {
  state = { settings: { ...DEFAULT_SETTINGS }, log: [], pain: {} }
  Object.values(KEYS).forEach((k) => {
    try {
      localStorage.removeItem(k)
    } catch {
      /* ignore */
    }
  })
  emit()
}

// ---- dates (local time) ----
export function dateKey(d: Date): string {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}
export function todayKey(): string {
  return dateKey(new Date())
}
export function parseKey(key: string): Date {
  const [y, m, d] = key.split('-').map(Number)
  return new Date(y, m - 1, d)
}
export function addDays(key: string, n: number): string {
  const d = parseKey(key)
  d.setDate(d.getDate() + n)
  return dateKey(d)
}
export function daysBetween(a: string, b: string): number {
  return Math.round((parseKey(b).getTime() - parseKey(a).getTime()) / 86400000)
}
