import type { Keyframe, StretchAnimation } from '../../body/pose'
import type { V3 } from '../../body/rig'
import { armsRelaxed, type Keys } from './common'

/**
 * High-load heel raise on a step, right leg, rolled towel under the toes, heel off the edge,
 * light left hand on the wall. Up 3 s (enter), hold 2 s (hold), down 3 s (exit).
 */
const STEP = 0.2
const BALL: V3 = [-0.07, STEP, 0]
const WALL = 0.55
const TOWEL = 30 // degrees the towel lifts the toes

function raise(pitch: number, freeDown: boolean): Keyframe {
  const r = Math.PI / 180
  // ankle above the ball of the foot for this foot pitch (ball 0.136 m in front of the ankle)
  const ay = STEP + 0.073 * Math.cos(pitch * r) + 0.136 * Math.sin(pitch * r)
  const az = 0.073 * Math.sin(pitch * r) - 0.136 * Math.cos(pitch * r)
  const hipZ = -0.03
  const dz = hipZ - az
  const hipY = ay + Math.sqrt(0.873 ** 2 - dz * dz)
  return {
    pelvis: { pos: [-0.12 + 0.11, hipY - 0.003, hipZ - 0.057], rot: [3, 0, freeDown ? 0 : -2] },
    spine: { flex: 4, side: freeDown ? 0 : -1.5 },
    legs: {
      R: { plant: { at: BALL, pitch, pivot: 'ball' }, knee: [0, 0, 1], toes: [TOWEL + pitch, 0] },
      L: freeDown
        ? { ankle: [0.13, STEP + 0.073, 0.02], knee: [0.05, 0, 1], angles: [0, 0] }
        : { ankle: [0.12, hipY - 0.6, -0.33], knee: [0.05, 0, 1], angles: [-25, 0] },
    },
    arms: {
      L: { wrist: [0.26, hipY + 0.52, WALL - 0.03], elbow: [0.7, -0.7, -0.2], hand: { fingers: [-0.1, 1, 0], palm: [0, 0, 1] }, shape: 'flat' },
      R: armsRelaxed().R,
    },
  }
}

const keys: Keys = {
  rest: raise(-6, true),
  bottom: raise(-6, false),
  top: raise(38, false),
}

const anim: StretchAnimation = {
  id: 'heel-raise',
  props: [
    { kind: 'step', pos: [0, 0, -0.06], size: [0.8, STEP, 0.38] },
    { kind: 'towel', pos: [BALL[0], STEP, 0.05] },
    { kind: 'wall', pos: [0, 0, WALL] },
  ],
  keys,
  rest: 'rest',
  enter: { keys: [['bottom', 0], ['top', 1]], duration: 3 },
  hold: { keys: [['top', 0], ['top', 1]] },
  exit: { keys: [['top', 0], ['bottom', 1]], duration: 3 },
  breathe: 0,
  camera: { yaw: -95, pitch: 6, distance: 1.3, target: [-0.07, 0.35, 0] },
}
export default anim
