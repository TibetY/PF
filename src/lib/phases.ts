import type { Exercise } from '../data/exercises'
import type { Settings, Side } from './settings'
import { sidesFor } from './settings'

export type PhaseKind =
  | 'prep' // get into position
  | 'hold' // stretch hold
  | 'rest' // rest between stretch reps
  | 'up' // heel raise, rising
  | 'top' // heel raise, hold at top
  | 'down' // heel raise, lowering
  | 'set-rest' // rest between heel-raise sets
  | 'switch' // switching feet
  | 'massage' // continuous ice massage

export interface Phase {
  kind: PhaseKind
  label: string
  /** Spoken cue at phase start. */
  cue: string
  duration: number
  side: Side
  rep: number
  reps: number
  set: number
  sets: number
}

const sideName = (s: Side) => (s === 'left' ? 'left' : 'right')

/** Expands an exercise into the timed sequence of phases, using its exact parameters. */
export function buildPhases(ex: Exercise, settings: Settings): Phase[] {
  const sides = sidesFor(settings.foot)
  const out: Phase[] = []
  const reps = ex.reps ?? 1
  const sets = ex.sets ?? 1

  sides.forEach((side, si) => {
    const base = { side, reps, sets }
    if (si === 0) {
      out.push({
        ...base, kind: 'prep', label: 'Get in position', rep: 1, set: 1, duration: settings.prepSec,
        cue: sides.length > 1 ? `Get in position. ${sideName(side)} foot first.` : 'Get in position.',
      })
    } else {
      out.push({
        ...base, kind: 'switch', label: `Switch to ${sideName(side)} foot`, rep: 1, set: 1,
        duration: settings.switchSec, cue: `Switch to your ${sideName(side)} foot.`,
      })
    }

    if (ex.kind === 'stretch') {
      for (let r = 1; r <= reps; r++) {
        out.push({ ...base, kind: 'hold', label: 'Hold', cue: `Rep ${r}. Hold.`, duration: ex.holdSec!, rep: r, set: 1 })
        if (r < reps) {
          out.push({ ...base, kind: 'rest', label: 'Rest', cue: 'Rest.', duration: settings.stretchRestSec, rep: r, set: 1 })
        }
      }
    } else if (ex.kind === 'heel-raise') {
      const t = ex.tempo!
      for (let s = 1; s <= sets; s++) {
        for (let r = 1; r <= reps; r++) {
          out.push({ ...base, kind: 'up', label: 'Up', cue: r === 1 ? `Set ${s}. Up.` : 'Up', duration: t.up, rep: r, set: s })
          out.push({ ...base, kind: 'top', label: 'Hold at top', cue: 'Hold', duration: t.top, rep: r, set: s })
          out.push({ ...base, kind: 'down', label: 'Down', cue: 'Down', duration: t.down, rep: r, set: s })
        }
        if (s < sets) {
          out.push({ ...base, kind: 'set-rest', label: 'Rest', cue: `Set ${s} done. Rest.`, duration: settings.setRestSec, rep: reps, set: s })
        }
      }
    } else {
      out.push({ ...base, kind: 'massage', label: 'Roll your arch', cue: 'Roll your arch back and forth over the bottle.', duration: ex.durationSec!, rep: 1, set: 1 })
    }
  })
  return out
}

export const isWorkPhase = (k: PhaseKind) => k === 'hold' || k === 'up' || k === 'top' || k === 'down' || k === 'massage'
