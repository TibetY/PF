import type { Keyframe, StretchAnimation } from '../../body/pose'
import { footFlat, handsOnWall, rootFromStance, type Keys } from './common'

/** Wall calf stretch, bent back knee (soleus): same stance, back knee bends, heel stays down. */
const WALL = 0.8
const BACK: [number, number, number] = [-0.11, 0.073, 0]

function sink(beta: number, kappa: number, lean: number, handY: number): Keyframe {
  return {
    pelvis: { pos: rootFromStance(BACK, beta, kappa), rot: [lean * 0.4, 0, 0] },
    spine: { flex: lean * 0.6 },
    neck: { flex: -lean * 0.7 },
    legs: { R: footFlat(-0.11, 0.045), L: { ...footFlat(0.11, 0.365), knee: [0.1, 0, 1] } },
    arms: handsOnWall(WALL, handY),
  }
}

const keys: Keys = {
  rest: sink(18, 14, 12, 1.33),
  stretch: sink(32, 34, 14, 1.27),
  deep: sink(34, 38, 14, 1.26),
}

const anim: StretchAnimation = {
  id: 'calf-bent',
  props: [{ kind: 'wall', pos: [0, 0, WALL] }],
  keys,
  enter: { keys: [['rest', 0], ['stretch', 1]], duration: 1.6 },
  hold: { keys: [['stretch', 0], ['deep', 1]] },
  exit: { keys: [['stretch', 0], ['rest', 1]], duration: 1.4 },
  breathe: 1,
  camera: { yaw: -100, pitch: 5, distance: 1.5, target: [-0.11, 0.25, 0.05] },
}
export default anim
