import * as THREE from 'three'

/**
 * Drives the MPFB "default" skeleton (same bone names on the male and female bodies).
 *
 * Model space: +Y up, +Z forward (the body faces +Z), +X = the body's LEFT. Joint angles are
 * anatomical and applied relative to the bind (rest) pose, in the rest pose's world axes, so a
 * child joint's angles are relative to its parent segment.
 */
export type Side = 'L' | 'R'
export type V3 = [number, number, number]
export type HandShape = 'relaxed' | 'grip' | 'flat' | 'fist' | 'interlaced'

const X = new THREE.Vector3(1, 0, 0)
const Y = new THREE.Vector3(0, 1, 0)
const Z = new THREE.Vector3(0, 0, 1)
const D2R = Math.PI / 180

/** Per-joint limits in degrees (anatomical ranges with a little margin). */
export const LIMITS = {
  hipFlex: [-30, 130], hipAbd: [-35, 60], hipRot: [-45, 55],
  knee: [0, 150],
  dorsi: [-55, 35], inversion: [-25, 40],
  toeExt: [-35, 85], toeCurl: [0, 65],
  spineFlex: [-30, 85], spineSide: [-40, 40], spineTwist: [-50, 50],
  neckFlex: [-50, 65], neckSide: [-40, 40], neckTwist: [-75, 75],
  wristFlex: [-70, 75],
} as const
const clamp = (v: number, [lo, hi]: readonly [number, number] | readonly number[]) => Math.min(hi, Math.max(lo, v))

const SPINE = ['spine05', 'spine04', 'spine03', 'spine02', 'spine01']
const NECK = ['neck01', 'neck02', 'neck03', 'head']
const TOES = [1, 2, 3, 4, 5]
const FINGERS = [1, 2, 3, 4, 5]

/** Finger curl per joint (MCP, PIP, DIP) in degrees; thumb separately. */
const HAND_SHAPES: Record<HandShape, { curl: [number, number, number]; thumb: number; spread: number }> = {
  relaxed: { curl: [12, 22, 14], thumb: 12, spread: 0 },
  grip: { curl: [55, 75, 45], thumb: 35, spread: 0 },
  flat: { curl: [0, 2, 2], thumb: 0, spread: 6 },
  fist: { curl: [85, 100, 70], thumb: 50, spread: 0 },
  interlaced: { curl: [25, 40, 20], thumb: 20, spread: 14 },
}

interface Rest {
  localQ: THREE.Quaternion
  localP: THREE.Vector3
  worldQ: THREE.Quaternion
  worldP: THREE.Vector3
}

const _q = new THREE.Quaternion()
const _q2 = new THREE.Quaternion()
const _v = new THREE.Vector3()
const _v2 = new THREE.Vector3()
const _m = new THREE.Matrix4()

function basis(dir: THREE.Vector3, ref: THREE.Vector3) {
  // orthonormal frame with Y = dir and Z = ref projected perpendicular to dir
  const y = dir.clone().normalize()
  const z = ref.clone().addScaledVector(y, -ref.dot(y))
  if (z.lengthSq() < 1e-8) z.copy(Math.abs(y.z) < 0.9 ? Z : X).addScaledVector(y, -(Math.abs(y.z) < 0.9 ? y.z : y.x))
  z.normalize()
  const x = new THREE.Vector3().crossVectors(y, z)
  return new THREE.Quaternion().setFromRotationMatrix(_m.makeBasis(x, y, z))
}

export class BodyRig {
  bones: Record<string, THREE.Bone> = {}
  rest: Record<string, Rest> = {}
  root: THREE.Bone
  /** Body measurements from the bind pose (metres). */
  metrics: {
    hipY: number; thigh: number; shin: number; ankleY: number; upperArm: number; forearm: number
    hipHalfWidth: number; shoulderY: number; heelZ: number; ballZ: number; height: number
  }
  /** Direction of curl toward the palm, per side (+1/-1 around the knuckle axis). */
  private curlSign: Record<Side, number> = { L: 1, R: 1 }
  private handRest: Record<Side, { fingers: THREE.Vector3; palm: THREE.Vector3; knuckle: THREE.Vector3 }>

