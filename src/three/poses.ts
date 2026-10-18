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
  /** Alternating exercises (posterior lunge): 0 = left leg steps back, 1 = right leg. */
  alt?: number
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
  stepDown: { height: 0.2, frontZ: 0.12, backZ: -0.32, width: 0.8 },
  shortFoot: { wallZ: 0.56 },
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

// ---------- shared standing helpers ----------
const smooth = (a: number, b: number, x: number) => {
  const t = THREE.MathUtils.clamp((x - a) / (b - a), 0, 1)
  return t * t * (3 - 2 * t)
}

function handsOnHips(m: Mannequin) {
  for (const side of ['R', 'L'] as SideKey[]) {
    const sx = side === 'R' ? -1 : 1
    const wrist = m.pointOn(m.pelvis, V(sx * 0.2, 0.13, 0.02))
    m.solveArm(side, wrist, m.pointOn(m.pelvis, V(sx * 1.5, 0.3, -0.6)).sub(m.rootSpacePos(m.arms[side].shoulder)))
    const down = m.pointOn(m.pelvis, V(sx * 0.2, -1, 0.02)).sub(m.pointOn(m.pelvis, V(sx * 0.2, 0, 0.02))).normalize()
    const inward = m.pointOn(m.pelvis, V(0, 0, 0)).sub(m.pointOn(m.pelvis, V(sx, 0, 0))).normalize()
    m.setHand(side, handQuat(down.add(V(0, 0, 0.4)).normalize(), inward))
  }
}

/** Stance leg defined by shin inclination (beta) and knee flexion (kappa), in radians. Returns the hip position. */
function stanceHip(ankle: THREE.Vector3, beta: number, kappa: number) {
  const knee = ankle.clone().add(V(0, Math.cos(beta), Math.sin(beta)).multiplyScalar(DIM.shin))
  const th = beta - kappa
  return knee.add(V(0, Math.cos(th), Math.sin(th)).multiplyScalar(DIM.thigh))
}

// ---------- 6. Step-down stabilization (single-leg hold on a step) ----------
function stepDown(m: Mannequin, { s }: PoseInput) {
  const st = LAYOUT.stepDown
  const k = smooth(0, 1, s)
  const ankle = V(-0.08, st.height + DIM.ankleH, -0.08)
  const hip = stanceHip(ankle, deg(lerp(3, 28, k)), deg(lerp(4, 58, k)))
  hip.x = ankle.x - 0.03
  const lean = lerp(3, 22, k)
  m.placePelvisByHip('R', hip, new THREE.Euler(deg(lean * 0.5), 0, 0))
  m.setSpine(new THREE.Euler(deg(lean * 0.5), 0, 0), new THREE.Euler(deg(-lean * 0.6), 0, 0))
  m.solveLeg('R', ankle, V(0, 0, 1))
  flatFoot(m, 'R')
  // free leg: from beside the stance foot to hovering in front of the step, below step level
  const onStep = V(0.12, st.height + DIM.ankleH, -0.08)
  const hover = V(0.07, st.height + 0.02, st.frontZ + 0.06)
  const lift = Math.sin(Math.PI * smooth(0, 0.6, s)) * 0.06
  const target = onStep.lerp(hover, smooth(0.05, 0.8, s)).add(V(0, lift, 0))
  m.solveLeg('L', target, V(0.05, 0, 1))
  m.setAnkle('L', lerp(0, -12, k))
  if (k < 0.05) flatFoot(m, 'L')
  handsOnHips(m)
}

