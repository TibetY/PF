import { useState } from 'react'
import { EXERCISE_BY_ID } from '../data/exercises'
import { discardSaved, end, isActive, loadSaved, restore, useSession, type SavedSession } from '../lib/session'
import { go } from '../lib/useHashRoute'

const fmt = (sec: number) => {
  const s = Math.max(0, Math.ceil(sec))
  return s >= 60 ? `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}` : `${s}s`
}

/** Shown on other screens while a session keeps running in the background. */
export function SessionPill() {
  const s = useSession()
  if (!s.exerciseId || !isActive(s.live.status)) return null
  const p = s.phases[s.live.index]
  const ex = EXERCISE_BY_ID[s.exerciseId]
  return (
    <div className="fixed inset-x-0 bottom-[calc(64px+env(safe-area-inset-bottom))] z-30 mx-auto max-w-xl px-3 print:hidden">
      <div className="flex items-center gap-2 rounded-2xl bg-slate-900 p-2 pl-4 text-white shadow-lg dark:bg-slate-100 dark:text-slate-900">
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold">{ex.name}</p>
          <p className="tabular truncate text-xs opacity-75">
            {s.live.status === 'paused' ? 'Paused · ' : ''}
            {p.label}
            {!p.untimed && ` · ${fmt(p.duration - s.live.elapsed)}`}
          </p>
        </div>
        <button className="min-h-[44px] rounded-xl bg-white/15 px-3 text-sm font-semibold dark:bg-slate-900/10" onClick={() => end()}>
          End
        </button>
        <button className="min-h-[44px] rounded-xl bg-brand-500 px-4 text-sm font-semibold text-white" onClick={() => go(`/exercise/${s.exerciseId}`)}>
          Return
        </button>
      </div>
    </div>
  )
}

/** After a reload: offer to pick up a session saved in the last 30 minutes. */
export function ResumePrompt() {
  const session = useSession()
  const [saved, setSaved] = useState<SavedSession | null>(() => (session.exerciseId ? null : loadSaved()))
  if (!saved || session.exerciseId) return null
  const ex = EXERCISE_BY_ID[saved.exerciseId]
  const p = saved.phases[saved.index]
  if (!ex || !p) return null
  const sets = p.sets > 1 ? ` · set ${p.set} of ${p.sets}` : ''
  const reps = p.reps > 1 && !p.untimed ? ` · rep ${p.rep} of ${p.reps}` : ''
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-slate-900/40 p-4 sm:items-center" role="dialog" aria-modal="true" aria-labelledby="resume-title">
      <div className="card w-full max-w-sm p-5">
        <p id="resume-title" className="text-lg font-bold">Resume your session?</p>
        <p className="mt-1 text-sm muted">
          {ex.name} · {p.label}
          {!p.untimed && ` · ${fmt(saved.remaining)} left`}
          {sets}
          {reps}
          {saved.phases.some((x) => x.side !== saved.side) && ` · ${saved.side} side`}
        </p>
        <p className="mt-1 text-xs muted">It resumes paused, so you can get back into position.</p>
        <div className="mt-4 grid grid-cols-2 gap-2">
          <button
            className="btn-soft"
            onClick={() => {
              discardSaved()
              setSaved(null)
            }}
          >
            Discard
          </button>
          <button
            className="btn-primary"
            onClick={() => {
              restore(saved)
              setSaved(null)
              go(`/exercise/${saved.exerciseId}`)
            }}
          >
            Resume
          </button>
        </div>
      </div>
    </div>
  )
}
