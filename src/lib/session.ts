import { useEffect, useState } from 'react'
import type { ExerciseId } from '../data/exercises'
import { beeps, speak } from './audio'
import { isWorkPhase, type Phase } from './phases'
import type { Side } from './settings'
import { getSettings } from './settingsStore'
import { addSessionLog } from './storage'

/**
 * The exercise session engine. It lives at module level, above the router and every React
 * tree, so nothing a setting change re-renders or remounts can reset it. The phase list is
 * snapshotted when a session starts; beeps and voice read the *current* settings at the moment
 * a cue fires, so toggling them mid-stretch affects the next cue and nothing else.
 */

export type RunStatus = 'idle' | 'running' | 'paused' | 'done'

export interface LiveState {
  status: RunStatus
  index: number
  /** Seconds elapsed in the current phase. */
  elapsed: number
}

interface EngineState {
  exerciseId: ExerciseId | null
  phases: Phase[]
  status: RunStatus
  index: number
  phaseStart: number
  pausedAt: number
  lastLeft: number
  /** Reps tapped in the current self-paced set. */
  count: number
  logged: boolean
}

/** What we persist so a reload can offer to resume. */
export interface SavedSession {
  v: 1
  exerciseId: ExerciseId
  phases: Phase[]
  index: number
  side: Side
  /** Seconds left in the current phase (untimed phases: 0). */
  remaining: number
  elapsed: number
  paused: boolean
  count: number
  /** Epoch ms when saved. */
  ts: number
}

export const SAVE_KEY = 'stretcher.session.v1'
export const SAVE_MAX_AGE_MS = 30 * 60 * 1000

const IDLE: EngineState = { exerciseId: null, phases: [], status: 'idle', index: 0, phaseStart: 0, pausedAt: 0, lastLeft: -1, count: 0, logged: false }
let s: EngineState = { ...IDLE }
const listeners = new Set<() => void>()
let timer: ReturnType<typeof setInterval> | undefined
let lastSave = 0

const now = () => performance.now()
const emit = () => listeners.forEach((l) => l())

export function live(): LiveState {
  const t = s.status === 'running' ? now() : s.pausedAt
  return { status: s.status, index: s.index, elapsed: s.status === 'idle' ? 0 : Math.max(0, (t - s.phaseStart) / 1000) }
}

export const getEngine = () => s

// ---------- cues (read settings at the moment they fire) ----------
function cuePhase(p: Phase) {
  const st = getSettings()
  if (st.beeps) (isWorkPhase(p.kind) ? beeps.work : beeps.rest)()
  if (st.voice) speak(p.cue)
}
function cueCountdown(p: Phase) {
  if (getSettings().beeps && !(p.kind === 'up' || p.kind === 'top' || p.kind === 'down')) beeps.tick()
}
function cueDone() {
  const st = getSettings()
  if (st.beeps) beeps.done()
  if (st.voice) speak('Session complete. Nice work.')
}

// ---------- core ----------
function enter(index: number, at: number) {
  s.index = index
  s.phaseStart = at
  s.lastLeft = -1
  s.count = 0
  if (index >= s.phases.length) {
    s.status = 'done'
    s.index = s.phases.length - 1
    s.pausedAt = at
    cueDone()
    if (!s.logged && s.exerciseId) {
      s.logged = true
      addSessionLog({ exerciseId: s.exerciseId, sides: Array.from(new Set(s.phases.map((p) => p.side))) })
    }
    clearSaved()
  } else {
    cuePhase(s.phases[index])
  }
}

function step() {
  if (s.status !== 'running') return
  const t = now()
  // catch up on phases that ended while the tab was in the background
  let guard = 0
  while (s.status === 'running' && guard++ < 1000) {
    const p = s.phases[s.index]
    if (p.untimed) break
    const end = s.phaseStart + p.duration * 1000
    if (t < end) break
    enter(s.index + 1, end)
  }
  if (s.status !== 'running') return
  const p = s.phases[s.index]
  if (p.untimed) return
  const left = Math.ceil(p.duration - (t - s.phaseStart) / 1000)
  if (left !== s.lastLeft) {
    s.lastLeft = left
    if (left <= 3 && left >= 1 && p.duration >= 5) cueCountdown(p)
  }
}

