import type { Keyframe, StretchAnimation } from '../../body/pose'
import { footFlat, handsOnWall, type Keys } from './common'

/**
 * Intrinsic foot muscles ("short foot"): standing, hands on a wall. The arch domes while the toes
 * stay long. The MPFB foot has no arch joint, so the doming is shown as the foot rolling onto its
 * outer edge slightly with the toes pressing down (a visual approximation; see report).
 */
const WALL = 0.56
function dome(k: number): Keyframe {
  return {
    pelvis: { pos: [0, 0.94, -0.064], rot: [2, 0, 0] },
    spine: { flex: 3 },
    neck: { flex: 8 * k },
    legs: {
      R: { plant: { at: [-0.1, 0, 0.045], roll: 5 * k, pivot: 'flat' }, knee: [0, 0.1, 1], toes: [-6 * k, 12 * k] },
      L: footFlat(0.1, 0.045),
    },
    arms: handsOnWall(WALL, 1.36),
  }
}

const keys: Keys = { rest: dome(0), dome: dome(1) }

const anim: StretchAnimation = {
  id: 'intrinsic-foot',
  props: [{ kind: 'wall', pos: [0, 0, WALL] }],
  keys,
  enter: { keys: [['rest', 0], ['dome', 1]], duration: 1.3 },
  hold: { keys: [['dome', 0], ['dome', 1]] },
  exit: { keys: [['dome', 0], ['rest', 1]], duration: 1.1 },
  cycle: { keys: [['rest', 0], ['dome', 0.33], ['dome', 0.62], ['rest', 0.9], ['rest', 1]], seconds: 4 },
  breathe: 0.5,
  camera: { yaw: -70, pitch: 12, distance: 0.9, target: [-0.1, 0.06, 0.08] },
}
export default anim
