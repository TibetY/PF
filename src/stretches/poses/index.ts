import type { ExerciseId } from '../../data/exercises'
import type { StretchAnimation } from '../../body/pose'
import balance from './balance-eyes-closed'
import calfBent from './calf-bent'
import calfStraight from './calf-straight'
import heelRaise from './heel-raise'
import ice from './ice'
import intrinsic from './intrinsic-foot'
import inversion from './inversion-band'
import pfStretch from './pf-stretch'
import lunge from './posterior-lunge'
import sidePlank from './side-plank-abduction'
import stepDown from './step-down'

export const POSES: Record<ExerciseId, StretchAnimation> = {
  'pf-stretch': pfStretch,
  'calf-straight': calfStraight,
  'calf-bent': calfBent,
  'heel-raise': heelRaise,
  ice,
  'step-down': stepDown,
  'balance-eyes-closed': balance,
  'side-plank-abduction': sidePlank,
  'posterior-lunge': lunge,
  'inversion-band': inversion,
  'intrinsic-foot': intrinsic,
}
