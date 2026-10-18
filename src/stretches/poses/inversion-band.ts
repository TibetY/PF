import type { Keyframe, StretchAnimation } from '../../body/pose'
import { SEATED_ROOT, footFlat, handsOnThighs, type Keys } from './common'

/** Seated inversion against a band: right leg crossed over the left knee, sole turns in and up. */
function invert(amount: number): Keyframe {
  return {
    pelvis: { pos: SEATED_ROOT, rot: [-4, 0, 0] },
    spine: { flex: 8 },
    neck: { flex: 16 },
    legs: {
      L: footFlat(0.12, 0.405, 0, 4),
      R: { ankle: [0.03, 0.27, 0.5], knee: [0.7, 0.7, 0.8], angles: [-15, 32 * amount] },
    },
    arms: {
      L: handsOnThighs().L,
      // right hand rests on the crossed knee, steadying the leg
      R: {
        wrist: { bone: 'lowerleg01R', offset: [0.01, -0.06, 0.075] },
        elbow: [-0.8, -0.4, -0.3],
        hand: { bone: 'lowerleg01R', fingers: [1, -0.3, 0], palm: [0, 0, -1] },
        shape: 'relaxed',
      },
    },
  }
}

const keys: Keys = { rest: invert(0), turned: invert(1) }

const anim: StretchAnimation = {
  id: 'inversion-band',
  props: [{ kind: 'chair', pos: [0, 0, -0.06] }, { kind: 'band', pos: [0, 0, 0] }],
  keys,
  enter: { keys: [['rest', 0], ['turned', 1]], duration: 1.1 },
  hold: { keys: [['turned', 0], ['turned', 1]] },
  exit: { keys: [['turned', 0], ['rest', 1]], duration: 1.1 },
  cycle: { keys: [['rest', 0], ['turned', 0.33], ['turned', 0.5], ['rest', 0.85], ['rest', 1]], seconds: 3.2 },
  breathe: 0.5,
  camera: { yaw: 35, pitch: 14, distance: 1.25, target: [0.03, 0.25, 0.45] },
}
export default anim