  constructor(scene: THREE.Object3D) {
    scene.updateMatrixWorld(true)
    scene.traverse((o) => {
      if ((o as THREE.Bone).isBone) {
        const b = o as THREE.Bone
        this.bones[b.name] = b
        this.rest[b.name] = {
          localQ: b.quaternion.clone(),
          localP: b.position.clone(),
          worldQ: b.getWorldQuaternion(new THREE.Quaternion()),
          worldP: b.getWorldPosition(new THREE.Vector3()),
        }
      }
    })
    this.root = this.bones.root
    const P = (n: string) => this.rest[n].worldP
    const hipY = (P('upperleg01L').y + P('upperleg01R').y) / 2
    let height = 0
    scene.traverse((o) => {
      if ((o as THREE.Mesh).isMesh && o.name === 'Body') {
        const box = new THREE.Box3().setFromObject(o)
        height = box.max.y
      }
    })
    this.metrics = {
      hipY,
      thigh: P('upperleg01L').distanceTo(P('lowerleg01L')),
      shin: P('lowerleg01L').distanceTo(P('footL')),
      ankleY: P('footL').y,
      upperArm: P('upperarm01L').distanceTo(P('lowerarm01L')),
      forearm: P('lowerarm01L').distanceTo(P('wristL')),
      hipHalfWidth: P('upperleg01L').x,
      shoulderY: P('upperarm01L').y,
      heelZ: P('footL').z - 0.07,
      ballZ: (P('toe1-1L').z + P('toe5-1L').z) / 2,
      height,
    }
    const hand = (s: Side) => {
      const wrist = P(`wrist${s}`)
      const middle = P(`finger3-1${s}`)
      const knuckle = P(`finger2-1${s}`).clone().sub(P(`finger5-1${s}`)).normalize()
      const fingers = middle.clone().sub(wrist).normalize()
      // palm normal: out of the palm. For the left hand (index toward +X side when palm faces down)
      const palm = new THREE.Vector3().crossVectors(fingers, knuckle).multiplyScalar(s === 'L' ? 1 : -1).normalize()
      return { fingers, palm, knuckle }
    }
    this.handRest = { L: hand('L'), R: hand('R') }
    for (const s of ['L', 'R'] as Side[]) {
      // pick the curl direction that moves the fingertips toward the palm side
      const { fingers, palm, knuckle } = this.handRest[s]
      const tip = fingers.clone().applyAxisAngle(knuckle, 0.5)
      this.curlSign[s] = tip.dot(palm) > fingers.dot(palm) ? 1 : -1
    }
  }

  has(name: string) {
    return !!this.bones[name]
  }

  /** Back to the bind pose. */
  reset() {
    for (const [n, b] of Object.entries(this.bones)) {
      b.quaternion.copy(this.rest[n].localQ)
      b.position.copy(this.rest[n].localP)
    }
  }

  /** Set a bone's rotation as a delta applied in the rest pose's world frame (anatomical axes). */
  private setDelta(name: string, delta: THREE.Quaternion) {
    const b = this.bones[name]
    const r = this.rest[name]
    if (!b) return
    // local = restLocal * (restWorld^-1 * delta * restWorld)
    _q.copy(r.worldQ).invert().multiply(delta).multiply(r.worldQ)
    b.quaternion.copy(r.localQ).multiply(_q)
  }

  /** Set a bone's world orientation directly (used by IK and planted feet). */
  setWorldQuat(name: string, q: THREE.Quaternion) {
    const b = this.bones[name]
    b.parent!.updateWorldMatrix(true, false)
    b.parent!.getWorldQuaternion(_q2)
    b.quaternion.copy(_q2.invert().multiply(q))
    b.updateMatrixWorld(true)
  }

  worldPos(name: string, out = new THREE.Vector3()) {
    const b = this.bones[name]
    b.updateWorldMatrix(true, false)
    return out.setFromMatrixPosition(b.matrixWorld)
  }
  worldQuat(name: string, out = new THREE.Quaternion()) {
    const b = this.bones[name]
    b.updateWorldMatrix(true, false)
    return b.getWorldQuaternion(out)
  }