function ensureTimer() {
  if (timer) return
  timer = setInterval(() => {
    if (s.status !== 'running') {
      clearInterval(timer)
      timer = undefined
      return
    }
    step()
    const t = Date.now()
    if (t - lastSave > 1000 || t < lastSave) save() // also save if the clock moved backwards
    emit()
  }, 100)
}

function changed() {
  save()
  ensureTimer()
  emit()
}

// ---------- actions ----------
export function start(exerciseId: ExerciseId, phases: Phase[]) {
  s = { ...IDLE, exerciseId, phases, status: 'running' }
  enter(0, now())
  changed()
}

export function pause() {
  if (s.status !== 'running') return
  s.status = 'paused'
  s.pausedAt = now()
  changed()
}

export function resume() {
  if (s.status !== 'paused') return
  s.phaseStart += now() - s.pausedAt
  s.status = 'running'
  changed()
}

export function skip() {
  if (s.status !== 'running' && s.status !== 'paused') return
  const wasPaused = s.status === 'paused'
  const t = now()
  s.status = 'running'
  enter(s.index + 1, t)
  if (wasPaused && s.status === 'running') {
    s.status = 'paused'
    s.pausedAt = t
  }
  changed()
}

/** Count one self-paced rep; the set ends automatically at its target. */
export function tapRep() {
  const p = s.phases[s.index]
  if (s.status !== 'running' || !p?.untimed) return
  s.count += 1
  const st = getSettings()
  if (st.voice) speak(String(s.count))
  else if (st.beeps) beeps.tick()
  const at = s.index
  if (s.count >= p.reps) setTimeout(() => s.index === at && skip(), 450)
  changed()
}

/** Stop and forget the current session. */
export function end() {
  s = { ...IDLE }
  if (timer) clearInterval(timer)
  timer = undefined
  clearSaved()
  try {
    window.speechSynthesis?.cancel()
  } catch {
    /* ignore */
  }
  emit()
}

// ---------- persistence ----------
function save() {
  lastSave = Date.now()
  if ((s.status !== 'running' && s.status !== 'paused') || !s.exerciseId) return
  const p = s.phases[s.index]
  const l = live()
  const data: SavedSession = {
    v: 1,
    exerciseId: s.exerciseId,
    phases: s.phases,
    index: s.index,
    side: p.side,
    remaining: p.untimed ? 0 : Math.max(0, p.duration - l.elapsed),
    elapsed: l.elapsed,
    paused: s.status === 'paused',
    count: s.count,
    ts: Date.now(),
  }
  try {
    localStorage.setItem(SAVE_KEY, JSON.stringify(data))
  } catch {
    /* ignore */
  }
}

function clearSaved() {
  try {
    localStorage.removeItem(SAVE_KEY)
  } catch {
    /* ignore */
  }
}

/** A saved session from before a reload, if it's recent enough to resume. */
export function loadSaved(): SavedSession | null {
  try {
    const raw = localStorage.getItem(SAVE_KEY)
    if (!raw) return null
    const data = JSON.parse(raw) as SavedSession
    if (data.v !== 1 || !Array.isArray(data.phases) || !data.phases[data.index] || Date.now() - data.ts > SAVE_MAX_AGE_MS) {
      clearSaved()
      return null
    }
    return data
  } catch {
    clearSaved()
    return null
  }
}

export const discardSaved = clearSaved

/** Restore a saved session, paused at exactly where it was, so you can get back into position. */
export function restore(data: SavedSession) {
  const t = now()
  const p = data.phases[data.index]
  const elapsed = p.untimed ? data.elapsed : Math.max(0, p.duration - data.remaining)
  s = {
    exerciseId: data.exerciseId, phases: data.phases, status: 'paused', index: data.index,
    phaseStart: t - elapsed * 1000, pausedAt: t, lastLeft: -1, count: data.count, logged: false,
  }
  changed()
}

// ---------- React binding ----------
export function useSession() {
  const [, force] = useState(0)
  useEffect(() => {
    const l = () => force((n) => (n + 1) % 1e9)
    listeners.add(l)
    return () => {
      listeners.delete(l)
    }
  }, [])
  return { ...s, live: live() }
}

export const isActive = (st: RunStatus) => st === 'running' || st === 'paused'

/** Re-renders only when the run status changes (not on every timer tick). */
export function useSessionStatus(): RunStatus {
  const [status, setStatus] = useState(s.status)
  useEffect(() => {
    const l = () => setStatus(s.status)
    listeners.add(l)
    return () => {
      listeners.delete(l)
    }
  }, [])
  return status
}
