import type { Keyframe, StretchAnimation } from '../../body/pose'
import { footFlat, handsOnWall, rootFromStance, type Keys } from './common'

/** Wall calf stretch, straight back knee: right leg back, heel flat, lean in. */
const WALL = 0.8
const BACK: [number, number, number] = [-0.11, 0.073, 0]

function lean(beta: number, kappa: number, handY: number): Keyframe {
  const trunk = beta * 0.6
  return {
    pelvis: { pos: rootFromStance(BACK, beta, kappa), rot: [trunk * 0.4, 0, 0] },
    spine: { flex: trunk * 0.6 },
    neck: { flex: -trunk * 0.7 },
    legs: { R: footFlat(-0.11, 0.045), L: { ...footFlat(0.11, 0.365), knee: [0.1, 0, 1] } },
    arms: handsOnWall(WALL, handY),
  }
}

const keys: Keys = {
  rest: lean(15, 5, 1.35),
  stretch: lean(24, 0.5, 1.3),
  deep: lean(26, 0.3, 1.29),
}

const anim: StretchAnimation = {
  id: 'calf-straight',
  props: [{ kind: 'wall', pos: [0, 0, WALL] }],
  keys,
  enter: { keys: [['rest', 0], ['stretch', 1]], duration: 1.6 },
  hold: { keys: [['stretch', 0], ['deep', 1]] },
  exit: { keys: [['stretch', 0], ['rest', 1]], duration: 1.4 },
  breathe: 1,
  camera: { yaw: -100, pitch: 8, distance: 1.6, target: [-0.11, 0.3, 0.05] },
}
export default anim
