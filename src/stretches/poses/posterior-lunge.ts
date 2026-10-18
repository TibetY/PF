import type { Keyframe, StretchAnimation } from '../../body/pose'
import { footFlat, handsOnHips, type Keys } from './common'

/** Reverse lunge: the LEFT leg steps back (mirrored on alternate reps), right leg in front. */
function lunge(k: number, travel: number, lift: number, pitch: number): Keyframe {
  const backZ = -0.86 * travel
  return {
    pelvis: { pos: [0, 0.94 - 0.33 * k, -0.064 - 0.4 * k], rot: [4 * k, 0, 0] },
    spine: { flex: 5 * k },
    neck: { flex: -6 * k },
    legs: {
      R: footFlat(-0.1, 0.045),
      L: { plant: { at: [0.1, lift, backZ + (travel ? 0 : 0.045)], pitch, pivot: travel ? 'ball' : 'flat' }, knee: [0, -0.8 * k, 1 - 0.6 * k], toes: [pitch, 0] },
    },
    arms: handsOnHips(),
  }
}

const keys: Keys = {
  stand: lunge(0, 0, 0, 0),
  step: lunge(0.35, 0.55, 0.06, 20),
  bottom: lunge(1, 1, 0, 52),
}

const anim: StretchAnimation = {
  id: 'posterior-lunge',
  props: [],
  keys,
  enter: { keys: [['stand', 0], ['step', 0.4], ['bottom', 1]], duration: 1.6 },
  hold: { keys: [['bottom', 0], ['bottom', 1]] },
  exit: { keys: [['bottom', 0], ['step', 0.6], ['stand', 1]], duration: 1.6 },
  // demo pace for the self-paced reps; alternate legs each rep
  cycle: { keys: [['stand', 0], ['step', 0.18], ['bottom', 0.4], ['bottom', 0.5], ['step', 0.72], ['stand', 0.9], ['stand', 1]], seconds: 4.2, alternate: true },
  breathe: 0,
  camera: { yaw: -95, pitch: 8, distance: 2.8, target: [0, 0.7, -0.35] },
}
export default anim
