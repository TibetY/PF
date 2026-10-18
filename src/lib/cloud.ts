import { useEffect, useState } from 'react'
import type { Session } from '@supabase/supabase-js'
import type { ExerciseId } from '../data/exercises'
import { DEFAULT_SETTINGS, type Settings } from './settings'
import { supabase, type Profile } from './supabase'
import {
  dequeue, getState, replaceData, setSyncStatus, subscribe, updateSettings,
  type PainLog, type SessionLog, type SyncOp,
} from './storage'

/**
 * Offline-first sync. The device's localStorage is what the UI reads; every change is also
 * queued. While signed in, the queue is pushed to Supabase and the server copy is pulled back,
 * so the same history shows on every device.
 */

// ---------- auth state (shared) ----------
type AuthState = { session: Session | null; ready: boolean; recovering: boolean }
let auth: AuthState = { session: null, ready: !supabase, recovering: false }
const authListeners = new Set<() => void>()
const setAuth = (patch: Partial<AuthState>) => {
  auth = { ...auth, ...patch }
  authListeners.forEach((l) => l())
}

export function useAuth() {
  const [, force] = useState(0)
  useEffect(() => {
    const l = () => force((n) => n + 1)
    authListeners.add(l)
    return () => {
      authListeners.delete(l)
    }
  }, [])
  return auth
}

let started = false
/** Call once at app start. */
export function startCloud() {
  if (!supabase || started) return
  started = true
  setSyncStatus({ state: 'idle' })
  void supabase.auth.getSession().then(({ data }) => {
    setAuth({ session: data.session, ready: true })
    if (data.session) void fullSync()
  })
  supabase.auth.onAuthStateChange((event, session) => {
    const wasSignedIn = !!auth.session
    setAuth({ session, ready: true, recovering: event === 'PASSWORD_RECOVERY' ? true : auth.recovering })
    if (session && !wasSignedIn) void fullSync()
  })
  // push queued changes shortly after they happen, and when the network comes back
  let timer: number | undefined
  let lastLen = getState().queue.length
  subscribe(() => {
    const len = getState().queue.length
    if (len > lastLen && auth.session) {
      window.clearTimeout(timer)
      timer = window.setTimeout(() => void flush(), 800)
    }
    lastLen = len
  })
  window.addEventListener('online', () => auth.session && void fullSync())
  // keep profile.settings in step with local settings
  let settingsTimer: number | undefined
  let lastSettings = JSON.stringify(getState().settings)
  subscribe(() => {
    const now = JSON.stringify(getState().settings)
    if (now === lastSettings) return
    lastSettings = now
    if (!auth.session || applyingRemoteSettings) return
    window.clearTimeout(settingsTimer)
    settingsTimer = window.setTimeout(() => void pushSettings(), 1500)
  })
}

// ---------- push ----------
async function runOp(op: SyncOp, userId: string) {
  const db = supabase!
  if (op.kind === 'session-upsert') {
    const s = op.session
    const { error } = await db.from('exercise_sessions').upsert(
      {
        user_id: userId, client_id: s.id, exercise_id: s.exerciseId, session_date: s.date,
        completed_at: new Date(s.ts).toISOString(), sides: s.sides, manual: !!s.manual,
      },
      { onConflict: 'user_id,client_id' },
    )
    if (error) throw error
  } else if (op.kind === 'session-delete') {
    const { error } = await db.from('exercise_sessions').delete().eq('client_id', op.id)
    if (error) throw error
  } else if (op.kind === 'pain-set') {
    const { error } = await db.from('pain_ratings').upsert({ user_id: userId, rating_date: op.date, rating: op.rating }, { onConflict: 'user_id,rating_date' })
    if (error) throw error
  } else {
    const { error } = await db.from('pain_ratings').delete().eq('rating_date', op.date)
    if (error) throw error
  }
}

let flushing: Promise<void> | null = null
export function flush(): Promise<void> {
  if (!supabase || !auth.session) return Promise.resolve()
  if (flushing) return flushing
  const userId = auth.session.user.id
  flushing = (async () => {
    setSyncStatus({ state: 'syncing', error: null })
    try {
      // ops are pushed in order; stop at the first failure and keep the rest queued
      while (getState().queue.length) {
        await runOp(getState().queue[0], userId)
        dequeue(1)
      }
      setSyncStatus({ state: 'idle', lastSyncedAt: Date.now() })
    } catch (e) {
      setSyncStatus({ state: 'error', error: e instanceof Error ? e.message : String(e) })
    } finally {
      flushing = null
    }
  })()
  return flushing
}

