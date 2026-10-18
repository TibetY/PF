import * as THREE from 'three'
import type { ExerciseId } from '../data/exercises'
import { DIM, Mannequin, basisQuat, handQuat, type SideKey } from './rig'

/**
 * Poses are authored with the RIGHT foot as the affected foot. The whole scene
 * (figure + props) is mirrored for the left foot.
 *
 * Every pose takes:
 *   s     0 = relaxed / bottom position, 1 = full stretch / top of the raise
 *   t     seconds (only used for the continuous ice-massage rolling motion)
 *   down  heel raises only: 1 = free foot resting on the step (between sets)
 */
export interface PoseInput {
  s: number
  t: number
  down: number
}

const deg = THREE.MathUtils.degToRad
const lerp = THREE.MathUtils.lerp
const V = (x: number, y: number, z: number) => new THREE.Vector3(x, y, z)
const LEG_LEN = DIM.thigh + DIM.shin

// ---------- scene layout (shared with props) ----------
export const LAYOUT = {
  chair: { seatY: 0.46, seatZ: -0.06, depth: 0.44, width: 0.46 },
  wallStretch: { wallZ: 0.8, backAnkle: V(-0.11, DIM.ankleH, 0), frontAnkle: V(0.11, DIM.ankleH, 0.32) },
  step: { height: 0.2, ballZ: 0, backEdgeZ: -0.06, frontZ: 0.32, width: 0.8, ballX: -0.07, wallZ: 0.55 },
  towel: { radius: 0.024, z: 0.05, length: 0.2 },
  bottle: { radius: 0.036, length: 0.22, x: -0.12, z: 0.42 },
}

// ---------- shared helpers ----------
function seat(m: Mannequin, lean: number, twist = 0) {
  m.setPelvis(V(0, LAYOUT.chair.seatY + 0.09, -0.1), new THREE.Euler(deg(-4), 0, 0))
  m.setSpine(new THREE.Euler(deg(4 + lean), deg(twist), 0, 'YXZ'), new THREE.Euler(deg(-lean * 0.3), deg(-twist * 0.5), 0))
}

function flatFoot(m: Mannequin, side: SideKey, yaw = 0, pitch = 0) {
  const q = basisQuat(V(Math.sin(deg(yaw)), 0, Math.cos(deg(yaw))), V(0, 1, 0))
  q.multiply(new THREE.Quaternion().setFromAxisAngle(V(1, 0, 0), deg(pitch)))
  m.setFoot(side, q)
}

/** Rest a hand on top of the thigh of the given side. */
function handOnThigh(m: Mannequin, side: SideKey, along = 0.24) {
  const sx = side === 'R' ? -1 : 1
  const hip = m.legs[side].hip
  const wrist = m.pointOn(hip, V(sx * 0.01, -along, 0.1))
  const fwd = m.pointOn(hip, V(0, -along - 0.2, 0.1)).sub(wrist).normalize()
  const up = m.pointOn(hip, V(0, -along, 0.3)).sub(wrist).normalize()
  m.solveArm(side, wrist, V(sx * 0.8, -0.2, -0.6))
  m.setHand(side, handQuat(fwd, up.negate()))
}

function hangArm(m: Mannequin, side: SideKey, swing = 0) {
  const sx = side === 'R' ? -1 : 1
  const a = m.arms[side]
  a.shoulder.quaternion.setFromEuler(new THREE.Euler(deg(swing), 0, sx * deg(8)))
  a.elbow.quaternion.setFromEuler(new THREE.Euler(deg(-15), 0, 0))
  a.wrist.quaternion.identity()
}

