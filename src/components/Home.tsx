import { EXERCISES, type Exercise } from '../data/exercises'
import { dayCompletion, isDueNow, statusFor, streak, type DueStatus } from '../lib/plan'
import { go } from '../lib/useHashRoute'
import { parseKey, todayKey, useLog, useSettings } from '../lib/storage'
import { IconCheck, IconFlame } from './Icons'
import PainPicker from './PainPicker'

const fmtDay = (key: string) => parseKey(key).toLocaleDateString(undefined, { weekday: 'long', month: 'short', day: 'numeric' })

export default function Home() {
  const { log } = useLog()
  const [settings] = useSettings()
  const today = todayKey()
  const rows = EXERCISES.map((ex) => ({ ex, status: statusFor(log, ex.id, today) }))

  const scheduled = rows.filter((r) => r.status.kind === 'daily' || r.status.kind === 'alt-due' || r.status.kind === 'alt-done')
  const routine = scheduled.filter((r) => r.ex.group === 'routine')
  const physio = scheduled.filter((r) => r.ex.group === 'physio')
  const restDay = rows.filter((r) => r.status.kind === 'alt-rest')
  const beforeRun = rows.filter((r) => r.ex.frequency === 'before-run')
  const asNeeded = rows.filter((r) => r.ex.frequency === 'after-activity')

  let done = 0
  let total = 0
  for (const { status } of scheduled) {
    if (status.kind === 'daily') {
      total += status.target
      done += Math.min(status.done, status.target)
    } else {
      total += 1
      done += status.kind === 'alt-done' ? 1 : 0
    }
  }
  const fullStreak = streak(today, (d) => dayCompletion(log, d) === 'full')
  const footLabel = settings.foot === 'both' ? 'Both feet' : settings.foot === 'left' ? 'Left foot' : 'Right foot'

  return (
    <div className="space-y-5">
      <header className="flex items-end justify-between pt-2">
        <div>
          <p className="muted text-sm">{fmtDay(today)}</p>
          <h1 className="text-2xl font-bold tracking-tight">Today's routine</h1>
        </div>
        <button onClick={() => go('/settings')} className="pill bg-brand-50 py-1.5 text-brand-700 dark:bg-brand-900/40 dark:text-brand-200">
          {footLabel}
        </button>
      </header>

      <section className="card p-4">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-medium muted">Sessions done</p>
            <p className="tabular text-3xl font-bold">
              {done}
              <span className="text-lg font-semibold muted"> / {total}</span>
            </p>
          </div>
          <div className="flex items-center gap-1.5 rounded-xl bg-accent-400/15 px-3 py-2 text-accent-600 dark:text-accent-400">
            <IconFlame width={20} height={20} />
            <span className="tabular text-lg font-bold">{fullStreak}</span>
            <span className="text-xs font-medium">day streak</span>
          </div>
        </div>
        <div className="mt-3 h-2.5 overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800" role="progressbar" aria-valuenow={done} aria-valuemax={total}>
          <div className="h-full rounded-full bg-brand-500 transition-all" style={{ width: `${total ? (done / total) * 100 : 0}%` }} />
        </div>
      </section>

      <PainPicker date={today} />

      <Group title="Plantar fasciitis routine" rows={routine} />
      <Group title="Physio program" rows={physio} />
      <Group title="Before you run" rows={beforeRun} />
      <Group title="After activity" rows={asNeeded} />

      <Group title="Not due today" rows={restDay} />
    </div>
  )
}

function Group({ title, rows }: { title: string; rows: { ex: Exercise; status: DueStatus }[] }) {
  if (rows.length === 0) return null
  return (
    <section className="space-y-3">
      <h2 className="px-1 text-sm font-semibold uppercase tracking-wide muted">{title}</h2>
      {rows.map(({ ex, status }) => (
        <ExerciseRow key={ex.id} ex={ex} status={status} />
      ))}
    </section>
  )
}