  // ---------------------------------------------------------------- trunk
  /** Pelvis (root bone) world position and orientation (degrees: pitch forward +, yaw left +, roll toward the left +). */
  setPelvis(pos: THREE.Vector3, rotDeg: V3) {
    const [pitch, yaw, roll] = rotDeg
    const R = new THREE.Quaternion().setFromEuler(new THREE.Euler(pitch * D2R, yaw * D2R, -roll * D2R, 'YXZ'))
    const r = this.rest.root
    const parent = this.root.parent!
    parent.updateWorldMatrix(true, false)
    // rotate about the pelvis: world = R * restWorld; place the root bone at pos
    const world = R.clone().multiply(r.worldQ)
    parent.getWorldQuaternion(_q2)
    this.root.quaternion.copy(_q2.invert().multiply(world))
    this.root.position.copy(parent.worldToLocal(pos.clone()))
    this.root.updateMatrixWorld(true)
  }

  /** Place the pelvis so that one hip joint lands on `at`, with the given orientation. */
  setPelvisByHip(s: Side, at: THREE.Vector3, rotDeg: V3) {
    this.setPelvis(this.rest.root.worldP.clone(), rotDeg)
    const hip = this.worldPos(`upperleg01${s}`)
    const root = this.worldPos('root')
    this.setPelvis(at.clone().add(root.sub(hip)), rotDeg)
  }

  /** Spine bend spread over the five spine bones. flex + = forward, side + = toward the left, twist + = turn left. */
  setSpine(flex = 0, side = 0, twist = 0) {
    flex = clamp(flex, LIMITS.spineFlex)
    side = clamp(side, LIMITS.spineSide)
    twist = clamp(twist, LIMITS.spineTwist)
    const n = SPINE.length
    const d = new THREE.Quaternion()
      .setFromAxisAngle(Y, (twist / n) * D2R)
      .multiply(new THREE.Quaternion().setFromAxisAngle(X, (flex / n) * D2R))
      .multiply(new THREE.Quaternion().setFromAxisAngle(Z, (-side / n) * D2R))
    SPINE.forEach((b) => this.setDelta(b, d))
  }

  setNeck(flex = 0, side = 0, twist = 0) {
    flex = clamp(flex, LIMITS.neckFlex)
    side = clamp(side, LIMITS.neckSide)
    twist = clamp(twist, LIMITS.neckTwist)
    const n = NECK.length
    const d = new THREE.Quaternion()
      .setFromAxisAngle(Y, (twist / n) * D2R)
      .multiply(new THREE.Quaternion().setFromAxisAngle(X, (flex / n) * D2R))
      .multiply(new THREE.Quaternion().setFromAxisAngle(Z, (-side / n) * D2R))
    NECK.forEach((b) => this.setDelta(b, d))
  }

  setEyes(open: number) {
    // the upper eyelid bones (orbicularis03) swing down about their own X axis
    const shut = 1 - THREE.MathUtils.clamp(open, 0, 1)
    if (!shut) return
    for (const n of ['orbicularis03L', 'orbicularis03R']) this.bones[n]?.rotateX(-0.66 * shut)
  }

  // ---------------------------------------------------------------- legs (FK)
  /** Hip: flex + = thigh forward, abd + = away from the midline, rot + = external (toes out). */
  setHip(s: Side, flex = 0, abd = 0, rot = 0) {
    const sx = s === 'L' ? 1 : -1
    flex = clamp(flex, LIMITS.hipFlex)
    abd = clamp(abd, LIMITS.hipAbd)
    rot = clamp(rot, LIMITS.hipRot)
    const d = new THREE.Quaternion()
      .setFromAxisAngle(X, -flex * D2R)
      .multiply(new THREE.Quaternion().setFromAxisAngle(Z, sx * abd * D2R))
      .multiply(new THREE.Quaternion().setFromAxisAngle(Y, sx * rot * D2R))
    this.setDelta(`upperleg01${s}`, d)
  }

  setKnee(s: Side, flex: number) {
    this.setDelta(`lowerleg01${s}`, new THREE.Quaternion().setFromAxisAngle(X, clamp(flex, LIMITS.knee) * D2R))
  }

  /** Ankle relative to the shin: dorsi + = toes up, inversion + = sole turns in. */
  setAnkle(s: Side, dorsi = 0, inversion = 0) {
    const sx = s === 'L' ? 1 : -1
    const d = new THREE.Quaternion()
      .setFromAxisAngle(X, -clamp(dorsi, LIMITS.dorsi) * D2R)
      .multiply(new THREE.Quaternion().setFromAxisAngle(Z, -sx * clamp(inversion, LIMITS.inversion) * D2R))
    this.setDelta(`foot${s}`, d)
  }

