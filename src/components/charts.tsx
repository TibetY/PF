import { useState } from 'react'
import { EXERCISES } from '../data/exercises'
import type { Correlation, DayAdherence } from '../lib/analytics'
import { countsByDay, describeR, MIN_PAIRS } from '../lib/analytics'
import { parseKey, type PainLog, type SessionLog } from '../lib/storage'

// Validated palette (light / dark). Single series use slot 1; diverging pairs slot 1 vs slot 2.
const C = {
  series: 'fill-[#2a78d6] dark:fill-[#3987e5]',
  seriesStroke: 'stroke-[#2a78d6] dark:stroke-[#3987e5]',
  up: 'fill-[#eb6834] dark:fill-[#d95926]',
  grid: 'stroke-[#e1e0d9] dark:stroke-[#2c2c2a]',
  axis: 'stroke-[#c3c2b7] dark:stroke-[#383835]',
  label: 'fill-[#898781] text-[10px]',
  ring: 'stroke-white dark:stroke-slate-900',
}
// sequential blue ramp: light -> dark in light mode, flipped in dark mode
const RAMP = [
  'fill-[#cde2fb] dark:fill-[#104281]',
  'fill-[#86b6ef] dark:fill-[#1c5cab]',
  'fill-[#3987e5] dark:fill-[#3987e5]',
  'fill-[#1c5cab] dark:fill-[#86b6ef]',
]
const EMPTY = 'fill-[#efeee9] dark:fill-[#262624]'

const W = 340
const fmt = (d: string) => parseKey(d).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })

interface Tip {
  x: number
  text: string
}
function Tooltip({ tip }: { tip: Tip | null }) {
  if (!tip) return null
  return (
    <div
      className="pointer-events-none absolute -top-1 z-10 -translate-x-1/2 -translate-y-full whitespace-nowrap rounded-lg bg-slate-900 px-2.5 py-1.5 text-xs font-medium text-white shadow dark:bg-slate-100 dark:text-slate-900"
      style={{ left: `${Math.min(85, Math.max(15, (tip.x / W) * 100))}%` }}
    >
      {tip.text}
    </div>
  )
}

function Legend({ items }: { items: { label: string; swatch: React.ReactNode }[] }) {
  return (
    <div className="mt-2 flex flex-wrap gap-4 text-xs muted">
      {items.map((i) => (
        <span key={i.label} className="flex items-center gap-1.5">
          {i.swatch}
          {i.label}
        </span>
      ))}
    </div>
  )
}

/** Daily first-step pain (markers) with a 7-day rolling average (line). */
export function PainTrend({ days, pain }: { days: string[]; pain: PainLog }) {
  const [tip, setTip] = useState<Tip | null>(null)
  const H = 160
  const pad = { l: 26, r: 8, t: 10, b: 22 }
  const x = (i: number) => pad.l + (days.length > 1 ? (i / (days.length - 1)) * (W - pad.l - pad.r) : 0)
  const y = (v: number) => pad.t + (1 - v / 10) * (H - pad.t - pad.b)
  const avg = days.map((_, i) => {
    const win = days.slice(Math.max(0, i - 6), i + 1).map((d) => pain[d]).filter((v): v is number => v !== undefined)
    return win.length >= 3 ? win.reduce((a, b) => a + b, 0) / win.length : null
  })
  const segs: string[] = []
  let cur = ''
  avg.forEach((v, i) => {
    if (v === null) {
      if (cur) segs.push(cur)
      cur = ''
    } else cur += `${cur ? 'L' : 'M'}${x(i).toFixed(1)},${y(v).toFixed(1)}`
  })
  if (cur) segs.push(cur)
  const any = days.some((d) => pain[d] !== undefined)

  return (
    <div>
      {!any ? (
        <p className="py-6 text-center text-sm muted">No pain ratings in this period yet.</p>
      ) : (
        <div className="relative">
          <Tooltip tip={tip} />
          <svg viewBox={`0 0 ${W} ${H}`} className="w-full" role="img" aria-label="Morning first-step pain over time" onPointerLeave={() => setTip(null)}>
            {[0, 5, 10].map((v) => (
              <g key={v}>
                <line x1={pad.l} x2={W - pad.r} y1={y(v)} y2={y(v)} className={v === 0 ? C.axis : C.grid} strokeWidth={1} />
                <text x={pad.l - 6} y={y(v) + 3} textAnchor="end" className={C.label}>{v}</text>
              </g>
            ))}
            <text x={pad.l} y={H - 6} className={C.label}>{fmt(days[0])}</text>
            <text x={W - pad.r} y={H - 6} textAnchor="end" className={C.label}>{fmt(days[days.length - 1])}</text>
            {segs.map((d, i) => (
              <path key={i} d={d} fill="none" className={C.seriesStroke} strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />
            ))}
            {days.map((d, i) =>
              pain[d] === undefined ? null : (
                <circle key={d} cx={x(i)} cy={y(pain[d])} r={4} className={`${C.series} ${C.ring}`} fillOpacity={0.45} strokeWidth={1.5} />
              ),
            )}
            {days.map((d, i) => (
              <rect
                key={d}
                x={x(i) - (W - pad.l - pad.r) / days.length / 2}
                y={pad.t}
                width={Math.max(6, (W - pad.l - pad.r) / days.length)}
                height={H - pad.t - pad.b}
                fill="transparent"
                onPointerEnter={() =>
                  setTip({ x: x(i), text: `${fmt(d)} · ${pain[d] ?? '–'}/10${avg[i] !== null ? ` · 7-day avg ${avg[i]!.toFixed(1)}` : ''}` })
                }
                onClick={() => setTip({ x: x(i), text: `${fmt(d)} · ${pain[d] ?? '–'}/10${avg[i] !== null ? ` · 7-day avg ${avg[i]!.toFixed(1)}` : ''}` })}
              />
            ))}
          </svg>
          <Legend
            items={[
              { label: 'Daily rating', swatch: <span className="h-2.5 w-2.5 rounded-full bg-[#2a78d6]/45 dark:bg-[#3987e5]/45" /> },
              { label: '7-day average', swatch: <span className="h-0.5 w-4 rounded bg-[#2a78d6] dark:bg-[#3987e5]" /> },
            ]}
          />
        </div>
      )}
    </div>
  )
}

