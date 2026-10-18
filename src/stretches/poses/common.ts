import type { ArmKey, Keyframe, LegKey } from '../../body/pose'
import type { V3 } from '../../body/rig'

/**
 * Reference body (MPFB male, bind pose): root bone (pelvis) at [0, 0.948, -0.064], hip joints
 * 0.11 m either side and 0.057 m in front of it, thigh 0.434 m, shin 0.446 m, ankle 0.073 m up.
 * The body faces +Z; +X is the body's LEFT. Everything here is for the right side as the
 * working side; the engine mirrors it for the left.
 */
export const ROOT: V3 = [0, 0.948, -0.064]
export const SEAT_Y = 0.46
/** Pelvis sitting on a chair seat (hip joints ~9 cm above the seat). */
export const SEATED_ROOT: V3 = [0, SEAT_Y + 0.09, -0.157]

export const footFlat = (x: number, z: number, y = 0, yaw = 0): LegKey => ({
  plant: { at: [x, y, z], yaw, pivot: 'flat' },
  knee: [0, 0.1, 1],
})

export const handsOnHips = (): Record<'L' | 'R', ArmKey> => ({
  L: {
    wrist: { bone: 'root', offset: [0.2, 0.13, 0.03] }, elbow: [1, 0.1, -0.6],
    hand: { bone: 'root', fingers: [-0.2, -1, 0.5], palm: [-1, 0, 0] }, shape: 'relaxed',
  },
  R: {
    wrist: { bone: 'root', offset: [-0.2, 0.13, 0.03] }, elbow: [-1, 0.1, -0.6],
    hand: { bone: 'root', fingers: [0.2, -1, 0.5], palm: [1, 0, 0] }, shape: 'relaxed',
  },
})

export const armsRelaxed = (spread = 0.27): Record<'L' | 'R', ArmKey> => ({
  L: {
    wrist: { bone: 'root', offset: [spread, -0.06, 0.07] }, elbow: [0.3, 0, -1],
    hand: { bone: 'root', fingers: [0.05, -1, 0.1], palm: [-1, 0, 0] }, shape: 'relaxed',
  },
  R: {
    wrist: { bone: 'root', offset: [-spread, -0.06, 0.07] }, elbow: [-0.3, 0, -1],
    hand: { bone: 'root', fingers: [-0.05, -1, 0.1], palm: [1, 0, 0] }, shape: 'relaxed',
  },
})

/** Hands flat on a wall in front (wall face at z = wallZ), at height y. */
export const handsOnWall = (wallZ: number, y: number, x = 0.24): Record<'L' | 'R', ArmKey> => ({
  L: { wrist: [x, y, wallZ - 0.03], elbow: [0.6, -0.8, -0.2], hand: { fingers: [-0.15, 1, 0], palm: [0, 0, 1] }, shape: 'flat' },
  R: { wrist: [-x, y, wallZ - 0.03], elbow: [-0.6, -0.8, -0.2], hand: { fingers: [0.15, 1, 0], palm: [0, 0, 1] }, shape: 'flat' },
})

/** Seated, hands resting on the thighs. */
export const handsOnThighs = (): Record<'L' | 'R', ArmKey> => ({
  L: {
    wrist: { bone: 'upperleg01L', offset: [0.0, -0.2, 0.1] }, elbow: [0.8, -0.2, -0.6],
    hand: { bone: 'upperleg01L', fingers: [0, -1, 0], palm: [0, 0, -1] }, shape: 'relaxed',
  },
  R: {
    wrist: { bone: 'upperleg01R', offset: [0.0, -0.2, 0.1] }, elbow: [-0.8, -0.2, -0.6],
    hand: { bone: 'upperleg01R', fingers: [0, -1, 0], palm: [0, 0, -1] }, shape: 'relaxed',
  },
})

/**
 * Pelvis position for a stance leg defined by its shin angle from vertical (beta, forward +) and
 * knee flexion (kappa), with the ankle at `ankle`. Returns the root bone position, so a "straight
 * back leg with the heel down" can be written as data.
 */
export function rootFromStance(ankle: V3, beta: number, kappa: number, side: 'L' | 'R' = 'R'): V3 {
  const r = Math.PI / 180
  const shin = 0.446
  const thigh = 0.434
  const kneeY = ankle[1] + Math.cos(beta * r) * shin
  const kneeZ = ankle[2] + Math.sin(beta * r) * shin
  const t = (beta - kappa) * r
  const hipY = kneeY + Math.cos(t) * thigh
  const hipZ = kneeZ + Math.sin(t) * thigh
  const hipX = side === 'R' ? -0.11 : 0.11
  return [ankle[0] - hipX, hipY - 0.003, hipZ - 0.057]
}

export type Keys = Record<string, Keyframe>
