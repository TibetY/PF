import { useState } from 'react'
import { usePain } from '../lib/storage'

const painColor = (v: number) =>
  v <= 3 ? 'bg-brand-500 text-white' : v <= 6 ? 'bg-amber-400 text-slate-900' : 'bg-accent-500 text-white'

/** Optional 0-10 rating of morning first-step pain. */
export default function PainPicker({ date }: { date: string }) {
  const [pain, setPain] = usePain()
  const value = pain[date]
  const [editing, setEditing] = useState(false)

  if (value !== undefined && !editing) {
    return (
      <section className="card flex items-center justify-between p-4">
        <div>
          <p className="text-sm font-medium muted">Morning first-step pain</p>
          <p className="text-lg font-semibold">
            <span className="tabular">{value}</span> / 10
          </p>
        </div>
        <button className="btn-soft min-h-[44px] text-sm" onClick={() => setEditing(true)}>
          Change
        </button>
      </section>
    )
  }

  return (
    <section className="card p-4">
      <p className="font-semibold">How did your first steps feel this morning?</p>
      <p className="text-sm muted">Optional. 0 = no pain, 10 = worst pain.</p>
      <div className="mt-3 grid grid-cols-6 gap-2" role="radiogroup" aria-label="Pain rating from 0 to 10">
        {Array.from({ length: 11 }, (_, v) => (
          <button
            key={v}
            role="radio"
            aria-checked={value === v}
            onClick={() => {
              setPain(date, v)
              setEditing(false)
            }}
            className={`tabular h-12 rounded-xl text-lg font-semibold transition active:scale-95 ${
              value === v ? painColor(v) : 'bg-slate-100 dark:bg-slate-800'
            }`}
          >
            {v}
          </button>
        ))}
        {editing && (
          <button
            className="h-12 rounded-xl bg-slate-100 text-sm font-medium dark:bg-slate-800"
            onClick={() => {
              setPain(date, null)
              setEditing(false)
            }}
          >
            Clear
          </button>
        )}
      </div>
    </section>
  )
}
