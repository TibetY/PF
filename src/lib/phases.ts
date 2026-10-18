import type { Exercise } from '../data/exercises'
import type { Settings, Side } from './settings'
import { exerciseSides, holdFor, repsFor, setRestFor } from './settings'

export type PhaseKind =
  | 'prep' // get into position
  | 'hold' // timed hold (stretch or strength)
  | 'rest' // rest between reps
  | 'up' // heel raise, rising
  | 'top' // heel raise, hold at top
  | 'down' // heel raise, lowering
  | 'set-rest' // rest between sets
  | 'switch' // switching feet / legs
  | 'massage' // continuous ice massage
  | 'reps' // self-paced reps, untimed: you tap through them

export interface Phase {
  kind: PhaseKind
  label: string
  /** Spoken cue at phase start. */
  cue: string
  /** Seconds. Ignored for untimed phases. */
  duration: number
  /** Untimed phases wait for the user (self-paced reps). */
  untimed?: boolean
  side: Side
  rep: number
  reps: number
  set: number
  sets: number
}

const sideName = (s: Side) => (s === 'left' ? 'left' : 'right')

/** Expands an exercise into the timed sequence of phases, using its exact parameters. */
export function buildPhases(ex: Exercise, settings: Settings): Phase[] {
  const sides = exerciseSides(ex, settings.foot)
  const out: Phase[] = []
  const reps = repsFor(ex, settings)
  const sets = ex.sets ?? 1
  const hold = holdFor(ex, settings)
  const setRest = setRestFor(ex, settings)

  sides.forEach((side, si) => {
    const base = { side, reps, sets }
    if (si === 0) {
      const firstSide = ex.eachLeg ? 'right' : side
      out.push({
        ...base, side: firstSide, kind: 'prep', label: 'Get in position', rep: 1, set: 1, duration: settings.prepSec,
        cue: sides.length > 1 || ex.eachLeg ? `Get in position. ${sideName(firstSide)} leg first.` : 'Get in position.',
      })
    } else {
      out.push({
        ...base, kind: 'switch', label: `Switch to ${sideName(side)} foot`, rep: 1, set: 1,
        duration: settings.switchSec, cue: `Switch to your ${sideName(side)} foot.`,
      })
    }

    if (ex.kind === 'stretch') {
      for (let r = 1; r <= reps; r++) {
        out.push({ ...base, kind: 'hold', label: 'Hold', cue: `Rep ${r}. Hold.`, duration: hold, rep: r, set: 1 })
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
          out.push({ ...base, kind: 'set-rest', label: 'Rest', cue: `Set ${s} done. Rest.`, duration: setRest, rep: reps, set: s })
        }
      }
    } else if (ex.kind === 'hold') {
      for (let s = 1; s <= sets; s++) {
        for (let r = 1; r <= reps; r++) {
          if (ex.eachLeg) {
            // every rep: right leg, short switch, left leg
            out.push({ ...base, side: 'right', kind: 'hold', label: 'Hold · right leg', cue: `Rep ${r}. Right leg. Hold.`, duration: hold, rep: r, set: s })
            out.push({ ...base, side: 'right', kind: 'switch', label: 'Switch legs', cue: 'Switch legs.', duration: settings.stretchRestSec, rep: r, set: s })
            out.push({ ...base, side: 'left', kind: 'hold', label: 'Hold · left leg', cue: 'Left leg. Hold.', duration: hold, rep: r, set: s })
            if (r < reps) out.push({ ...base, side: 'left', kind: 'rest', label: 'Rest', cue: 'Rest.', duration: settings.stretchRestSec, rep: r, set: s })
          } else {
            const cue = reps > 1 ? `Rep ${r}. Hold.` : `Set ${s}. Hold.`
            out.push({ ...base, kind: 'hold', label: 'Hold', cue, duration: hold, rep: r, set: s })
            if (r < reps) out.push({ ...base, kind: 'rest', label: 'Rest', cue: 'Rest.', duration: settings.stretchRestSec, rep: r, set: s })
          }
        }
        if (s < sets) {
          out.push({ ...base, kind: 'set-rest', label: 'Rest', cue: `Set ${s} done. Rest.`, duration: setRest, rep: reps, set: s })
        }
      }
    } else if (ex.kind === 'reps') {
      for (let s = 1; s <= sets; s++) {
        out.push({
          ...base, kind: 'reps', label: `Do ${reps} reps`, cue: `Set ${s}. ${reps} reps at your own pace.`,
          duration: 0, untimed: true, rep: 0, set: s,
        })
        if (s < sets) {
          out.push({ ...base, kind: 'set-rest', label: 'Rest', cue: `Set ${s} done. Rest.`, duration: setRest, rep: reps, set: s })
        }
      }
    } else {
      out.push({ ...base, kind: 'massage', label: 'Roll your arch', cue: 'Roll your arch back and forth over the bottle.', duration: ex.durationSec!, rep: 1, set: 1 })
    }
  })
  return out
}

export const isWorkPhase = (k: PhaseKind) =>
  k === 'hold' || k === 'up' || k === 'top' || k === 'down' || k === 'massage' || k === 'reps'

/** Total timed seconds (self-paced sets excluded). */
export const timedSeconds = (phases: Phase[]) => phases.reduce((a, p) => a + (p.untimed ? 0 : p.duration), 0)
