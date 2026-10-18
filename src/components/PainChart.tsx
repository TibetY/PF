import { useState } from 'react'
import { addDays, parseKey, todayKey, usePain } from '../lib/storage'

const DAYS = 30

/** Morning first-step pain over the last 30 days: one series, line + markers, tap for values. */
export default function PainChart() {
  const [pain] = usePain()
  const [active, setActive] = useState<string | null>(null)
  const [showTable, setShowTable] = useState(false)
  const today = todayKey()
  const start = addDays(today, -(DAYS - 1))
  const points = Object.entries(pain)
    .filter(([d]) => d >= start && d <= today)
    .sort(([a], [b]) => (a < b ? -1 : 1))
    .map(([d, v]) => ({ d, v, i: DAYS - 1 - Math.round((parseKey(today).getTime() - parseKey(d).getTime()) / 86400000) }))

  const W = 320
  const H = 170
  const pad = { l: 26, r: 10, t: 12, b: 24 }
  const x = (i: number) => pad.l + (i / (DAYS - 1)) * (W - pad.l - pad.r)
  const y = (v: number) => pad.t + (1 - v / 10) * (H - pad.t - pad.b)

  // simple trend: compare the average of the first and last week that have ratings
  let trend: string | null = null
  if (points.length >= 4) {
    const k = Math.max(2, Math.floor(points.length / 3))
    const avg = (arr: typeof points) => arr.reduce((a, p) => a + p.v, 0) / arr.length
    const delta = avg(points.slice(-k)) - avg(points.slice(0, k))
    trend = Math.abs(delta) < 0.5 ? 'About the same' : delta < 0 ? `Improving (${Math.abs(delta).toFixed(1)} lower)` : `Worse (${delta.toFixed(1)} higher)`
  }
  const sel = points.find((p) => p.d === active)
  const fmt = (d: string) => parseKey(d).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })

  return (
    <section className="card p-4">
      <div className="flex items-start justify-between gap-2">
        <div>
          <h2 className="font-semibold">Morning first-step pain</h2>
          <p className="text-xs muted">Last {DAYS} days · 0 = no pain, 10 = worst</p>
        </div>
        {trend && <span className="pill bg-slate-100 py-1 text-slate-700 dark:bg-slate-800 dark:text-slate-200">{trend}</span>}
      </div>

      {points.length === 0 ? (
        <p className="mt-3 text-sm muted">Rate your first steps on the Today screen to see your trend here.</p>
      ) : (
        <div className="relative mt-3">
          <svg viewBox={`0 0 ${W} ${H}`} className="w-full" role="img" aria-label={`Pain ratings, ${points.length} entries`} onPointerLeave={() => setActive(null)}>
            {[0, 5, 10].map((v) => (
              <g key={v}>
                <line x1={pad.l} x2={W - pad.r} y1={y(v)} y2={y(v)} className="stroke-slate-200 dark:stroke-slate-700" strokeWidth={1} />
                <text x={pad.l - 8} y={y(v) + 4} textAnchor="end" className="fill-slate-500 text-[10px] dark:fill-slate-400">
                  {v}
                </text>
              </g>
            ))}
            <text x={pad.l} y={H - 6} className="fill-slate-500 text-[10px] dark:fill-slate-400">{fmt(start)}</text>
            <text x={W - pad.r} y={H - 6} textAnchor="end" className="fill-slate-500 text-[10px] dark:fill-slate-400">Today</text>
            {sel && <line x1={x(sel.i)} x2={x(sel.i)} y1={pad.t} y2={H - pad.b} className="stroke-slate-300 dark:stroke-slate-600" strokeWidth={1} />}
            {points.length > 1 && (
              <polyline
                points={points.map((p) => `${x(p.i)},${y(p.v)}`).join(' ')}
                fill="none"
                className="stroke-brand-500 dark:stroke-brand-300"
                strokeWidth={2}
                strokeLinejoin="round"
                strokeLinecap="round"
              />
            )}
            {points.map((p) => (
              <g key={p.d}>
                <circle cx={x(p.i)} cy={y(p.v)} r={active === p.d ? 6 : 4} className="fill-brand-500 stroke-white dark:fill-brand-300 dark:stroke-slate-900" strokeWidth={2} />
                {/* generous hit target */}
                <rect
                  x={x(p.i) - 8}
                  y={pad.t}
                  width={16}
                  height={H - pad.t - pad.b}
                  fill="transparent"
                  onPointerEnter={() => setActive(p.d)}
                  onClick={() => setActive(p.d)}
                />
              </g>
            ))}
          </svg>
          {sel && (
            <div
              className="pointer-events-none absolute -translate-x-1/2 rounded-lg bg-slate-900 px-2.5 py-1.5 text-xs font-medium text-white shadow dark:bg-slate-100 dark:text-slate-900"
              style={{ left: `${(x(sel.i) / W) * 100}%`, top: 0 }}
            >
              {fmt(sel.d)}: <span className="tabular font-bold">{sel.v}</span>/10
            </div>
          )}
        </div>
      )}

      {points.length > 0 && (
        <>
          <button className="mt-2 text-sm font-medium text-brand-700 underline-offset-2 hover:underline dark:text-brand-300" onClick={() => setShowTable((s) => !s)}>
            {showTable ? 'Hide table' : 'Show as table'}
          </button>
          {showTable && (
            <table className="mt-2 w-full text-sm">
              <thead>
                <tr className="text-left muted">
                  <th className="py-1 font-medium">Date</th>
                  <th className="py-1 text-right font-medium">Pain</th>
                </tr>
              </thead>
              <tbody>
                {[...points].reverse().map((p) => (
                  <tr key={p.d} className="border-t border-slate-100 dark:border-slate-800">
                    <td className="py-1.5">{fmt(p.d)}</td>
                    <td className="tabular py-1.5 text-right font-semibold">{p.v}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </>
      )}
    </section>
  )
}
