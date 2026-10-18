import { useState } from 'react'
import { EXERCISE_BY_ID } from '../data/exercises'
import { dayCompletion, streak } from '../lib/plan'
import { dateKey, parseKey, todayKey, useLog, usePain } from '../lib/storage'
import { adherenceByDay, correlations, dayRange, painStats } from '../lib/analytics'
import { go } from '../lib/useHashRoute'
import { AdherenceBars, CorrelationList, ExerciseHeatmap, PainTrend } from './charts'
import RangePicker, { rangeStart, type RangeKey } from './RangePicker'

export default function History() {
  const { log, remove } = useLog()
  const [pain] = usePain()
  const today = todayKey()
  const [range, setRange] = useState<RangeKey>('30')
  const days = dayRange(rangeStart(range, today, log, pain), today)
  const adherence = adherenceByDay(log, days)
  const stats = painStats(pain, days)
  const corr = correlations(log, pain, days)
  const [month, setMonth] = useState(() => {
    const d = new Date()
    return new Date(d.getFullYear(), d.getMonth(), 1)
  })

  const fullStreak = streak(today, (d) => dayCompletion(log, d) === 'full')
  const activeStreak = streak(today, (d) => dayCompletion(log, d) !== 'none')
  const activeDays = new Set(log.map((e) => e.date)).size

  // calendar grid, weeks start on Monday
  const first = new Date(month)
  const lead = (first.getDay() + 6) % 7
  const daysInMonth = new Date(month.getFullYear(), month.getMonth() + 1, 0).getDate()
  const cells: (string | null)[] = [
    ...Array.from({ length: lead }, () => null),
    ...Array.from({ length: daysInMonth }, (_, i) => dateKey(new Date(month.getFullYear(), month.getMonth(), i + 1))),
  ]
  const [showAll, setShowAll] = useState(false)
  const sorted = [...log].sort((a, b) => b.ts - a.ts)
  const recent = showAll ? sorted : sorted.slice(0, 8)

  return (
    <div className="space-y-5">
      <div className="flex items-end justify-between pt-2">
        <h1 className="text-2xl font-bold tracking-tight">Progress</h1>
        <button className="btn-primary min-h-[44px] text-sm" onClick={() => go('/report')}>
          Report
        </button>
      </div>

      <section className="grid grid-cols-3 gap-3">
        <Stat value={fullStreak} label="Full-routine streak" />
        <Stat value={activeStreak} label="Active-day streak" />
        <Stat value={activeDays} label="Days logged" />
      </section>

      <section className="card p-4">
        <div className="flex items-center justify-between">
          <button className="btn-soft h-11 w-11 min-h-0 p-0" onClick={() => setMonth(new Date(month.getFullYear(), month.getMonth() - 1, 1))} aria-label="Previous month">
            ‹
          </button>
          <h2 className="font-semibold">{month.toLocaleDateString(undefined, { month: 'long', year: 'numeric' })}</h2>
          <button className="btn-soft h-11 w-11 min-h-0 p-0" onClick={() => setMonth(new Date(month.getFullYear(), month.getMonth() + 1, 1))} aria-label="Next month">
            ›
          </button>
        </div>
        <div className="mt-3 grid grid-cols-7 gap-1.5 text-center text-xs font-medium muted">
          {['M', 'T', 'W', 'T', 'F', 'S', 'S'].map((d, i) => (
            <span key={i}>{d}</span>
          ))}
        </div>
        <div className="mt-1.5 grid grid-cols-7 gap-1.5">
          {cells.map((key, i) => {
            if (!key) return <span key={i} />
            const c = dayCompletion(log, key)
            const isToday = key === today
            const n = log.filter((e) => e.date === key).length
            return (
              <div
                key={key}
                title={`${key}: ${n} session${n === 1 ? '' : 's'}`}
                className={`tabular flex aspect-square items-center justify-center rounded-lg text-sm font-semibold ${
                  c === 'full'
                    ? 'bg-brand-500 text-white'
                    : c === 'partial'
                      ? 'bg-brand-100 text-brand-800 dark:bg-brand-900/60 dark:text-brand-100'
                      : key > today
                        ? 'text-slate-300 dark:text-slate-700'
                        : 'bg-slate-50 text-slate-500 dark:bg-slate-800/60 dark:text-slate-400'
                } ${isToday ? 'ring-2 ring-accent-500 ring-offset-1 ring-offset-white dark:ring-offset-slate-900' : ''}`}
              >
                {parseKey(key).getDate()}
              </div>
            )
          })}
        </div>
        <div className="mt-3 flex flex-wrap gap-4 text-xs muted">
          <span className="flex items-center gap-1.5"><span className="h-3 w-3 rounded bg-brand-500" /> Full routine</span>
          <span className="flex items-center gap-1.5"><span className="h-3 w-3 rounded bg-brand-100 dark:bg-brand-900/60" /> Some sessions</span>
          <span className="flex items-center gap-1.5"><span className="h-3 w-3 rounded ring-2 ring-accent-500" /> Today</span>
        </div>
      </section>

      <RangePicker value={range} onChange={setRange} />

      <section className="card p-4">
        <div className="flex items-start justify-between gap-2">
          <div>
            <h2 className="font-semibold">Morning first-step pain</h2>
            <p className="text-xs muted">0 = no pain, 10 = worst</p>
          </div>
          {stats.firstWeek !== null && stats.lastWeek !== null && days.length >= 14 && (
            <span className="pill bg-slate-100 py-1 text-slate-700 dark:bg-slate-800 dark:text-slate-200">
              {Math.abs(stats.lastWeek - stats.firstWeek) < 0.5
                ? 'About the same'
                : stats.lastWeek < stats.firstWeek
                  ? `▼ ${(stats.firstWeek - stats.lastWeek).toFixed(1)} vs first week`
                  : `▲ ${(stats.lastWeek - stats.firstWeek).toFixed(1)} vs first week`}
            </span>
          )}
        </div>
        <div className="mt-3">
          <PainTrend days={days} pain={pain} />
        </div>
      </section>

      <section className="card p-4">
        <h2 className="font-semibold">Routine completed each day</h2>
        <p className="text-xs muted">Share of that day's prescribed sessions</p>
        <div className="mt-3">
          <AdherenceBars data={adherence} />
        </div>
      </section>

      <section className="card p-4">
        <h2 className="font-semibold">What you did</h2>
        <div className="mt-3">
          <ExerciseHeatmap log={log} days={days} />
        </div>
      </section>

      <section className="card p-4">
        <h2 className="font-semibold">What's linked with next-morning pain</h2>
        <p className="mb-3 text-xs muted">Each day's exercise compared with your pain rating the following morning.</p>
        <CorrelationList items={corr} />
      </section>

      <section className="card p-4">
        <h2 className="font-semibold">Recent sessions</h2>
        {recent.length === 0 ? (
          <p className="mt-2 text-sm muted">No sessions yet. Finish an exercise and it shows up here.</p>
        ) : (
          <ul className="mt-2 divide-y divide-slate-100 dark:divide-slate-800">
            {recent.map((e) => (
              <li key={e.id} className="flex items-center justify-between gap-3 py-2.5">
                <div className="min-w-0">
                  <p className="truncate font-medium">{EXERCISE_BY_ID[e.exerciseId]?.name ?? e.exerciseId}</p>
                  <p className="text-xs muted">
                    {parseKey(e.date).toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' })} ·{' '}
                    {new Date(e.ts).toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' })} · {e.sides.join(' + ')}
                    {e.manual ? ' · logged by hand' : ''}
                  </p>
                </div>
                <button
                  className="min-h-[44px] rounded-lg px-3 text-sm font-medium text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800"
                  onClick={() => window.confirm('Delete this session?') && remove(e.id)}
                >
                  Delete
                </button>
              </li>
            ))}
          </ul>
        )}
        {sorted.length > recent.length && (
          <button className="btn-soft mt-2 w-full text-sm" onClick={() => setShowAll(true)}>
            Show all {sorted.length} sessions
          </button>
        )}
      </section>
    </div>
  )
}

function Stat({ value, label }: { value: number; label: string }) {
  return (
    <div className="card p-3 text-center">
      <p className="tabular text-3xl font-bold">{value}</p>
      <p className="mt-0.5 text-xs leading-tight muted">{label}</p>
    </div>
  )
}