// ---------- 7. Single-leg balance, eyes closed ----------
function balance(m: Mannequin, { s, t }: PoseInput) {
  const k = smooth(0, 1, s)
  const sway = k * 0.008
  const ankle = V(-0.09, DIM.ankleH, 0)
  const hip = V(ankle.x - 0.03 * k + sway * Math.sin(t * 1.9), ankle.y + LEG_LEN * 0.995, 0.02 + sway * Math.sin(t * 1.3 + 1))
  m.placePelvisByHip('R', hip, new THREE.Euler(0, 0, deg(-2 * k)))
  m.setSpine(new THREE.Euler(deg(2), 0, deg(2 * k)))
  m.solveLeg('R', ankle, V(0, 0, 1))
  flatFoot(m, 'R')
  const hipL = m.rootSpacePos(m.legs.L.hip)
  const lifted = V(hipL.x + 0.02, hipL.y - 0.66, hipL.z - 0.12)
  m.solveLeg('L', V(0.09, DIM.ankleH, 0).lerp(lifted, k), V(0, 0, 1))
  m.setAnkle('L', lerp(0, -15, k))
  if (k < 0.05) flatFoot(m, 'L')
  for (const side of ['R', 'L'] as SideKey[]) {
    const sx = side === 'R' ? -1 : 1
    const a = m.arms[side]
    a.shoulder.quaternion.setFromEuler(new THREE.Euler(deg(4), 0, sx * deg(lerp(6, 18, k) + 2 * Math.sin(t * 1.6) * k)))
    a.elbow.quaternion.setFromEuler(new THREE.Euler(deg(-12), 0, 0))
  }
  m.setEyes(1 - smooth(0.2, 0.6, s))
}

// ---------- 8. Side plank from the knees + hip abduction (right leg on top) ----------
function sidePlank(m: Mannequin, { s }: PoseInput) {
  const hipsUp = smooth(0, 0.6, s)
  const legUp = smooth(0.35, 1, s)
  const knee = V(-0.42, 0.05, 0)
  // lying on the left side: body axis tilts up by theta towards the head (+X)
  const pose = (theta: number, bend: number) => {
    const hipL = knee.clone().add(V(Math.cos(theta), Math.sin(theta), 0).multiplyScalar(DIM.thigh))
    m.placePelvisByHip('L', hipL, new THREE.Euler(0, 0, -(Math.PI / 2 - theta)))
    m.setSpine(new THREE.Euler(0, 0, bend), new THREE.Euler(0, 0, -bend * 0.5))
    return m.rootSpacePos(m.arms.L.shoulder).y
  }
  // shoulder sits above the elbow on the floor (~0.34 m). Hips down: side-bend the trunk to get there.
  // Hips up: the body forms a straight line from knee to shoulder.
  const shoulderY = 0.34
  const solve = (f: (x: number) => number, lo: number, hi: number) => {
    for (let i = 0; i < 18; i++) {
      const mid = (lo + hi) / 2
      if (f(mid) < shoulderY) lo = mid
      else hi = mid
    }
    return (lo + hi) / 2
  }
  const thetaDown = deg(3)
  const bendDown = solve((b) => pose(thetaDown, b), 0, deg(60))
  const thetaUp = solve((th) => pose(th, 0), 0, deg(40))
  pose(lerp(thetaDown, thetaUp, hipsUp), lerp(bendDown, 0, hipsUp))

  // bottom (left) leg: knee on the floor, shin behind
  m.solveLeg('L', V(knee.x + 0.04, 0.05, -0.42), V(-0.3, 0, 1))
  m.setAnkle('L', -20)
  // top (right) leg: resting on the bottom leg, then straightened and lifted
  const hipR = m.rootSpacePos(m.legs.R.hip)
  const theta = lerp(thetaDown, thetaUp, hipsUp)
  const abd = deg(28)
  const lifted = hipR.clone().add(V(-Math.cos(abd - theta), Math.sin(abd - theta), 0.02).multiplyScalar(LEG_LEN * 0.995))
  const resting = V(knee.x + 0.04, 0.15, -0.42)
  m.solveLeg('R', resting.lerp(lifted, legUp), V(-0.3, 0.2 * legUp, 1))
  m.setAnkle('R', lerp(-20, -10, legUp))

  // bottom forearm flat on the floor under the shoulder; top hand on the hip
  const sh = m.rootSpacePos(m.arms.L.shoulder)
  m.solveArm('L', V(sh.x + 0.02, 0.035, sh.z + 0.24), V(0, -1, -0.3))
  m.setHand('L', handQuat(V(0, 0, 1), V(0, -1, 0)))
  const onHip = m.pointOn(m.pelvis, V(-0.17, 0.1, 0.05))
  m.solveArm('R', onHip, V(0.4, 1, -0.6))
  m.setHand('R', handQuat(V(-1, -0.2, 0.3), V(0, -1, 0)))
}

