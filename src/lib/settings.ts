import type { Exercise } from '../data/exercises'

export type Foot = 'left' | 'right' | 'both'
export type Side = 'left' | 'right'
export type Theme = 'system' | 'light' | 'dark'

export interface Settings {
  foot: Foot
  /** Rest between stretch reps, seconds. */
  stretchRestSec: number
  /** Rest between heel-raise sets, seconds. */
  setRestSec: number
  /** "Get in position" countdown before starting, seconds. */
  prepSec: number
  /** Time to switch feet when doing both sides, seconds. */
  switchSec: number
  beeps: boolean
  voice: boolean
  theme: Theme
  /** Which body the 3D model shows. */
  bodyModel: 'male' | 'female'
  /** Muscle-fibre look on the highlighted muscles. */
  anatomyView: boolean
  /** Per-exercise rest between sets (physio exercises), seconds. */
  setRestById: Record<string, number>
  /** Choices within a prescribed range (reps for step-down, hold for balance). */
  choices: Record<string, { reps?: number; holdSec?: number }>
}

export const DEFAULT_SETTINGS: Settings = {
  foot: 'right',
  stretchRestSec: 5,
  setRestSec: 120,
  prepSec: 10,
  switchSec: 10,
  beeps: true,
  voice: false,
  theme: 'system',
  bodyModel: 'female',
  anatomyView: false,
  setRestById: {},
  choices: {},
}

export function sidesFor(foot: Foot): Side[] {
  return foot === 'both' ? ['right', 'left'] : [foot]
}


export function setRestFor(ex: Exercise, s: Settings): number {
  if (ex.id === 'heel-raise') return s.setRestSec
  return s.setRestById[ex.id] ?? ex.setRestSec ?? 60
}
export function repsFor(ex: Exercise, s: Settings): number {
  return s.choices[ex.id]?.reps ?? ex.reps ?? 1
}
export function holdFor(ex: Exercise, s: Settings): number {
  return s.choices[ex.id]?.holdSec ?? ex.holdSec ?? 0
}
/** Sides an exercise runs on, given the affected-foot setting. */
export function exerciseSides(ex: Exercise, foot: Foot): Side[] {
  if (ex.unsided || ex.eachLeg) return ['right']
  return sidesFor(foot)
}