  /** Toe extension (+ = toes pulled up) at the ball, and curl at the toe joints. */
  setToes(s: Side, ext = 0, curl = 0) {
    ext = clamp(ext, LIMITS.toeExt)
    curl = clamp(curl, LIMITS.toeCurl)
    for (const t of TOES) {
      this.setDelta(`toe${t}-1${s}`, new THREE.Quaternion().setFromAxisAngle(X, -ext * D2R))
      for (const j of [2, 3]) {
        const n = `toe${t}-${j}${s}`
        if (this.bones[n]) this.setDelta(n, new THREE.Quaternion().setFromAxisAngle(X, curl * D2R))
      }
    }
  }

  // ---------------------------------------------------------------- IK
  /**
   * Two-bone IK. Places `end` at `target`, with the middle joint pointing toward `pole`.
   * Hinge-plane preserving: the upper bone is re-aimed together with its bend/front reference,
   * then the lower bone is aimed at the target.
   */
  private twoBone(upper: string, mid: string, end: string, target: THREE.Vector3, pole: THREE.Vector3, frontRef: 'rest-z' | 'bend', maxReach = 0.999) {
    const A = this.worldPos(upper)
    const Bc = this.worldPos(mid)
    const Cc = this.worldPos(end)
    const a = this.rest[upper].worldP.distanceTo(this.rest[mid].worldP)
    const b = this.rest[mid].worldP.distanceTo(this.rest[end].worldP)
    const toT = target.clone().sub(A)
    const dist = THREE.MathUtils.clamp(toT.length(), Math.abs(a - b) + 0.02, (a + b) * maxReach)
    const dir = toT.normalize()
    const cosA = (a * a + dist * dist - b * b) / (2 * a * dist)
    const sinA = Math.sqrt(Math.max(0, 1 - cosA * cosA))
    const perp = pole.clone().addScaledVector(dir, -pole.dot(dir))
    if (perp.lengthSq() < 1e-8) perp.copy(Z)
    perp.normalize()
    const B = A.clone().addScaledVector(dir, a * cosA).addScaledVector(perp, a * sinA)
    const C = A.clone().addScaledVector(dir, dist)

    // current and desired frames of the upper bone
    const curDir = Bc.clone().sub(A).normalize()
    const newDir = B.clone().sub(A).normalize()
    let curRef: THREE.Vector3
    let newRef: THREE.Vector3
    if (frontRef === 'rest-z') {
      // legs: the knee's anterior direction, carried by the bone's current rotation
      const curQ = this.worldQuat(upper)
      curRef = Z.clone().applyQuaternion(curQ.clone().multiply(this.rest[upper].worldQ.clone().invert()))
      newRef = perp.clone()
    } else {
      // arms: the direction the lower bone bends toward
      curRef = Cc.clone().sub(A)
      newRef = C.clone().sub(A)
    }
    const D = basis(newDir, newRef).multiply(basis(curDir, curRef).invert())
    this.setWorldQuat(upper, D.multiply(this.worldQuat(upper)))

    const midNow = this.worldPos(mid)
    const endNow = this.worldPos(end)
    const D2 = new THREE.Quaternion().setFromUnitVectors(endNow.sub(midNow).normalize(), C.clone().sub(midNow).normalize())
    this.setWorldQuat(mid, D2.multiply(this.worldQuat(mid)))
  }

  /** Put the ankle at `ankle`, knee toward `pole`. */
  solveLeg(s: Side, ankle: THREE.Vector3, pole: THREE.Vector3) {
    this.twoBone(`upperleg01${s}`, `lowerleg01${s}`, `foot${s}`, ankle, pole, 'rest-z')
  }

  /** Put the wrist at `wrist`, elbow toward `pole`. */
  solveArm(s: Side, wrist: THREE.Vector3, pole: THREE.Vector3) {
    this.twoBone(`upperarm01${s}`, `lowerarm01${s}`, `wrist${s}`, wrist, pole, 'bend')
  }

