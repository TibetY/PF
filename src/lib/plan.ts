import { EXERCISES, type ExerciseId } from '../data/exercises'
import { addDays, daysBetween, type SessionLog } from './storage'

export type DueStatus =
  | { kind: 'daily'; done: number; target: number }
  | { kind: 'alt-due'; done: number; lastDate: string | null }
  | { kind: 'alt-rest'; nextDate: string }
  | { kind: 'alt-done' }
  | { kind: 'as-needed'; done: number }

export function countOn(log: SessionLog[], id: ExerciseId, date: string) {
  return log.filter((e) => e.exerciseId === id && e.date === date).length
}

/** Heel raises: due when the last completed session was 2+ days ago (or never). */
export function heelRaiseStatus(log: SessionLog[], today: string): DueStatus {
  if (countOn(log, 'heel-raise', today) > 0) return { kind: 'alt-done' }
  const last = log
    .filter((e) => e.exerciseId === 'heel-raise' && e.date < today)
    .map((e) => e.date)
    .sort()
    .pop()
  if (!last || daysBetween(last, today) >= 2) return { kind: 'alt-due', done: 0, lastDate: last ?? null }
  return { kind: 'alt-rest', nextDate: addDays(last, 2) }
}

export function statusFor(log: SessionLog[], id: ExerciseId, today: string): DueStatus {
  const ex = EXERCISES.find((e) => e.id === id)!
  if (ex.frequency === 'daily') return { kind: 'daily', done: countOn(log, id, today), target: ex.perDay! }
  if (ex.frequency === 'every-other-day') return heelRaiseStatus(log, today)
  return { kind: 'as-needed', done: countOn(log, id, today) } // after activity / before running
}

export function isDueNow(s: DueStatus) {
  return (s.kind === 'daily' && s.done < s.target) || s.kind === 'alt-due'
}

/**
 * A day is complete when every daily stretch hit its target and heel raises were
 * done that day or the day before (i.e. they were not overdue).
 */
export function dayCompletion(log: SessionLog[], date: string): 'none' | 'partial' | 'full' {
  const any = log.some((e) => e.date === date)
  if (!any) return 'none'
  const dailyOk = EXERCISES.filter((e) => e.frequency === 'daily').every(
    (e) => countOn(log, e.id, date) >= e.perDay!,
  )
  const heelOk = countOn(log, 'heel-raise', date) > 0 || countOn(log, 'heel-raise', addDays(date, -1)) > 0
  return dailyOk && heelOk ? 'full' : 'partial'
}

/** Consecutive days (ending today, or yesterday if today isn't finished yet) matching `pred`. */
export function streak(today: string, pred: (date: string) => boolean): number {
  let d = pred(today) ? today : addDays(today, -1)
  let n = 0
  while (pred(d)) {
    n++
    d = addDays(d, -1)
  }
  return n
}
