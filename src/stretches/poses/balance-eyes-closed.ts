import type { Keyframe, StretchAnimation } from '../../body/pose'
import type { V3 } from '../../body/rig'
import { armsRelaxed, footFlat, type Keys } from './common'

/** One-leg balance with eyes closed: stand on the right foot, left foot lifted. */
function stand(lift: number, sway: number): Keyframe {
  const free: V3 = lift ? [0.12, 0.29, -0.1] : [0.09, 0.073, 0]
  return {
    pelvis: { pos: [-0.01 + sway * 0.006, 0.945, -0.04 + sway * 0.004], rot: [0, 0, -2 * lift] },
    spine: { flex: 2, side: 2 * lift },
    legs: {
      R: footFlat(-0.09, 0.045),
      L: { ankle: free, knee: [0, 0, 1], angles: [-15 * lift, 0] },
    },
    arms: armsRelaxed(0.27 + 0.08 * lift),
    eyes: 1 - lift,
  }
}

const keys: Keys = { rest: stand(0, 0), balance: stand(1, 0), swayL: stand(1, 1), swayR: stand(1, -1) }

const anim: StretchAnimation = {
  id: 'balance-eyes-closed',
  props: [],
  keys,
  enter: { keys: [['rest', 0], ['balance', 1]], duration: 1.5 },
  // slow, small corrective sway while balancing
  hold: { keys: [['balance', 0], ['swayL', 0.25], ['swayR', 0.75], ['balance', 1]] },
  exit: { keys: [['balance', 0], ['rest', 1]], duration: 1.2 },
  breathe: 0.6,
  camera: { yaw: -35, pitch: 12, distance: 2.6, target: [0, 0.85, 0] },
}
export default anim