  /** Foot world orientation: yaw (toes turned out +), pitch (+ = heel up / plantarflexed), roll (+ = sole turned in). */
  footWorldQuat(s: Side, yaw = 0, pitch = 0, roll = 0) {
    const sx = s === 'L' ? 1 : -1
    return new THREE.Quaternion()
      .setFromAxisAngle(Y, sx * yaw * D2R)
      .multiply(new THREE.Quaternion().setFromAxisAngle(X, pitch * D2R))
      .multiply(new THREE.Quaternion().setFromAxisAngle(Z, -sx * roll * D2R))
      .multiply(this.rest[`foot${s}`].worldQ)
  }

  /**
   * Where the ankle must be so the foot rests on a contact point with the given orientation.
   * pivot: 'ball' keeps the ball of the foot on `contact` (heel raises), 'heel' the heel, 'flat' the sole centre.
   */
  plantedAnkle(s: Side, contact: THREE.Vector3, q: THREE.Quaternion, pivot: 'ball' | 'heel' | 'flat') {
    const ankleRest = this.rest[`foot${s}`].worldP
    const sx = s === 'L' ? 1 : -1
    const ref = new THREE.Vector3(ankleRest.x, 0, pivot === 'ball' ? this.metrics.ballZ : pivot === 'heel' ? this.metrics.heelZ : (this.metrics.ballZ + this.metrics.heelZ) / 2)
    void sx
    const off = ankleRest.clone().sub(ref) // ankle relative to the contact point, foot flat
    const restQ = this.rest[`foot${s}`].worldQ
    const delta = q.clone().multiply(restQ.clone().invert())
    return contact.clone().add(off.applyQuaternion(delta))
  }

  // ---------------------------------------------------------------- hands
  /** Hand world orientation from where the fingers point and which way the palm faces. */
  setHand(s: Side, fingers: THREE.Vector3, palm: THREE.Vector3) {
    const r = this.handRest[s]
    const D = basis(fingers, palm).multiply(basis(r.fingers, r.palm).invert())
    this.setWorldQuat(`wrist${s}`, D.multiply(this.rest[`wrist${s}`].worldQ))
  }

  setHandShape(s: Side, shape: HandShape, amount = 1) {
    const sh = HAND_SHAPES[shape]
    const { knuckle, fingers, palm } = this.handRest[s]
    const sign = this.curlSign[s]
    for (const f of FINGERS) {
      const thumb = f === 1
      for (const j of [1, 2, 3]) {
        const n = `finger${f}-${j}${s}`
        if (!this.bones[n]) continue
        const deg = (thumb ? sh.thumb * (j === 1 ? 0.6 : 1) : sh.curl[j - 1]) * amount
        const axis = thumb ? knuckle.clone().add(fingers).normalize() : knuckle
        let q = new THREE.Quaternion().setFromAxisAngle(axis, sign * deg * D2R)
        if (j === 1 && !thumb && sh.spread) {
          // spread fingers apart around the palm normal (index and pinky most)
          const spread = (f - 3) * sh.spread * amount * (s === 'L' ? 1 : -1)
          q = new THREE.Quaternion().setFromAxisAngle(palm, spread * D2R).multiply(q)
        }
        this.setDelta(n, q)
      }
    }
  }

  /** Rest-pose hand frame (fingers, palm normal) for a side. */
  handFrame(s: Side) {
    return this.handRest[s]
  }

  /** World position of a point given in a bone's frame, expressed in rest-pose world axes. */
  pointOn(bone: string, offset: V3, out = new THREE.Vector3()) {
    const q = this.worldQuat(bone).multiply(this.rest[bone].worldQ.clone().invert())
    return this.worldPos(bone, out).add(_v.set(...offset).applyQuaternion(q))
  }
  /** A rest-pose world direction carried along by a bone's current rotation. */
  dirOn(bone: string, dir: V3, out = new THREE.Vector3()) {
    const q = this.worldQuat(bone).multiply(this.rest[bone].worldQ.clone().invert())
    return out.set(...dir).applyQuaternion(q).normalize()
  }

  /** Lowest point of the feet (heels and toes) in world Y, to check floor contact. */
  footFloorGap(s: Side) {
    const heel = this.pointOn(`foot${s}`, [0, -this.rest[`foot${s}`].worldP.y, -0.07], _v2)
    return heel.y
  }
}
