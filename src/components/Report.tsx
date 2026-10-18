import { useEffect, useState } from 'react'
import { EXERCISE_BY_ID } from '../data/exercises'
import { adherenceByDay, adherenceByExercise, correlations, dayRange, describeR, painStats } from '../lib/analytics'
import { useProfile } from '../lib/cloud'
import { parseKey, todayKey, useLog, usePain, useSettings } from '../lib/storage'
import { go } from '../lib/useHashRoute'
import { AdherenceBars, ExerciseHeatmap, PainTrend } from './charts'
import RangePicker, { rangeStart, type RangeKey } from './RangePicker'
import { IconBack } from './Icons'

const fmtLong = (d: string) => parseKey(d).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' })
const f1 = (v: number | null) => (v === null ? '–' : v.toFixed(1))

/** A printable summary for you or your physio. Print → "Save as PDF" to share it. */
export default function Report() {
  const { log } = useLog()
  const [pain] = usePain()
  const [settings] = useSettings()
  const { profile } = useProfile()
  const today = todayKey()
  const [range, setRange] = useState<RangeKey>('30')
  const days = dayRange(rangeStart(range, today, log, pain), today)
  const inRange = log.filter((e) => e.date >= days[0] && e.date <= today)
  const stats = painStats(pain, days)
  const adh = adherenceByDay(log, days)
  const overall = adh.reduce((a, d) => a + d.done, 0) / Math.max(1, adh.reduce((a, d) => a + d.target, 0))
  const perEx = adherenceByExercise(log, days)
  const corr = correlations(log, pain, days).filter((c) => c.r !== null && Math.abs(c.r) >= 0.1).sort((a, b) => a.r! - b.r!)
  const foot = profile?.affected_foot ?? settings.foot

  // always print on a light page
  useEffect(() => {
    const root = document.documentElement
    let wasDark = false
    const before = () => {
      wasDark = root.classList.contains('dark')
      root.classList.remove('dark')
    }
    const after = () => wasDark && root.classList.add('dark')
    window.addEventListener('beforeprint', before)
    window.addEventListener('afterprint', after)
    return () => {
      window.removeEventListener('beforeprint', before)
      window.removeEventListener('afterprint', after)
    }
  }, [])

  const downloadCsv = () => {
    const rows = [['type', 'date', 'time', 'exercise', 'sides', 'logged_by_hand', 'pain_0_10']]
    for (const e of [...inRange].sort((a, b) => a.ts - b.ts)) {
      rows.push(['session', e.date, new Date(e.ts).toLocaleTimeString(), EXERCISE_BY_ID[e.exerciseId]?.name ?? e.exerciseId, e.sides.join('+'), e.manual ? 'yes' : 'no', ''])
    }
    for (const d of days) if (pain[d] !== undefined) rows.push(['pain', d, '', '', '', '', String(pain[d])])
    const csv = rows.map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(',')).join('\n')
    const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv' }))
    const a = document.createElement('a')
    a.href = url
    a.download = `heel-routine-${days[0]}-to-${today}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <div className="space-y-5 print:space-y-4 print:text-black">
      <div className="flex items-center justify-between pt-2 print:hidden">
        <button className="btn-soft h-11 w-11 min-h-0 p-0" onClick={() => go('/history')} aria-label="Back">
          <IconBack />
        </button>
        <div className="flex gap-2">
          <button className="btn-soft min-h-[44px] text-sm" onClick={downloadCsv}>
            CSV
          </button>
          <button className="btn-primary min-h-[44px] text-sm" onClick={() => window.print()}>
            Print / PDF
          </button>
        </div>
      </div>
      <RangePicker value={range} onChange={setRange} />

      <header>
        <p className="text-sm muted">Plantar fasciitis progress report</p>
        <h1 className="text-2xl font-bold tracking-tight">{profile?.display_name || 'My report'}</h1>
        <p className="mt-1 text-sm muted">
          {fmtLong(days[0])} – {fmtLong(today)} · {days.length} days · {foot === 'both' ? 'both feet' : `${foot} foot`}
          {profile?.condition_start && ` · symptoms since ${fmtLong(profile.condition_start)}`}
          {profile?.physio_name && ` · physio: ${profile.physio_name}`}
        </p>
      </header>

      <section className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Tile label="Avg pain (period)" value={f1(stats.avg)} sub={`${stats.n} ratings`} />
        <Tile label="First week → last week" value={`${f1(stats.firstWeek)} → ${f1(stats.lastWeek)}`} sub="morning pain" />
        <Tile label="Routine completed" value={`${Math.round(overall * 100)}%`} sub="of prescribed sessions" />
        <Tile label="Sessions logged" value={String(inRange.length)} sub={`${new Set(inRange.map((e) => e.date)).size} active days`} />
      </section>

      <Card title="Summary">
        <ul className="list-disc space-y-1 pl-5 text-sm">
          {stats.firstWeek !== null && stats.lastWeek !== null ? (
            <li>
              Morning first-step pain went from an average of {stats.firstWeek.toFixed(1)} in the first week to {stats.lastWeek.toFixed(1)} in the last week (
              {stats.lastWeek < stats.firstWeek - 0.4 ? 'improving' : stats.lastWeek > stats.firstWeek + 0.4 ? 'worse' : 'about the same'}).
            </li>
          ) : (
            <li>Not enough pain ratings to compare the first and last week.</li>
          )}
          <li>{Math.round(overall * 100)}% of the prescribed daily sessions were completed.</li>
          {corr.slice(0, 3).map((c) => (
            <li key={c.key}>
              {c.label}: {describeR(c.r!).toLowerCase()} (r = {c.r!.toFixed(2)}, {c.n} days).
            </li>
          ))}
          {corr.length === 0 && <li>No clear link between exercises and next-morning pain yet (needs more paired days).</li>}
        </ul>
        {profile?.notes && <p className="mt-3 whitespace-pre-wrap rounded-xl bg-slate-50 p-3 text-sm dark:bg-slate-800/60">{profile.notes}</p>}
      </Card>

      <Card title="Morning first-step pain">
        <PainTrend days={days} pain={pain} />
      </Card>
      <Card title="Routine completed each day">
        <AdherenceBars data={adh} />
      </Card>
      <Card title="Exercises done">
        <ExerciseHeatmap log={log} days={days} />
      </Card>

      <Card title="Adherence by exercise">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-xs muted">
              <th className="py-1 font-medium">Exercise</th>
              <th className="py-1 font-medium">Prescription</th>
              <th className="py-1 text-right font-medium">Done</th>
            </tr>
          </thead>
          <tbody>
            {perEx.map(({ ex, done, target, total, pct }) => (
              <tr key={ex.id} className="border-t border-slate-100 dark:border-slate-800">
                <td className="py-1.5 pr-2">{ex.name}</td>
                <td className="py-1.5 pr-2 text-xs muted">
                  {ex.dosage} · {ex.frequencyLabel}
                </td>
                <td className="tabular py-1.5 text-right font-semibold">{pct === null ? `${total}×` : `${done}/${target} (${Math.round(pct * 100)}%)`}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>

      <p className="text-xs muted">
        Generated {new Date().toLocaleString()} by Heel Routine. Not medical advice. Correlations show patterns, not causes.
      </p>
    </div>
  )
}

function Tile({ label, value, sub }: { label: string; value: string; sub: string }) {
  return (
    <div className="card p-3 print:shadow-none">
      <p className="text-xs muted">{label}</p>
      <p className="tabular mt-0.5 text-xl font-bold">{value}</p>
      <p className="text-xs muted">{sub}</p>
    </div>
  )
}

function Card({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="card break-inside-avoid p-4 print:shadow-none">
      <h2 className="mb-2 font-semibold">{title}</h2>
      {children}
    </section>
  )
}
