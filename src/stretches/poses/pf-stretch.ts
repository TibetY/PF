import type { StretchAnimation } from '../../body/pose'
import { SEATED_ROOT, footFlat, type Keys } from './common'

/** Seated plantar fascia stretch: right ankle over the left knee, hand pulls the toes back. */
const crossed = (dorsi: number, toes: number) => ({
  ankle: [0.1, 0.645, 0.25] as [number, number, number],
  knee: [-1, -0.35, 0.35] as [number, number, number],
  angles: [dorsi, 18] as [number, number],
  toes: [toes, 0] as [number, number],
})

const base = (lean: number, dorsi: number, toes: number, grip: 'relaxed' | 'grip') => ({
  pelvis: { pos: SEATED_ROOT, rot: [-4, 0, 0] as [number, number, number] },
  spine: { flex: 4 + lean, twist: 16 },
  neck: { flex: 12, twist: -6 },
  legs: { L: footFlat(0.13, 0.4, 0, 6), R: crossed(dorsi, toes) },
  arms: {
    // right hand wraps the toes from the sole side and pulls them toward the shin
    R: {
      wrist: { bone: 'toe2-1R', offset: [0.1, -0.045, 0.03] as [number, number, number] },
      elbow: [-0.7, -0.5, -0.4] as [number, number, number],
      hand: { bone: 'toe2-1R', fingers: [-1, 0, 0.1] as [number, number, number], palm: [0, 1, 0] as [number, number, number] },
      shape: grip,
    },
    // left hand steadies the shin above the ankle
    L: {
      wrist: { bone: 'lowerleg01R', offset: [0.09, -0.27, 0.07] as [number, number, number] },
      elbow: [0.9, -0.3, -0.4] as [number, number, number],
      hand: { bone: 'lowerleg01R', fingers: [-1, 0, 0] as [number, number, number], palm: [0, 0, -1] as [number, number, number] },
      shape: 'grip' as const,
    },
  },
})

const keys: Keys = {
  rest: base(26, -12, 5, 'relaxed'),
  stretch: base(31, 12, 60, 'grip'),
  deep: base(33, 15, 68, 'grip'),
}

const anim: StretchAnimation = {
  id: 'pf-stretch',
  props: [{ kind: 'chair', pos: [0, 0, -0.06] }],
  keys,
  enter: { keys: [['rest', 0], ['stretch', 1]], duration: 1.4 },
  hold: { keys: [['stretch', 0], ['deep', 1]] },
  exit: { keys: [['stretch', 0], ['rest', 1]], duration: 1.2 },
  breathe: 1.2,
  camera: { yaw: 50, pitch: 18, distance: 1.1 },
}
export default anim
