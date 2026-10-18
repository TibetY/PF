export type ExerciseId = 'pf-stretch' | 'calf-straight' | 'calf-bent' | 'heel-raise' | 'ice'

export type TargetTissue = 'fascia' | 'gastrocnemius' | 'soleus'

/** Exercise parameters. These come straight from the prescribed routine: do not change them. */
export interface Exercise {
  id: ExerciseId
  name: string
  shortName: string
  kind: 'stretch' | 'heel-raise' | 'continuous'
  target: TargetTissue
  targetLabel: string
  /** Stretches: seconds per hold. */
  holdSec?: number
  reps?: number
  sets?: number
  /** Heel raises: tempo in seconds. */
  tempo?: { up: number; top: number; down: number }
  /** Continuous exercises: total seconds. */
  durationSec?: number
  /** Sessions per day, or null when not scheduled daily. */
  perDay: number | null
  frequency: 'daily' | 'every-other-day' | 'after-activity'
  dosage: string
  frequencyLabel: string
  steps: string[]
  notes: string[]
}

export const EXERCISES: Exercise[] = [
  {
    id: 'pf-stretch',
    name: 'Plantar fascia stretch',
    shortName: 'Fascia stretch',
    kind: 'stretch',
    target: 'fascia',
    targetLabel: 'Plantar fascia (arch)',
    holdSec: 10,
    reps: 10,
    sets: 1,
    perDay: 3,
    frequency: 'daily',
    dosage: 'Hold 10 s × 10 reps',
    frequencyLabel: '3 times per day',
    steps: [
      'Sit down. Cross the affected foot over the opposite knee.',
      'Grab your toes and pull them back toward your shin.',
      'Stop when you feel a stretch in the arch, then hold.',
      'Let go and relax between reps.',
    ],
    notes: ['Do the first session before getting out of bed in the morning.'],
  },
  {
    id: 'calf-straight',
    name: 'Calf stretch, straight knee',
    shortName: 'Calf (straight knee)',
    kind: 'stretch',
    target: 'gastrocnemius',
    targetLabel: 'Upper calf (gastrocnemius)',
    holdSec: 30,
    reps: 3,
    sets: 1,
    perDay: 2,
    frequency: 'daily',
    dosage: 'Hold 30 s × 3 reps',
    frequencyLabel: '2 times per day',
    steps: [
      'Face a wall with your hands on it.',
      'Step the affected leg back. Keep that knee straight and the heel flat on the floor.',
      'Lean forward until you feel the stretch in the upper calf, then hold.',
      'Ease off between reps.',
    ],
    notes: [],
  },
  {
    id: 'calf-bent',
    name: 'Calf stretch, bent knee',
    shortName: 'Calf (bent knee)',
    kind: 'stretch',
    target: 'soleus',
    targetLabel: 'Lower calf (soleus)',
    holdSec: 30,
    reps: 3,
    sets: 1,
    perDay: 2,
    frequency: 'daily',
    dosage: 'Hold 30 s × 3 reps',
    frequencyLabel: '2 times per day',
    steps: [
      'Same position as the straight-knee stretch: face the wall, affected leg back.',
      'Bend the back knee slightly while keeping the heel down.',
      'You should feel the stretch move lower in the calf. Hold.',
      'Ease off between reps.',
    ],
    notes: [],
  },
  {
    id: 'heel-raise',
    name: 'High-load heel raises',
    shortName: 'Heel raises',
    kind: 'heel-raise',
    target: 'fascia',
    targetLabel: 'Plantar fascia (loaded via toe extension)',
    reps: 12,
    sets: 3,
    tempo: { up: 3, top: 2, down: 3 },
    perDay: 1,
    frequency: 'every-other-day',
    dosage: '3 sets × 12 reps · 3 s up, 2 s hold, 3 s down',
    frequencyLabel: 'Every other day',
    steps: [
      'Stand on the affected leg on a step, with a rolled towel under your toes so they are pulled up.',
      'Let your heel hang off the edge. A light hand on the wall for balance is fine.',
      'Rise up for 3 seconds, hold at the top for 2 seconds, lower for 3 seconds.',
      'Rest between sets.',
    ],
    notes: ['When 12 reps feel easy, add weight: wear a backpack with books in it.'],
  },
  {
    id: 'ice',
    name: 'Ice massage',
    shortName: 'Ice massage',
    kind: 'continuous',
    target: 'fascia',
    targetLabel: 'Plantar fascia (arch)',
    durationSec: 10 * 60,
    perDay: null,
    frequency: 'after-activity',
    dosage: '10 minutes',
    frequencyLabel: 'After activity',
    steps: [
      'Sit down with a frozen water bottle on the floor.',
      'Roll the arch of your foot back and forth over the bottle.',
      'Keep it going for the full 10 minutes.',
    ],
    notes: ['Do this after activity.'],
  },
]

export const EXERCISE_BY_ID: Record<ExerciseId, Exercise> = Object.fromEntries(
  EXERCISES.map((e) => [e.id, e]),
) as Record<ExerciseId, Exercise>
