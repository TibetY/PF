export default function Stepper({
  label, value, min, max, step, format, onChange,
}: {
  label: string; value: number; min: number; max: number; step: number; format: (v: number) => string; onChange: (v: number) => void
}) {
  const clamp = (v: number) => Math.min(max, Math.max(min, v))
  return (
    <div className="flex items-center justify-between gap-3 p-3 pl-4">
      <span className="font-medium">{label}</span>
      <div className="flex items-center gap-2">
        <button className="btn-soft h-11 w-11 min-h-0 p-0 text-xl" onClick={() => onChange(clamp(value - step))} disabled={value <= min} aria-label={`Decrease ${label}`}>
          −
        </button>
        <span className="tabular w-20 text-center font-semibold">{format(value)}</span>
        <button className="btn-soft h-11 w-11 min-h-0 p-0 text-xl" onClick={() => onChange(clamp(value + step))} disabled={value >= max} aria-label={`Increase ${label}`}>
          +
        </button>
      </div>
    </div>
  )
}
