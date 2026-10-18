import { EXERCISES, type Exercise, type ExerciseId } from '../data/exercises'
import { addDays, daysBetween, type PainLog, type SessionLog } from './storage'

/** Inclusive list of date keys from `start` to `end`. */
export function dayRange(start: string, end: string): string[] {
  const n = daysBetween(start, end)
  return Array.from({ length: Math.max(0, n + 1) }, (_, i) => addDays(start, i))
}

export function countsByDay(log: SessionLog[]) {
  const m = new Map<string, number>()
  for (const e of log) m.set(`${e.exerciseId}|${e.date}`, (m.get(`${e.exerciseId}|${e.date}`) ?? 0) + 1)
  return (id: ExerciseId, date: string) => m.get(`${id}|${date}`) ?? 0
}

/** Prescribed sessions for a given day (heel raises only on days they were due). */
export function prescribedOn(ex: Exercise, date: string, count: (id: ExerciseId, d: string) => number) {
  if (ex.frequency === 'daily') return ex.perDay ?? 1
  if (ex.frequency === 'every-other-day') return count(ex.id, addDays(date, -1)) > 0 ? 0 : 1
  return 0
}

export interface DayAdherence {
  date: string
  done: number
  target: number
  /** 0..1 */
  pct: number
}

export function adherenceByDay(log: SessionLog[], days: string[]): DayAdherence[] {
  const count = countsByDay(log)
  return days.map((date) => {
    let done = 0
    let target = 0
    for (const ex of EXERCISES) {
      const t = prescribedOn(ex, date, count)
      if (!t) continue
      target += t
      done += Math.min(count(ex.id, date), t)
    }
    return { date, done, target, pct: target ? done / target : 0 }
  })
}

/** Per exercise: share of prescribed sessions completed over the days. */
export function adherenceByExercise(log: SessionLog[], days: string[]) {
  const count = countsByDay(log)
  return EXERCISES.map((ex) => {
    let done = 0
    let target = 0
    let total = 0
    for (const d of days) {
      const t = prescribedOn(ex, d, count)
      const c = count(ex.id, d)
      total += c
      target += t
      done += t ? Math.min(c, t) : 0
    }
    return { ex, done, target, total, pct: target ? done / target : null }
  })
}

function pearson(xs: number[], ys: number[]) {
  const n = xs.length
  const mx = xs.reduce((a, b) => a + b, 0) / n
  const my = ys.reduce((a, b) => a + b, 0) / n
  let sxy = 0
  let sxx = 0
  let syy = 0
  for (let i = 0; i < n; i++) {
    sxy += (xs[i] - mx) * (ys[i] - my)
    sxx += (xs[i] - mx) ** 2
    syy += (ys[i] - my) ** 2
  }
  if (sxx === 0 || syy === 0) return null
  return sxy / Math.sqrt(sxx * syy)
}

const mean = (a: number[]) => (a.length ? a.reduce((x, y) => x + y, 0) / a.length : null)

export interface Correlation {
  key: string
  label: string
  /** Pearson r between the activity measure on day d and pain the next morning. */
  r: number | null
  n: number
  /** Next-morning pain after days it was done / not done. */
  painAfterDone: number | null
  painAfterSkipped: number | null
  nDone: number
  nSkipped: number
}

export const MIN_PAIRS = 8

/**
 * Links what you did on a day with your first-step pain the NEXT morning.
 * Correlation only: it can't show cause, and it needs a few weeks of data to mean much.
 */
export function correlations(log: SessionLog[], pain: PainLog, days: string[]): Correlation[] {
  const count = countsByDay(log)
  const adherence = adherenceByDay(log, days)
  const out: Correlation[] = []

  const build = (key: string, label: string, x: (d: string, i: number) => number | null, doneIf: (v: number) => boolean) => {
    const xs: number[] = []
    const ys: number[] = []
    const done: number[] = []
    const skipped: number[] = []
    days.forEach((d, i) => {
      const next = pain[addDays(d, 1)]
      const v = x(d, i)
      if (next === undefined || v === null) return
      xs.push(v)
      ys.push(next)
      ;(doneIf(v) ? done : skipped).push(next)
    })
    out.push({
      key, label, n: xs.length,
      r: xs.length >= MIN_PAIRS ? pearson(xs, ys) : null,
      painAfterDone: mean(done), painAfterSkipped: mean(skipped), nDone: done.length, nSkipped: skipped.length,
    })
  }

  build('all', 'Whole routine (% of prescribed sessions)', (_, i) => adherence[i].pct, (v) => v >= 0.8)
  build('rolling', 'Routine over the past 7 days', (_, i) => {
    const win = adherence.slice(Math.max(0, i - 6), i + 1)
    return win.length < 7 ? null : win.reduce((a, b) => a + b.pct, 0) / win.length
  }, (v) => v >= 0.8)
  for (const ex of EXERCISES) {
    const per = ex.perDay ?? 1
    build(ex.id, ex.name, (d) => Math.min(1, count(ex.id, d) / per), (v) => v > 0)
  }
  return out
}

export function painStats(pain: PainLog, days: string[]) {
  const vals = days.map((d) => pain[d]).filter((v): v is number => v !== undefined)
  const first = days.slice(0, 7).map((d) => pain[d]).filter((v): v is number => v !== undefined)
  const last = days.slice(-7).map((d) => pain[d]).filter((v): v is number => v !== undefined)
  return { avg: mean(vals), firstWeek: mean(first), lastWeek: mean(last), n: vals.length }
}

/** Plain-language reading of r. */
export function describeR(r: number) {
  const a = Math.abs(r)
  const strength = a < 0.1 ? 'no clear' : a < 0.3 ? 'a weak' : a < 0.5 ? 'a moderate' : 'a strong'
  if (a < 0.1) return 'No clear link with next-morning pain'
  return `${strength[0].toUpperCase()}${strength.slice(1)} link with ${r < 0 ? 'lower' : 'higher'} next-morning pain`
}
