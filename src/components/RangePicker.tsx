import { addDays, type PainLog, type SessionLog } from '../lib/storage'

export type RangeKey = '14' | '30' | '90' | 'all'
const OPTIONS: { key: RangeKey; label: string }[] = [
  { key: '14', label: '2 wks' },
  { key: '30', label: '30 days' },
  { key: '90', label: '90 days' },
  { key: 'all', label: 'All' },
]

export function rangeStart(key: RangeKey, today: string, log: SessionLog[], pain: PainLog) {
  if (key !== 'all') return addDays(today, -(Number(key) - 1))
  const first = [...log.map((e) => e.date), ...Object.keys(pain)].sort()[0]
  return first && first < addDays(today, -13) ? first : addDays(today, -13)
}

export default function RangePicker({ value, onChange }: { value: RangeKey; onChange: (k: RangeKey) => void }) {
  return (
    <div className="grid grid-cols-4 gap-1 rounded-xl bg-slate-100 p-1 dark:bg-slate-800 print:hidden" role="radiogroup" aria-label="Time range">
      {OPTIONS.map((o) => (
        <button
          key={o.key}
          role="radio"
          aria-checked={value === o.key}
          onClick={() => onChange(o.key)}
          className={`min-h-[44px] rounded-lg text-sm font-semibold ${value === o.key ? 'bg-white text-brand-700 shadow-sm dark:bg-slate-950 dark:text-brand-300' : 'text-slate-600 dark:text-slate-300'}`}
        >
          {o.label}
        </button>
      ))}
    </div>
  )
}
