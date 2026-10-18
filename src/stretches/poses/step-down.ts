import type { Keyframe, StretchAnimation } from '../../body/pose'
import type { V3 } from '../../body/rig'
import { footFlat, handsOnHips, rootFromStance, type Keys } from './common'

/** Step-down stabilization: stand on the right leg on a step, bend the knee, lower the left foot in front. */
const STEP = 0.2
const FRONT = 0.12
const STANCE: V3 = [-0.08, STEP + 0.073, -0.08]

function hold(beta: number, kappa: number, lean: number, free: V3, freeDorsi: number): Keyframe {
  const root = rootFromStance(STANCE, beta, kappa)
  return {
    pelvis: { pos: [root[0] - 0.03, root[1], root[2]], rot: [lean * 0.5, 0, 0] },
    spine: { flex: lean * 0.5 },
    neck: { flex: -lean * 0.6 },
    legs: {
      R: { ...footFlat(-0.08, -0.035, STEP), knee: [0.05, 0, 1] },
      L: { ankle: free, knee: [0.05, 0, 1], angles: [freeDorsi, 0] },
    },
    arms: handsOnHips(),
  }
}

const keys: Keys = {
  stand: hold(3, 4, 3, [0.12, STEP + 0.073, -0.08], 0),
  lift: hold(14, 28, 12, [0.1, STEP + 0.13, 0.04], -5),
  hold: hold(28, 58, 22, [0.07, STEP + 0.02, FRONT + 0.06], -12),
  steady: hold(29, 60, 23, [0.07, STEP + 0.015, FRONT + 0.06], -12),
}

const anim: StretchAnimation = {
  id: 'step-down',
  props: [{ kind: 'step', pos: [0, 0, -0.32], size: [0.8, STEP, FRONT + 0.32] }],
  keys,
  enter: { keys: [['stand', 0], ['lift', 0.45], ['hold', 1]], duration: 1.8 },
  hold: { keys: [['hold', 0], ['steady', 1]] },
  exit: { keys: [['hold', 0], ['lift', 0.55], ['stand', 1]], duration: 1.6 },
  breathe: 0.6,
  camera: { yaw: -60, pitch: 10, distance: 2.4, target: [0, 0.75, 0] },
}
export default anim
