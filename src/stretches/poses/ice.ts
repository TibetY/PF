import type { Keyframe, StretchAnimation } from '../../body/pose'
import { SEATED_ROOT, footFlat, handsOnThighs, type Keys } from './common'

/** Ice massage: seated, right arch rolling back and forth over a frozen bottle. */
export const BOTTLE = { x: -0.12, z: 0.42, r: 0.036 }
const TRAVEL = 0.09

function roll(d: number): Keyframe {
  return {
    pelvis: { pos: SEATED_ROOT, rot: [-4, 0, 0] },
    spine: { flex: 10 },
    neck: { flex: 14 },
    legs: {
      L: footFlat(0.14, 0.375, 0, 6),
      // arch on top of the bottle: ankle sits just behind the contact point
      R: { plant: { at: [BOTTLE.x, 2 * BOTTLE.r - 0.008, BOTTLE.z + d - 0.0], pivot: 'flat' }, knee: [0, 0.4, 1] },
    },
    arms: handsOnThighs(),
  }
}

const keys: Keys = { center: roll(0), back: roll(-TRAVEL), fwd: roll(TRAVEL) }

const anim: StretchAnimation = {
  id: 'ice',
  props: [{ kind: 'chair', pos: [0, 0, -0.06] }, { kind: 'bottle', pos: [BOTTLE.x, BOTTLE.r, BOTTLE.z] }],
  keys,
  enter: { keys: [['center', 0], ['center', 1]], duration: 0.5 },
  hold: { keys: [['center', 0], ['center', 1]] },
  exit: { keys: [['center', 0], ['center', 1]], duration: 0.5 },
  cycle: { keys: [['back', 0], ['fwd', 0.5], ['back', 1]], seconds: 2.6 },
  breathe: 0.6,
  camera: { yaw: -75, pitch: 10, distance: 1.0, target: [-0.1, 0.12, 0.42] },
}
export default anim