// ---------- pull ----------
async function pull() {
  const db = supabase!
  const [sessions, pains] = await Promise.all([
    db.from('exercise_sessions').select('client_id, exercise_id, session_date, completed_at, sides, manual').order('completed_at'),
    db.from('pain_ratings').select('rating_date, rating'),
  ])
  if (sessions.error) throw sessions.error
  if (pains.error) throw pains.error
  const log: SessionLog[] = sessions.data.map((r) => ({
    id: r.client_id as string,
    exerciseId: r.exercise_id as ExerciseId,
    date: r.session_date as string,
    ts: Date.parse(r.completed_at as string),
    sides: (r.sides as SessionLog['sides']) ?? [],
    manual: (r.manual as boolean) || undefined,
  }))
  const pain: PainLog = {}
  for (const r of pains.data) pain[r.rating_date as string] = r.rating as number
  // anything still queued (failed push) wins over the server copy
  for (const op of getState().queue) {
    if (op.kind === 'session-upsert' && !log.some((l) => l.id === op.session.id)) log.push(op.session)
    if (op.kind === 'session-delete') log.splice(0, log.length, ...log.filter((l) => l.id !== op.id))
    if (op.kind === 'pain-set') pain[op.date] = op.rating
    if (op.kind === 'pain-delete') delete pain[op.date]
  }
  replaceData(log, pain)
}

let applyingRemoteSettings = false
async function pullSettings() {
  const profile = await loadProfile()
  if (!profile) return
  const remote = profile.settings as Partial<Settings>
  if (remote && Object.keys(remote).length) {
    applyingRemoteSettings = true
    updateSettings({ ...DEFAULT_SETTINGS, ...remote, foot: profile.affected_foot })
    applyingRemoteSettings = false
  } else {
    await pushSettings()
  }
}

async function pushSettings() {
  if (!supabase || !auth.session) return
  const s = getState().settings
  await supabase.from('profiles').update({ settings: s, affected_foot: s.foot }).eq('id', auth.session.user.id)
}

/** Push local changes, then pull the full server copy. */
export async function fullSync() {
  if (!supabase || !auth.session) return
  await flush()
  if (getState().sync.state === 'error') return
  setSyncStatus({ state: 'syncing' })
  try {
    await Promise.all([pull(), pullSettings()])
    setSyncStatus({ state: 'idle', lastSyncedAt: Date.now(), error: null })
  } catch (e) {
    setSyncStatus({ state: 'error', error: e instanceof Error ? e.message : String(e) })
  }
}

// ---------- profile ----------
export async function loadProfile(): Promise<Profile | null> {
  if (!supabase || !auth.session) return null
  const { data, error } = await supabase.from('profiles').select('*').eq('id', auth.session.user.id).maybeSingle()
  if (error) throw error
  return data as Profile | null
}

export async function saveProfile(patch: Partial<Omit<Profile, 'id'>>) {
  if (!supabase || !auth.session) throw new Error('Not signed in')
  const { error } = await supabase.from('profiles').upsert({ id: auth.session.user.id, ...patch })
  if (error) throw error
}

export function useProfile() {
  const { session } = useAuth()
  const [profile, setProfile] = useState<Profile | null>(null)
  const [error, setError] = useState<string | null>(null)
  useEffect(() => {
    if (!session) {
      setProfile(null)
      return
    }
    let live = true
    loadProfile()
      .then((p) => live && setProfile(p))
      .catch((e) => live && setError(e instanceof Error ? e.message : String(e)))
    return () => {
      live = false
    }
  }, [session])
  return { profile, setProfile, error }
}

// ---------- auth actions ----------
const redirectTo = () => window.location.origin + window.location.pathname
export async function signUp(email: string, password: string, displayName: string) {
  const { data, error } = await supabase!.auth.signUp({ email, password, options: { data: { display_name: displayName }, emailRedirectTo: redirectTo() } })
  if (error) throw error
  return { needsConfirmation: !data.session }
}
export async function signIn(email: string, password: string) {
  const { error } = await supabase!.auth.signInWithPassword({ email, password })
  if (error) throw error
}
export async function signOut() {
  await supabase!.auth.signOut()
  setSyncStatus({ state: 'idle' })
}
export async function sendPasswordReset(email: string) {
  const { error } = await supabase!.auth.resetPasswordForEmail(email, { redirectTo: redirectTo() })
  if (error) throw error
}
export async function setNewPassword(password: string) {
  const { error } = await supabase!.auth.updateUser({ password })
  if (error) throw error
  setAuth({ recovering: false })
}
