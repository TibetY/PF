import type { MuscleId } from '../body/muscles'

export type ExerciseId =
  | 'pf-stretch'
  | 'calf-straight'
  | 'calf-bent'
  | 'heel-raise'
  | 'ice'
  | 'step-down'
  | 'balance-eyes-closed'
  | 'side-plank-abduction'
  | 'posterior-lunge'
  | 'inversion-band'
  | 'intrinsic-foot'

/**
 * stretch     timed holds with short rests (original routine)
 * heel-raise  tempo reps
 * continuous  one long timed block
 * hold        timed holds organised in sets (physio strengthening)
 * reps        self-paced reps: you tap through them, rest between sets is timed
 */
export type ExerciseKind = 'stretch' | 'heel-raise' | 'continuous' | 'hold' | 'reps'

/** Exercise parameters. These come straight from the prescriptions: do not change them. */
export interface Exercise {
  id: ExerciseId
  name: string
  shortName: string
  group: 'routine' | 'physio'
  kind: ExerciseKind
  targetLabel: string
  /** Muscles worked/stretched most (strong highlight) and supporting muscles (soft highlight). */
  primary: MuscleId[]
  secondary: MuscleId[]
  /** Which side's muscles light up: the working side, or both (alternating/bilateral exercises). */
  highlightSides: 'working' | 'both'
  holdSec?: number
  /** Physio gave a range: you pick within it (stored per exercise). */
  holdRange?: [number, number]
  reps?: number
  repsRange?: [number, number]
  sets?: number
  tempo?: { up: number; top: number; down: number }
  durationSec?: number
  /** Rest between sets, seconds (default; adjustable). */
  setRestSec?: number
  /** False when the physio sheet didn't give a rest, so the default is the app's. */
  setRestPrescribed?: boolean
  /** Runs on both legs every time, regardless of the affected-foot setting. */
  eachLeg?: boolean
  /** Not tied to a side (e.g. alternating lunges). */
  unsided?: boolean
  perDay: number | null
  frequency: 'daily' | 'every-other-day' | 'after-activity' | 'before-run'
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
    group: 'routine',
    kind: 'stretch',
    targetLabel: 'Plantar fascia (arch)',
    primary: ['foot_flexors'],
    secondary: ['calves'],
    highlightSides: 'working',
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
    group: 'routine',
    kind: 'stretch',
    targetLabel: 'Upper calf (gastrocnemius)',
    primary: ['calves'],
    secondary: ['soleus', 'foot_flexors'],
    highlightSides: 'working',
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
    group: 'routine',
    kind: 'stretch',
    targetLabel: 'Lower calf (soleus)',
    primary: ['soleus'],
    secondary: ['calves', 'foot_flexors'],
    highlightSides: 'working',
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
    group: 'routine',
    kind: 'heel-raise',
    targetLabel: 'Plantar fascia (loaded via toe extension)',
    primary: ['calves', 'soleus'],
    secondary: ['foot_flexors'],
    highlightSides: 'working',
    reps: 12,
    sets: 3,
    tempo: { up: 3, top: 2, down: 3 },
    setRestSec: 120,
    setRestPrescribed: true,
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
    group: 'routine',
    kind: 'continuous',
    targetLabel: 'Plantar fascia (arch)',
    primary: ['foot_flexors'],
    secondary: [],
    highlightSides: 'working',
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

