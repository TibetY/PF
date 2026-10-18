import type { Keyframe, StretchAnimation } from '../../body/pose'
import type { V3 } from '../../body/rig'
import type { Keys } from './common'

/**
 * Side plank from the knees with hip abduction. Lying on the LEFT side so the right (working) leg
 * is on top. Knees bent with the shins behind; hips lift into a straight line knee-to-shoulder,
 * then the top leg straightens and lifts.
 */
const KNEE: V3 = [-0.42, 0.05, 0]
const THIGH = 0.434

function plank(theta: number, bend: number, legUp: number): Keyframe {
  const r = Math.PI / 180
  const hip: V3 = [KNEE[0] + THIGH * Math.cos(theta * r), KNEE[1] + THIGH * Math.sin(theta * r), 0]
  // top leg: resting on the bottom leg, or straight and abducted ~28 degrees
  const abd = 28 * r
  const lifted: V3 = [hip[0] - 0.875 * Math.cos(abd - theta * r), hip[1] + 0.22 + 0.875 * Math.sin(abd - theta * r), 0.02]
  const resting: V3 = [KNEE[0] + 0.04, 0.16, -0.42]
  const top: V3 = resting.map((c, i) => c + (lifted[i] - c) * legUp) as V3
  return {
    pelvis: { hip: { side: 'L', at: hip }, rot: [0, 0, 90 - theta] },
    spine: { side: -bend },
    neck: { side: bend * 0.5 },
    legs: {
      L: { ankle: [KNEE[0] + 0.04, 0.05, -0.42], knee: [-0.3, 0, 1], angles: [-20, 0] },
      R: { ankle: top, knee: [-0.3, 0.2 * legUp, 1], angles: [-20 + 10 * legUp, 0] },
    },
    arms: {
      // bottom forearm flat on the mat, elbow under the shoulder
      L: { wrist: { bone: 'upperarm01L', offset: [0.02, -0.29, 0.24], frame: 'world' }, elbow: [0, -1, -0.3], hand: { fingers: [0, 0, 1], palm: [0, -1, 0] }, shape: 'flat' },
      // top hand on the hip
      R: { wrist: { bone: 'root', offset: [-0.17, 0.1, 0.05] }, elbow: [0.4, 1, -0.6], hand: { bone: 'root', fingers: [0.2, -1, 0.5], palm: [1, 0, 0] }, shape: 'relaxed' },
    },
  }
}

const keys: Keys = {
  down: plank(3, 30, 0),
  hipsUp: plank(19, 0, 0),
  up: plank(19, 0, 1),
  upHigh: plank(20, 0, 1.06),
}

const anim: StretchAnimation = {
  id: 'side-plank-abduction',
  props: [{ kind: 'mat', pos: [0.05, 0, -0.1], size: [1.9, 0.008, 0.75] }],
  keys,
  enter: { keys: [['down', 0], ['hipsUp', 0.55], ['up', 1]], duration: 2 },
  hold: { keys: [['up', 0], ['upHigh', 1]] },
  exit: { keys: [['up', 0], ['hipsUp', 0.45], ['down', 1]], duration: 1.8 },
  breathe: 0.8,
  camera: { yaw: 0, pitch: 18, distance: 2.3, target: [0, 0.3, 0] },
}
export default anim
