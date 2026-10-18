import type { PhaseKind } from '../lib/phases'

/** Visual 3-2-3 cadence: segments sized by duration, with a moving cursor and per-second dots. */
export default function TempoIndicator({
  tempo, phase, elapsed,
}: {
  tempo: { up: number; top: number; down: number }
  phase: PhaseKind | null
  elapsed: number
}) {
  const total = tempo.up + tempo.top + tempo.down
  const offset = phase === 'up' ? 0 : phase === 'top' ? tempo.up : phase === 'down' ? tempo.up + tempo.top : 0
  const pos = phase ? Math.min(total, offset + elapsed) / total : 0
  const segs = [
    { key: 'up', label: 'Up', sec: tempo.up, color: 'bg-brand-400' },
    { key: 'top', label: 'Hold', sec: tempo.top, color: 'bg-accent-400' },
    { key: 'down', label: 'Down', sec: tempo.down, color: 'bg-brand-600' },
  ]
  // heel height trace: rises over "up", flat at "top", falls over "down"
  const w = 240
  const h = 36
  const x = (t: number) => (t / total) * w
  const path = `M0 ${h - 4} L${x(tempo.up)} 4 L${x(tempo.up + tempo.top)} 4 L${w} ${h - 4}`
  return (
    <div className="mx-auto mt-4 w-full max-w-xs" aria-label="Tempo 3 seconds up, 2 seconds hold, 3 seconds down">
      <svg viewBox={`-4 0 ${w + 8} ${h}`} className="h-9 w-full overflow-visible">
        <path d={path} fill="none" stroke="currentColor" strokeWidth={2} className="text-slate-300 dark:text-slate-600" strokeLinejoin="round" />
        {phase && (
          <circle
            cx={x(pos * total)}
            cy={pos * total <= tempo.up ? h - 4 - ((h - 8) * (pos * total)) / tempo.up : pos * total <= tempo.up + tempo.top ? 4 : 4 + ((h - 8) * (pos * total - tempo.up - tempo.top)) / tempo.down}
            r={6}
            className="fill-accent-500"
          />
        )}
      </svg>
      <div className="mt-1 flex gap-1">
        {segs.map((s) => {
          const active = phase === s.key
          return (
            <div key={s.key} style={{ flex: s.sec }} className="min-w-0">
              <div className={`flex h-3 gap-0.5 overflow-hidden rounded-full ${active ? '' : 'opacity-35'}`}>
                {Array.from({ length: s.sec }, (_, i) => {
                  const lit = active && elapsed >= i
                  return <span key={i} className={`flex-1 ${lit ? s.color : 'bg-slate-200 dark:bg-slate-700'}`} />
                })}
              </div>
              <p className={`mt-1 text-xs font-semibold ${active ? '' : 'muted'}`}>
                {s.label} {s.sec}s
              </p>
            </div>
          )
        })}
      </div>
    </div>
  )
}