/** Share of the day's prescribed sessions you completed. */
export function AdherenceBars({ data }: { data: DayAdherence[] }) {
  const [tip, setTip] = useState<Tip | null>(null)
  const H = 120
  const pad = { l: 34, r: 8, t: 8, b: 22 }
  const step = (W - pad.l - pad.r) / data.length
  const bw = Math.max(1, step - 2)
  const y = (v: number) => pad.t + (1 - v) * (H - pad.t - pad.b)
  const base = y(0)
  return (
    <div className="relative">
      <Tooltip tip={tip} />
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full" role="img" aria-label="Daily routine completion" onPointerLeave={() => setTip(null)}>
        {[0, 0.5, 1].map((v) => (
          <g key={v}>
            <line x1={pad.l} x2={W - pad.r} y1={y(v)} y2={y(v)} className={v === 0 ? C.axis : C.grid} strokeWidth={1} />
            <text x={pad.l - 6} y={y(v) + 3} textAnchor="end" className={C.label}>{v * 100}%</text>
          </g>
        ))}
        <text x={pad.l} y={H - 6} className={C.label}>{fmt(data[0].date)}</text>
        <text x={W - pad.r} y={H - 6} textAnchor="end" className={C.label}>{fmt(data[data.length - 1].date)}</text>
        {data.map((d, i) => {
          const x0 = pad.l + i * step + 1
          const top = y(d.pct)
          const r = Math.min(4, bw / 2, base - top)
          const path =
            d.pct <= 0
              ? ''
              : `M${x0},${base} L${x0},${top + r} Q${x0},${top} ${x0 + r},${top} L${x0 + bw - r},${top} Q${x0 + bw},${top} ${x0 + bw},${top + r} L${x0 + bw},${base} Z`
          const text = `${fmt(d.date)} · ${d.done}/${d.target} sessions (${Math.round(d.pct * 100)}%)`
          return (
            <g key={d.date}>
              {path && <path d={path} className={C.series} />}
              <rect x={pad.l + i * step} y={pad.t} width={step} height={H - pad.t - pad.b} fill="transparent" onPointerEnter={() => setTip({ x: x0 + bw / 2, text })} onClick={() => setTip({ x: x0 + bw / 2, text })} />
            </g>
          )
        })}
      </svg>
    </div>
  )
}

