/**
 * Canonical muscle groups. The ORDER is a contract with tools/model/muscle_ids.py:
 * vertex attribute value = 1 + index * 2 + (0 = body's left, 1 = body's right); 0 = none.
 */
export const MUSCLES = [
  'hamstrings', 'quadriceps', 'hip_flexors', 'glutes', 'adductors', 'abductors', 'it_band',
  'piriformis', 'calves', 'soleus', 'tibialis_anterior', 'foot_flexors', 'lower_back', 'lats',
  'upper_back', 'traps', 'neck', 'chest', 'front_delts', 'side_delts', 'rear_delts', 'biceps',
  'triceps', 'forearm_flexors', 'forearm_extensors', 'abs', 'obliques',
] as const

export type MuscleId = (typeof MUSCLES)[number]
export type BodySide = 'left' | 'right'

export const muscleCode = (m: MuscleId, side: BodySide) => 1 + MUSCLES.indexOf(m) * 2 + (side === 'left' ? 0 : 1)
export const MUSCLE_CODES = 64 // size of the shader's uniform arrays (max code is 54)

export const MUSCLE_LABELS: Record<MuscleId, string> = {
  hamstrings: 'Hamstrings', quadriceps: 'Quadriceps', hip_flexors: 'Hip flexors (iliopsoas, sartorius)',
  glutes: 'Gluteus maximus', adductors: 'Adductors (inner thigh)', abductors: 'Hip abductors (glute medius/minimus, TFL)',
  it_band: 'IT band', piriformis: 'Piriformis', calves: 'Calf (gastrocnemius)', soleus: 'Soleus (lower calf)',
  tibialis_anterior: 'Tibialis anterior', foot_flexors: 'Plantar fascia & foot muscles', lower_back: 'Lower back (erector spinae)',
  lats: 'Latissimus dorsi', upper_back: 'Upper back (rhomboids, rotator cuff)', traps: 'Trapezius', neck: 'Neck',
  chest: 'Chest (pectorals)', front_delts: 'Front deltoid', side_delts: 'Side deltoid', rear_delts: 'Rear deltoid',
  biceps: 'Biceps', triceps: 'Triceps', forearm_flexors: 'Forearm flexors', forearm_extensors: 'Forearm extensors',
  abs: 'Abdominals', obliques: 'Obliques',
}

/** For the SVG fallback (react-body-highlighter's vocabulary). */
export const SVG_MUSCLE: Partial<Record<MuscleId, string[]>> = {
  hamstrings: ['hamstring'], quadriceps: ['quadriceps'], hip_flexors: ['quadriceps'], glutes: ['gluteal'],
  adductors: ['adductor'], abductors: ['abductors'], it_band: ['abductors'], piriformis: ['gluteal'],
  calves: ['calves'], soleus: ['left-soleus', 'right-soleus'], tibialis_anterior: ['calves'], foot_flexors: ['calves'],
  lower_back: ['lower-back'], lats: ['upper-back'], upper_back: ['upper-back'], traps: ['trapezius'], neck: ['neck'],
  chest: ['chest'], front_delts: ['front-deltoids'], side_delts: ['front-deltoids', 'back-deltoids'], rear_delts: ['back-deltoids'],
  biceps: ['biceps'], triceps: ['triceps'], forearm_flexors: ['forearm'], forearm_extensors: ['forearm'],
  abs: ['abs'], obliques: ['obliques'],
}

/** Whether a muscle is mostly seen from the back (for choosing the SVG view and camera side). */
export const POSTERIOR: Partial<Record<MuscleId, true>> = {
  hamstrings: true, glutes: true, piriformis: true, calves: true, soleus: true, lower_back: true, lats: true,
  upper_back: true, traps: true, rear_delts: true, triceps: true,
}

/** Muscle fibre direction in the body's rest pose (model space, +Y up, +Z forward), for the anatomy view. */
export const FIBRE_DIR: Record<MuscleId, [number, number, number]> = {
  hamstrings: [0, 1, 0], quadriceps: [0, 1, 0], hip_flexors: [0.3, 1, 0.2], glutes: [0.8, 0.6, 0],
  adductors: [0.4, 1, 0], abductors: [0.2, 1, 0], it_band: [0, 1, 0], piriformis: [1, 0.2, 0],
  calves: [0, 1, 0], soleus: [0, 1, 0], tibialis_anterior: [0, 1, 0], foot_flexors: [0, 0, 1],
  lower_back: [0, 1, 0], lats: [0.6, 1, 0], upper_back: [1, 0.3, 0], traps: [1, 0.5, 0], neck: [0.3, 1, 0.3],
  chest: [1, 0.2, 0], front_delts: [0, 1, 0.3], side_delts: [0.2, 1, 0], rear_delts: [0, 1, -0.3],
  biceps: [0, 1, 0], triceps: [0, 1, 0], forearm_flexors: [0, 1, 0], forearm_extensors: [0, 1, 0],
  abs: [0, 1, 0], obliques: [0.7, 1, 0.3],
}