// ---------- 1. Plantar fascia stretch (seated, foot crossed over knee) ----------
function pfStretch(m: Mannequin, { s }: PoseInput) {
  // lean in and turn slightly toward the crossed foot to reach the toes
  seat(m, lerp(28, 33, s), 16)

  // support (left) leg: foot flat on the floor
  m.solveLeg('L', V(0.13, DIM.ankleH, 0.36), V(0.1, 0.2, 1))
  flatFoot(m, 'L', 6)

  // affected (right) leg crossed: outer ankle rests on top of the left thigh near the knee
  const lKnee = m.rootSpacePos(m.legs.L.knee)
  const ankle = V(lKnee.x - 0.02, lKnee.y + 0.12, lKnee.z - 0.07)
  m.solveLeg('R', ankle, V(-1, -0.35, 0.35))
  // relaxed: foot slightly pointed, toes neutral. stretch: ankle up, toes pulled back hard
  m.setAnkle('R', lerp(-12, 12, s), 18)
  m.setToes('R', lerp(5, 60, s))

  // right hand wraps the toes from the sole side and pulls them back toward the shin
  const toes = m.legs.R.toes
  const grip = m.pointOn(toes, V(0, -0.03, 0.035))
  const across = m.pointOn(toes, V(-1, 0, 0)).sub(m.pointOn(toes, V(0, 0, 0))).normalize() // medial -> lateral
  const toeUp = m.pointOn(toes, V(0, 1, 0)).sub(m.pointOn(toes, V(0, 0, 0))).normalize()
  const wrist = grip.clone().addScaledVector(across, -0.1).addScaledVector(toeUp, -0.015)
  m.solveArm('R', wrist, V(-0.7, -0.5, -0.4))
  m.setHand('R', handQuat(across, toeUp))

  // left hand steadies the shin just above the ankle
  const knee = m.legs.R.knee
  const shinPt = m.pointOn(knee, V(0, -0.24, 0.05))
  const shinFront = m.pointOn(knee, V(0, -0.24, 1)).sub(m.pointOn(knee, V(0, -0.24, 0))).normalize()
  const shinAxis = m.pointOn(knee, V(0, 0, 0)).sub(m.pointOn(knee, V(0, -1, 0))).normalize()
  const fingers = new THREE.Vector3().crossVectors(shinAxis, shinFront).negate()
  m.solveArm('L', shinPt.clone().addScaledVector(fingers, -0.09).addScaledVector(shinFront, 0.02), V(0.9, -0.3, -0.4))
  m.setHand('L', handQuat(fingers, shinFront.clone().negate()))
}

// ---------- 2 & 3. Wall calf stretches ----------
function wallStretch(m: Mannequin, { s }: PoseInput, bent: boolean) {
  const { backAnkle, frontAnkle, wallZ } = LAYOUT.wallStretch
  // back (affected) leg: shin inclination = ankle dorsiflexion, heel stays flat
  const beta = deg(bent ? lerp(18, 30, s) : lerp(15, 24, s))
  const kappa = deg(bent ? lerp(14, 26, s) : lerp(5, 0.5, s)) // knee flexion
  const knee = backAnkle.clone().add(V(0, Math.cos(beta), Math.sin(beta)).multiplyScalar(DIM.shin))
  const thighAng = beta - kappa
  const hip = knee.clone().add(V(0, Math.cos(thighAng), Math.sin(thighAng)).multiplyScalar(DIM.thigh))

  // trunk: straight line from heel to head for the straight-knee stretch, more upright when bent
  const lean = bent ? lerp(12, 14, s) : THREE.MathUtils.radToDeg(beta) * 0.6
  m.placePelvisByHip('R', hip, new THREE.Euler(deg(lean * 0.4), 0, 0))
  m.setSpine(new THREE.Euler(deg(lean * 0.6), 0, 0), new THREE.Euler(deg(-lean * 0.7), 0, 0))

  m.solveLeg('R', backAnkle, V(0, 0, 1))
  flatFoot(m, 'R')
  m.setToes('R', 0)
  m.solveLeg('L', frontAnkle, V(0.1, 0, 1))
  flatFoot(m, 'L')
  m.setToes('L', 0)

  // hands flat on the wall at shoulder height
  for (const side of ['R', 'L'] as SideKey[]) {
    const sx = side === 'R' ? -1 : 1
    const sh = m.rootSpacePos(m.arms[side].shoulder)
    m.solveArm(side, V(sx * 0.24, sh.y - 0.04, wallZ - 0.025), V(sx * 0.6, -0.8, -0.2))
    m.setHand(side, handQuat(V(-sx * 0.15, 1, 0), V(0, 0, 1)))
  }
}

// ---------- 4. High-load heel raises on a step ----------
export const HEEL_PITCH = { bottom: -6, top: 38 }
export const TOWEL_ANGLE = 30