// ---------- 9. Posterior (reverse) lunge, alternating legs ----------
function lunge(m: Mannequin, { s, alt = 0 }: PoseInput) {
  const B: SideKey = alt ? 'R' : 'L' // leg that steps back
  const F: SideKey = alt ? 'L' : 'R'
  const bx = B === 'R' ? -0.1 : 0.1
  const fx = -bx
  const k = smooth(0, 1, s)
  const front = V(fx, DIM.ankleH, 0)
  // back foot: lifts, travels back and lands on the ball with the heel up
  const phi = deg(lerp(0, 52, smooth(0.3, 1, s)))
  const footQ = new THREE.Quaternion().setFromAxisAngle(V(1, 0, 0), phi)
  const ballBack = V(bx, 0, -0.86)
  const landed = ballBack.clone().sub(V(0, -DIM.ankleH, DIM.ballZ).applyQuaternion(footQ))
  const startB = V(bx, DIM.ankleH, 0)
  const travel = smooth(0, 0.7, s)
  const backAnkle = startB.lerp(landed, travel).add(V(0, Math.sin(Math.PI * travel) * 0.06, 0))

  const hipY = lerp(LEG_LEN * 0.995 + DIM.ankleH, 0.6, k)
  const hipZ = lerp(0, -0.4, k)
  m.setPelvis(V(0, hipY, hipZ), new THREE.Euler(deg(4 * k), 0, 0))
  m.setSpine(new THREE.Euler(deg(5 * k), 0, 0), new THREE.Euler(deg(-6 * k), 0, 0))
  m.solveLeg(F, front, V(0, 0, 1))
  flatFoot(m, F)
  m.solveLeg(B, backAnkle, V(0, -0.8 * k, 1 - 0.6 * k))
  m.setFoot(B, footQ)
  m.setToes(B, THREE.MathUtils.radToDeg(phi))
  handsOnHips(m)
}

// ---------- 10. Seated inversion against an elastic band ----------
/** Elastic band: two strands round the right forefoot, anchored under the left foot. */
export function bandPoints(m: Mannequin): [THREE.Vector3, THREE.Vector3, THREE.Vector3] {
  const lateral = m.pointOn(m.legs.R.mid, V(-0.045, -0.012, 0.085)) // right foot: lateral is -X
  const medial = m.pointOn(m.legs.R.mid, V(0.045, -0.012, 0.085))
  const anchor = m.pointOn(m.legs.L.mid, V(0, -0.03, 0.06))
  return [lateral, medial, anchor]
}

function inversion(m: Mannequin, { s }: PoseInput) {
  seat(m, 6)
  m.solveLeg('L', V(0.12, DIM.ankleH, 0.36), V(0.1, 0.2, 1))
  flatFoot(m, 'L', 4)
  // right knee crossed over the left knee, foot hanging in front of the left shin
  m.solveLeg('R', V(0.03, 0.27, 0.5), V(0.7, 0.7, 0.8))
  // sole turns in and up against the band
  m.setAnkle('R', -15, lerp(0, 32, smooth(0, 1, s)))
  m.setToes('R', 0)
  handOnThigh(m, 'L', 0.2)
  handOnThigh(m, 'R', 0.22)
}

