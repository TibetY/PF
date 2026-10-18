import { useCallback, useEffect, useState } from 'react'
import type { ExerciseId } from '../data/exercises'
import { DEFAULT_SETTINGS, type Settings, type Side } from './settings'

export interface SessionLog {
  /** Generated on the device; doubles as the sync key (client_id in Supabase). */
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

/** Local changes waiting to be pushed to Supabase (kept even while signed out). */
export type SyncOp =
  | { kind: 'session-upsert'; session: SessionLog }
  | { kind: 'session-delete'; id: string }
  | { kind: 'pain-set'; date: string; rating: number }
  | { kind: 'pain-delete'; date: string }

export interface SyncStatus {
  state: 'off' | 'idle' | 'syncing' | 'error'
  lastSyncedAt: number | null
  error: string | null
}

const KEYS = { settings: 'pf.settings.v1', log: 'pf.log.v1', pain: 'pf.pain.v1', queue: 'pf.syncqueue.v1', lastSync: 'pf.lastsync.v1' }

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
const loadedSettings = read<Partial<Settings>>(KEYS.settings, {})
let state = {
  settings: { ...DEFAULT_SETTINGS, ...loadedSettings } as Settings,
  log: read<SessionLog[]>(KEYS.log, []),
  pain: read<PainLog>(KEYS.pain, {}),
  queue: read<SyncOp[]>(KEYS.queue, []),
  sync: { state: 'off', lastSyncedAt: read<number | null>(KEYS.lastSync, null), error: null } as SyncStatus,
}
type State = typeof state

function emit() {
  listeners.forEach((l) => l())
}

export function subscribe(l: Listener) {
  listeners.add(l)
  return () => {
    listeners.delete(l)
  }
}

export const getState = () => state

function useStore<T>(select: (s: State) => T): T {
  const [, force] = useState(0)
  useEffect(() => subscribe(() => force((n) => n + 1)), [])
  return select(state)
}

function enqueue(op: SyncOp) {
  state = { ...state, queue: [...state.queue, op] }
  write(KEYS.queue, state.queue)
}

export function useSettings(): [Settings, (patch: Partial<Settings>) => void] {
  const settings = useStore((s) => s.settings)
  return [settings, updateSettings]
}

export function updateSettings(patch: Partial<Settings>) {
  state = { ...state, settings: { ...state.settings, ...patch } }
  write(KEYS.settings, state.settings)
  emit()
}

export function useLog() {
  const log = useStore((s) => s.log)
  const add = useCallback((entry: Omit<SessionLog, 'id' | 'ts' | 'date'> & { date?: string }) => {
    const now = Date.now()
    const full: SessionLog = {
      id: `${now}-${Math.random().toString(36).slice(2, 10)}`,
      ts: now,
      date: entry.date ?? todayKey(),
      ...entry,
    } as SessionLog
    state = { ...state, log: [...state.log, full] }
    write(KEYS.log, state.log)
    enqueue({ kind: 'session-upsert', session: full })
    emit()
  }, [])
  const remove = useCallback((id: string) => {
    state = { ...state, log: state.log.filter((e) => e.id !== id) }
    write(KEYS.log, state.log)
    enqueue({ kind: 'session-delete', id })
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
    enqueue(value === null ? { kind: 'pain-delete', date } : { kind: 'pain-set', date, rating: value })
    emit()
  }, [])
  return [pain, set]
}

export const useSyncStatus = () => useStore((s) => ({ ...s.sync, pending: s.queue.length }))

// ---- used by the sync engine ----
export function setSyncStatus(patch: Partial<SyncStatus>) {
  state = { ...state, sync: { ...state.sync, ...patch } }
  if (patch.lastSyncedAt !== undefined) write(KEYS.lastSync, patch.lastSyncedAt)
  emit()
}
/** Drop the first `n` queued ops once they reached the server. */
export function dequeue(n: number) {
  state = { ...state, queue: state.queue.slice(n) }
  write(KEYS.queue, state.queue)
  emit()
}
/** Replace local data with the merged server copy. */
export function replaceData(log: SessionLog[], pain: PainLog) {
  state = { ...state, log, pain }
  write(KEYS.log, log)
  write(KEYS.pain, pain)
  emit()
}

/** Clears this device only; a signed-in account keeps its cloud copy. */
export function clearAllData() {
  state = { ...state, settings: { ...DEFAULT_SETTINGS }, log: [], pain: {}, queue: [] }
  ;[KEYS.settings, KEYS.log, KEYS.pain, KEYS.queue].forEach((k) => {
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