function heelRaise(m: Mannequin, { s, down }: PoseInput) {
  const st = LAYOUT.step
  const phi = deg(lerp(HEEL_PITCH.bottom, HEEL_PITCH.top, s))
  // foot pivots about the ball of the foot, which stays planted on the step
  const footQ = new THREE.Quaternion().setFromAxisAngle(V(1, 0, 0), phi)
  const contact = V(0, -DIM.ankleH, DIM.ballZ)
  const ball = V(st.ballX, st.height, st.ballZ)
  const ankle = ball.clone().sub(contact.clone().applyQuaternion(footQ))

  // body stacks over the ball of the foot; knee nearly straight
  const reach = LEG_LEN * 0.992
  const hipZ = st.ballZ - 0.03
  const dz = hipZ - ankle.z
  const hip = V(st.ballX - 0.05, ankle.y + Math.sqrt(reach * reach - dz * dz), hipZ)
  m.placePelvisByHip('R', hip, new THREE.Euler(deg(3), 0, deg(-2 * (1 - down))))
  m.setSpine(new THREE.Euler(deg(4), 0, deg(1.5 * (1 - down))))

  m.solveLeg('R', ankle, V(0, 0, 1))
  m.setFoot('R', footQ)
  // toes stay draped over the rolled towel, so extension grows as the heel rises
  m.setToes('R', TOWEL_ANGLE + THREE.MathUtils.radToDeg(phi))

  // free leg: knee bent, foot lifted behind; between sets it rests on the step
  const hipL = m.rootSpacePos(m.legs.L.hip)
  const lifted = V(hipL.x + 0.02, hipL.y - 0.6, hipL.z - 0.3)
  const planted = V(0.13, st.height + DIM.ankleH, st.ballZ + 0.02)
  m.solveLeg('L', lifted.lerp(planted, down), V(0.05, 0, 1))
  m.setAnkle('L', lerp(-25, 0, down))
  if (down > 0.5) flatFoot(m, 'L')
  m.setToes('L', 0)

  // light fingertip support on the wall
  const sh = m.rootSpacePos(m.arms.L.shoulder)
  m.solveArm('L', V(0.26, sh.y - 0.05, st.wallZ - 0.025), V(0.7, -0.7, -0.2))
  m.setHand('L', handQuat(V(-0.1, 1, 0), V(0, 0, 1)))
  hangArm(m, 'R', 4)
}

// ---------- 5. Ice massage (seated, rolling the arch over a frozen bottle) ----------
export const ICE_PERIOD = 2.6
export const ICE_TRAVEL = 0.09

/** Foot displacement along Z, and the bottle's resulting offset and spin. */
export function iceRoll(t: number) {
  const d = ICE_TRAVEL * Math.sin((2 * Math.PI * t) / ICE_PERIOD)
  // rolling without slipping: the bottle travels half as far as the foot
  return { foot: d, bottle: d / 2, spin: d / 2 / LAYOUT.bottle.radius }
}

function ice(m: Mannequin, { t }: PoseInput) {
  seat(m, 8)
  const b = LAYOUT.bottle
  const roll = iceRoll(t)
  // arch sits on top of the bottle; contact point under the arch at d = 0
  const archZ = 0.035
  const ankle = V(b.x, 2 * b.radius + DIM.ankleH - 0.004, b.z - archZ + roll.foot)
  m.solveLeg('R', ankle, V(0, 0.4, 1))
  flatFoot(m, 'R', 0, 2)
  m.setToes('R', 0)

  m.solveLeg('L', V(0.14, DIM.ankleH, 0.33), V(0.1, 0.2, 1))
  flatFoot(m, 'L', 6)
  m.setToes('L', 0)
  handOnThigh(m, 'R')
  handOnThigh(m, 'L')
}

export const POSES: Record<ExerciseId, (m: Mannequin, p: PoseInput) => void> = {
  'pf-stretch': pfStretch,
  'calf-straight': (m, p) => wallStretch(m, p, false),
  'calf-bent': (m, p) => wallStretch(m, p, true),
  'heel-raise': heelRaise,
  ice,
}

/** Default camera per exercise (for the right foot; X is mirrored for the left). */
export const CAMERAS: Record<ExerciseId, { position: [number, number, number]; target: [number, number, number] }> = {
  'pf-stretch': { position: [1.05, 0.98, 0.95], target: [0.08, 0.64, 0.27] },
  'calf-straight': { position: [-2.75, 1.05, -0.15], target: [0, 0.75, 0.32] },
  'calf-bent': { position: [-2.7, 0.95, -0.35], target: [0, 0.7, 0.3] },
  'heel-raise': { position: [-2.35, 1.0, -0.6], target: [0, 0.8, 0.02] },
  ice: { position: [-1.05, 0.55, 0.75], target: [-0.08, 0.2, 0.38] },
}