// ---------- 11. Intrinsic foot muscles: "short foot" (arch doming) ----------
function shortFoot(m: Mannequin, { s }: PoseInput) {
  const k = smooth(0, 1, s)
  const wallZ = LAYOUT.shortFoot.wallZ
  m.setPelvis(V(0, LEG_LEN * 0.99 + DIM.ankleH, 0), new THREE.Euler(0, 0, 0))
  m.setSpine(new THREE.Euler(deg(3), 0, 0))
  m.solveLeg('L', V(0.1, DIM.ankleH, 0), V(0, 0, 1))
  flatFoot(m, 'L')

  // dome the arch: forefoot tips down at the midfoot while heel and ball stay on the floor
  const arch = lerp(0, 18, k)
  const heelLocal = V(0, -DIM.ankleH, -0.05)
  const heelWorld = V(-0.1, 0, -0.05)
  const place = (pitch: number) => {
    const q = new THREE.Quaternion().setFromAxisAngle(V(1, 0, 0), deg(pitch))
    const ankle = heelWorld.clone().sub(heelLocal.clone().applyQuaternion(q))
    m.solveLeg('R', ankle, V(0, 0, 1))
    m.setFoot('R', q)
    m.setArch('R', arch)
    return m.pointOn(m.legs.R.toes, V(0, -0.02, 0)).y
  }
  let lo = -20
  let hi = 5
  for (let i = 0; i < 16; i++) {
    const mid = (lo + hi) / 2
    if (place(mid) > 0) lo = mid
    else hi = mid
  }
  const pitch = (lo + hi) / 2
  place(pitch)
  // toes stay long and flat on the floor (no curling)
  m.setToes('R', pitch + arch)

  for (const side of ['R', 'L'] as SideKey[]) {
    const sx = side === 'R' ? -1 : 1
    const sh = m.rootSpacePos(m.arms[side].shoulder)
    m.solveArm(side, V(sx * 0.24, sh.y - 0.05, wallZ - 0.025), V(sx * 0.6, -0.8, -0.2))
    m.setHand(side, handQuat(V(-sx * 0.15, 1, 0), V(0, 0, 1)))
  }
}

export const POSES: Record<ExerciseId, (m: Mannequin, p: PoseInput) => void> = {
  'pf-stretch': pfStretch,
  'calf-straight': (m, p) => wallStretch(m, p, false),
  'calf-bent': (m, p) => wallStretch(m, p, true),
  'heel-raise': heelRaise,
  ice,
  'step-down': stepDown,
  'balance-eyes-closed': balance,
  'side-plank-abduction': sidePlank,
  'posterior-lunge': lunge,
  'inversion-band': inversion,
  'intrinsic-foot': shortFoot,
}

/** Default camera per exercise (for the right foot; X is mirrored for the left). */
export const CAMERAS: Record<ExerciseId, { position: [number, number, number]; target: [number, number, number] }> = {
  'pf-stretch': { position: [1.05, 0.98, 0.95], target: [0.08, 0.64, 0.27] },
  'calf-straight': { position: [-2.75, 1.05, -0.15], target: [0, 0.75, 0.32] },
  'calf-bent': { position: [-2.7, 0.95, -0.35], target: [0, 0.7, 0.3] },
  'heel-raise': { position: [-2.35, 1.0, -0.6], target: [0, 0.8, 0.02] },
  ice: { position: [-1.05, 0.55, 0.75], target: [-0.08, 0.2, 0.38] },
  'step-down': { position: [-2.6, 1.15, 1.5], target: [0, 0.68, 0.02] },
  'balance-eyes-closed': { position: [-1.4, 1.3, 2.2], target: [0, 0.85, 0] },
  'side-plank-abduction': { position: [-0.15, 1.0, 2.1], target: [0.05, 0.25, 0] },
  'posterior-lunge': { position: [-3.1, 1.05, -0.35], target: [0, 0.7, -0.4] },
  'inversion-band': { position: [1.45, 1.0, 2.1], target: [0.02, 0.52, 0.3] },
  'intrinsic-foot': { position: [-3.0, 1.05, 0.45], target: [0, 0.78, 0.15] },
}

/** Where the foot close-up camera sits relative to the foot (right foot; X mirrored for the left). */
export const FOOT_CAMS: Record<ExerciseId, [number, number, number] | null> = {
  'pf-stretch': [0.35, 0.12, 0.18],
  'calf-straight': [-0.42, 0.12, 0.05],
  'calf-bent': [-0.42, 0.12, 0.05],
  'heel-raise': [-0.42, 0.08, 0.0],
  ice: [-0.4, 0.06, 0.12],
  'step-down': null,
  'balance-eyes-closed': [-0.35, 0.15, 0.3],
  'side-plank-abduction': null,
  'posterior-lunge': null,
  'inversion-band': [0.25, 0.05, 0.38],
  'intrinsic-foot': [-0.38, 0.08, 0.12],
}