  // ---- physio program ----
  {
    id: 'step-down',
    name: 'Step down stabilization',
    shortName: 'Step down',
    group: 'physio',
    kind: 'hold',
    targetLabel: 'Hip & knee control (glutes, quads)',
    primary: ['quadriceps', 'abductors'],
    secondary: ['glutes', 'calves'],
    highlightSides: 'working',
    holdSec: 10,
    reps: 3,
    repsRange: [3, 5],
    sets: 1,
    eachLeg: true,
    perDay: null,
    frequency: 'before-run',
    dosage: '1 set × 3–5 reps · 10 s each leg',
    frequencyLabel: 'Before you run',
    steps: [
      'Stand on a step on one leg.',
      'Bend the standing knee and lower the other foot toward the floor in front of the step, keeping your hips level and knee over your toes.',
      'Hold steady for 10 seconds, then switch legs.',
    ],
    notes: [],
  },
  {
    id: 'balance-eyes-closed',
    name: '1 leg balance, eyes closed',
    shortName: 'Balance, eyes closed',
    group: 'physio',
    kind: 'hold',
    targetLabel: 'Foot & ankle stabilizers',
    primary: ['foot_flexors', 'soleus'],
    secondary: ['tibialis_anterior', 'abductors'],
    highlightSides: 'working',
    holdSec: 15,
    holdRange: [15, 60],
    reps: 1,
    sets: 4,
    setRestSec: 15,
    setRestPrescribed: false,
    perDay: 1,
    frequency: 'daily',
    dosage: '4 sets × 1 rep · 15–60 s',
    frequencyLabel: 'Once per day',
    steps: [
      'Stand on the affected leg near something you can grab if needed.',
      'Lift the other foot and close your eyes.',
      'Stay balanced for the whole hold. Build up from 15 s toward 60 s.',
    ],
    notes: ['Stand next to a counter or wall for safety.'],
  },
  {
    id: 'side-plank-abduction',
    name: 'Side plank, knee + abd.',
    shortName: 'Side plank + abd.',
    group: 'physio',
    kind: 'hold',
    targetLabel: 'Hip abductors (gluteus medius)',
    primary: ['abductors'],
    secondary: ['obliques', 'glutes'],
    highlightSides: 'working',
    holdSec: 10,
    reps: 5,
    sets: 3,
    setRestSec: 60,
    setRestPrescribed: true,
    perDay: 1,
    frequency: 'daily',
    dosage: '3 sets × 5 reps · hold 10 s',
    frequencyLabel: 'Once per day',
    steps: [
      'Lie on your side, propped on your forearm with the elbow under the shoulder and knees bent.',
      'Lift your hips so your body is in a straight line from knees to shoulders.',
      'Lift the top leg up and hold for 10 seconds. Lower and rest briefly.',
    ],
    notes: ['The side setting picks the top (lifted) leg.'],
  },
  {
    id: 'posterior-lunge',
    name: 'Posterior lunge',
    shortName: 'Posterior lunge',
    group: 'physio',
    kind: 'reps',
    targetLabel: 'Quads & glutes (front leg)',
    primary: ['quadriceps', 'glutes'],
    secondary: ['hamstrings', 'adductors', 'hip_flexors', 'calves'],
    highlightSides: 'both',
    reps: 10,
    sets: 3,
    setRestSec: 60,
    setRestPrescribed: true,
    unsided: true,
    perDay: 1,
    frequency: 'daily',
    dosage: '3 sets × 10 reps',
    frequencyLabel: 'Once per day',
    steps: [
      'Stand tall with your feet together.',
      'Step one leg back and lower until the back knee is just above the floor.',
      'Push through the front heel to return to standing. Tap +1 after each rep.',
    ],
    notes: ['Go at your own controlled pace; the animation shows the movement, not a required speed.'],
  },
  {
    id: 'inversion-band',
    name: 'Inversion, elastic, sitting',
    shortName: 'Inversion (band)',
    group: 'physio',
    kind: 'reps',
    targetLabel: 'Inverters (tibialis posterior)',
    primary: ['tibialis_anterior'],
    secondary: ['soleus'],
    highlightSides: 'working',
    reps: 10,
    sets: 3,
    setRestSec: 60,
    setRestPrescribed: true,
    perDay: 1,
    frequency: 'daily',
    dosage: '3 sets × 10 reps',
    frequencyLabel: 'Once per day',
    steps: [
      'Sit with the affected leg crossed over the other knee.',
      'Loop an elastic band around the forefoot and anchor it under your other foot.',
      'Turn the sole of your foot in and up against the band, then slowly return. Tap +1 after each rep.',
    ],
    notes: [],
  },
  {
    id: 'intrinsic-foot',
    name: 'Intrinsic foot muscle',
    shortName: 'Intrinsic foot',
    group: 'physio',
    kind: 'reps',
    targetLabel: 'Arch muscles (foot intrinsics)',
    primary: ['foot_flexors'],
    secondary: ['tibialis_anterior'],
    highlightSides: 'working',
    reps: 10,
    sets: 3,
    setRestSec: 60,
    setRestPrescribed: false,
    perDay: 1,
    frequency: 'daily',
    dosage: '3 sets × 10 reps',
    frequencyLabel: 'Once per day',
    steps: [
      'Stand with your hands on a wall for balance.',
      'Keeping your toes long and flat, draw the ball of your foot toward your heel so the arch lifts ("short foot").',
      'Relax and repeat. Tap +1 after each rep.',
    ],
    notes: [],
  },
]

export const EXERCISE_BY_ID: Record<ExerciseId, Exercise> = Object.fromEntries(
  EXERCISES.map((e) => [e.id, e]),
) as Record<ExerciseId, Exercise>