/** Which exercises were done on which days. */
export function ExerciseHeatmap({ log, days }: { log: SessionLog[]; days: string[] }) {
  const [tip, setTip] = useState<Tip | null>(null)
  const count = countsByDay(log)
  const labelW = 104
  const rowH = 16
  const rows = EXERCISES
  const H = rows.length * rowH + 20
  const cw = (W - labelW - 4) / days.length
  return (
    <div className="relative">
      <Tooltip tip={tip} />
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full" role="img" aria-label="Sessions per exercise per day" onPointerLeave={() => setTip(null)}>
        {rows.map((ex, r) => (
          <g key={ex.id}>
            <text x={labelW - 6} y={r * rowH + 11} textAnchor="end" className="fill-slate-600 text-[9px] dark:fill-slate-300">
              {ex.shortName}
            </text>
            {days.map((d, i) => {
              const c = count(ex.id, d)
              const ratio = Math.min(1, c / (ex.perDay ?? 1))
              const cls = c === 0 ? EMPTY : RAMP[Math.min(3, Math.max(0, Math.ceil(ratio * 4) - 1))]
              const cx = labelW + i * cw
              const text = `${ex.shortName} · ${fmt(d)} · ${c} session${c === 1 ? '' : 's'}${ex.perDay ? ` of ${ex.perDay}` : ''}`
              return (
                <rect
                  key={d}
                  x={cx + 0.5}
                  y={r * rowH + 2}
                  width={Math.max(0.8, cw - 1)}
                  height={rowH - 4}
                  rx={Math.min(2, cw / 3)}
                  className={cls}
                  onPointerEnter={() => setTip({ x: cx, text })}
                  onClick={() => setTip({ x: cx, text })}
                />
              )
            })}
          </g>
        ))}
        <text x={labelW} y={H - 4} className={C.label}>{fmt(days[0])}</text>
        <text x={W - 4} y={H - 4} textAnchor="end" className={C.label}>{fmt(days[days.length - 1])}</text>
      </svg>
      <Legend
        items={[
          { label: 'None', swatch: <span className="h-3 w-3 rounded-sm bg-[#efeee9] dark:bg-[#262624]" /> },
          { label: 'Some', swatch: <span className="h-3 w-3 rounded-sm bg-[#86b6ef] dark:bg-[#1c5cab]" /> },
          { label: 'All prescribed', swatch: <span className="h-3 w-3 rounded-sm bg-[#1c5cab] dark:bg-[#86b6ef]" /> },
        ]}
      />
    </div>
  )
}

/** Diverging bars: r < 0 means lower next-morning pain after doing it. */
export function CorrelationList({ items }: { items: Correlation[] }) {
  const usable = items.filter((c) => c.r !== null).sort((a, b) => a.r! - b.r!)
  const waiting = items.filter((c) => c.r === null)
  return (
    <div>
      {usable.length === 0 ? (
        <p className="text-sm muted">
          Not enough data yet. This needs at least {MIN_PAIRS} days where you logged a pain rating the next morning.
        </p>
      ) : (
        <ul className="space-y-3">
          {usable.map((c) => {
            const r = c.r!
            const width = Math.abs(r) * 50
            return (
              <li key={c.key}>
                <div className="flex items-baseline justify-between gap-2">
                  <p className="text-sm font-medium leading-tight">{c.label}</p>
                  <span className="tabular shrink-0 text-xs muted">r = {r.toFixed(2)} · {c.n} days</span>
                </div>
                <div className="relative mt-1 h-3 rounded-full bg-[#efeee9] dark:bg-[#262624]">
                  <span className="absolute inset-y-0 left-1/2 w-px bg-[#c3c2b7] dark:bg-[#383835]" />
                  <span
                    className={`absolute inset-y-0 rounded-full ${r < 0 ? 'bg-[#2a78d6] dark:bg-[#3987e5]' : 'bg-[#eb6834] dark:bg-[#d95926]'}`}
                    style={r < 0 ? { right: '50%', width: `${width}%` } : { left: '50%', width: `${width}%` }}
                  />
                </div>
                <p className="mt-1 text-xs muted">
                  {describeR(r)}
                  {c.painAfterDone !== null && c.painAfterSkipped !== null && c.nDone > 0 && c.nSkipped > 0 && (
                    <>
                      {' '}· next morning {c.painAfterDone.toFixed(1)} after doing it ({c.nDone}) vs {c.painAfterSkipped.toFixed(1)} without ({c.nSkipped})
                    </>
                  )}
                </p>
              </li>
            )
          })}
        </ul>
      )}
      <div className="mt-3 flex flex-wrap gap-4 text-xs muted">
        <span className="flex items-center gap-1.5"><span className="h-2.5 w-4 rounded-full bg-[#2a78d6] dark:bg-[#3987e5]" /> Lower pain next morning</span>
        <span className="flex items-center gap-1.5"><span className="h-2.5 w-4 rounded-full bg-[#eb6834] dark:bg-[#d95926]" /> Higher pain next morning</span>
      </div>
      {waiting.length > 0 && usable.length > 0 && (
        <p className="mt-2 text-xs muted">
          Not enough data yet for: {waiting.map((w) => w.label).join(', ')}.
        </p>
      )}
      <p className="mt-2 text-xs muted">Correlation isn't cause: other things (shoes, activity, sleep) affect pain too. Patterns get more reliable with a few weeks of data.</p>
    </div>
  )
}