function ExerciseRow({ ex, status }: { ex: Exercise; status: DueStatus }) {
  const due = isDueNow(status)
  const complete = (status.kind === 'daily' && status.done >= status.target) || status.kind === 'alt-done'
  const resting = status.kind === 'alt-rest'

  let badge: React.ReactNode
  if (status.kind === 'daily') {
    badge = (
      <div className="flex items-center gap-2">
        <div className="flex gap-1" aria-hidden>
          {Array.from({ length: status.target }, (_, i) => (
            <span key={i} className={`h-2.5 w-2.5 rounded-full ${i < status.done ? 'bg-brand-500' : 'bg-slate-200 dark:bg-slate-700'}`} />
          ))}
        </div>
        <span className="tabular text-sm font-semibold">
          {Math.min(status.done, status.target)}/{status.target} done
        </span>
      </div>
    )
  } else if (status.kind === 'alt-due') {
    badge = <span className="pill bg-accent-400/20 text-accent-600 dark:text-accent-400">Due today</span>
  } else if (status.kind === 'alt-done') {
    badge = <span className="pill bg-brand-100 text-brand-700 dark:bg-brand-900/50 dark:text-brand-200">Done today</span>
  } else if (status.kind === 'alt-rest') {
    const next = parseKey(status.nextDate).toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' })
    badge = <span className="text-sm muted">Rest day · next on {next}</span>
  } else {
    badge = <span className="text-sm muted">{status.done > 0 ? `${status.done} done today` : 'Optional'}</span>
  }

  const morningHint = ex.id === 'pf-stretch' && status.kind === 'daily' && status.done === 0

  return (
    <button
      onClick={() => go(`/exercise/${ex.id}`)}
      className={`card flex w-full items-center gap-3 p-4 text-left transition active:scale-[0.99] ${resting ? 'opacity-70' : ''}`}
    >
      <div
        className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl ${
          complete ? 'bg-brand-500 text-white' : due ? 'bg-accent-400/20 text-accent-600 dark:text-accent-400' : 'bg-slate-100 text-slate-500 dark:bg-slate-800'
        }`}
      >
        {complete ? <IconCheck /> : <ExerciseGlyph id={ex.id} />}
      </div>
      <div className="min-w-0 flex-1">
        <p className="font-semibold leading-tight">{ex.name}</p>
        <p className="mt-0.5 text-sm muted">
          {ex.dosage} · {ex.frequencyLabel}
        </p>
        <div className="mt-2">{badge}</div>
        {morningHint && <p className="mt-2 text-xs font-medium text-brand-700 dark:text-brand-300">First session: before getting out of bed.</p>}
      </div>
      <span className="text-2xl muted" aria-hidden>
        ›
      </span>
    </button>
  )
}

function ExerciseGlyph({ id }: { id: string }) {
  const p = { width: 22, height: 22, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: 2, strokeLinecap: 'round' as const }
  switch (id) {
    case 'pf-stretch':
      return <svg {...p}><path d="M4 17c3 0 6-1 9-1l5-5" /><path d="M18 11l2-4" /><path d="M6 17c1 2 4 2 7 1" /></svg>
    case 'heel-raise':
      return <svg {...p}><path d="M12 3v8" /><path d="M9 6l3-3 3 3" /><path d="M5 21h14M8 21l2-6h6" /></svg>
    case 'step-down':
      return <svg {...p}><path d="M3 20h8v-6h10" /><path d="M14 14V5M14 9l-3 4" /></svg>
    case 'balance-eyes-closed':
      return <svg {...p}><path d="M12 3v11M12 14l-1 7M12 9l3 4" /><path d="M8 5c1.5 1 6.5 1 8 0" /></svg>
    case 'side-plank-abduction':
      return <svg {...p}><path d="M3 20h18M5 17l12-5M17 12l3-6" /></svg>
    case 'posterior-lunge':
      return <svg {...p}><path d="M12 3v8l4 4v6M12 11l-6 5-3 2" /></svg>
    case 'inversion-band':
      return <svg {...p}><path d="M6 4v10l6 2 5-2" /><path d="M12 16l2 5" strokeDasharray="2 2" /></svg>
    case 'intrinsic-foot':
      return <svg {...p}><path d="M3 18h18" /><path d="M5 18c2-6 10-6 14 0" /></svg>
    case 'ice':
      return <svg {...p}><path d="M12 2v20M4 7l16 10M20 7L4 17" /></svg>
    default:
      return <svg {...p}><path d="M4 21V3M8 21l6-9 2-6" /><path d="M14 12l3 9" /></svg>
  }
}
