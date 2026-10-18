import * as THREE from 'three'

/**
 * Procedural mannequin built from primitives, with a real joint hierarchy:
 *   root > pelvis > hip > knee > ankle > foot > toes
 *               > spine > neck > head
 *               > spine > shoulder > elbow > wrist > hand
 * Units are metres. The figure faces +Z, so its right side is at -X.
 */

export const DIM = {
  hipX: 0.09,
  thigh: 0.43,
  shin: 0.43,
  ankleH: 0.075, // ankle joint height above the sole
  spineY: 0.1,
  shoulderY: 0.42,
  shoulderX: 0.19,
  upperArm: 0.29,
  forearm: 0.25,
  // foot, in the foot's local frame (origin at the ankle)
  heelZ: -0.07,
  ballZ: 0.13, // metatarsophalangeal joint (ball of the foot)
  ballY: -0.055,
}

export type SideKey = 'R' | 'L'
export type Target = 'fascia' | 'gastrocnemius' | 'soleus' | 'hip' | 'quads' | 'invertors'

const BODY = new THREE.Color('#d3d8de')
const JOINT = new THREE.Color('#a7b1bc')
const HIGHLIGHT = new THREE.Color('#ff6a3d')

function capsule(radius: number, length: number, mat: THREE.Material) {
  const m = new THREE.Mesh(new THREE.CapsuleGeometry(radius, length, 6, 16), mat)
  m.castShadow = true
  return m
}
function sphere(radius: number, mat: THREE.Material) {
  const m = new THREE.Mesh(new THREE.SphereGeometry(radius, 24, 16), mat)
  m.castShadow = true
  return m
}
function ellipsoid(sx: number, sy: number, sz: number, mat: THREE.Material) {
  const m = sphere(1, mat)
  m.scale.set(sx, sy, sz)
  return m
}

/**
 * Smooth tapered segment hanging from the joint along -Y, with rounded ends.
 * `radii` are sampled evenly from top to bottom (muscle shape).
 */
function taper(len: number, radii: number[], mat: THREE.Material) {
  const at = (t: number) => {
    const f = t * (radii.length - 1)
    const i = Math.min(radii.length - 2, Math.floor(f))
    const u = f - i
    const w = 0.5 - 0.5 * Math.cos(Math.PI * u)
    return radii[i] * (1 - w) + radii[i + 1] * w
  }
  const pts: THREE.Vector2[] = []
  const r0 = radii[0]
  const rN = radii[radii.length - 1]
  for (let k = 0; k <= 6; k++) {
    const a = (Math.PI / 2) * (1 - k / 6)
    pts.push(new THREE.Vector2(r0 * Math.cos(a), r0 * Math.sin(a) * 0.7))
  }
  for (let k = 1; k < 24; k++) {
    const t = k / 24
    pts.push(new THREE.Vector2(at(t), -t * len))
  }
  for (let k = 0; k <= 6; k++) {
    const a = (-Math.PI / 2) * (k / 6)
    pts.push(new THREE.Vector2(rN * Math.cos(a), -len + rN * Math.sin(a) * 0.7))
  }
  const m = new THREE.Mesh(new THREE.LatheGeometry(pts, 24), mat)
  m.castShadow = true
  return m
}

/** Thin capsule spanning two points (in the parent's frame). */
function band(a: THREE.Vector3, b: THREE.Vector3, r: number, mat: THREE.Material) {
  const d = b.clone().sub(a)
  const m = capsule(r, Math.max(0.001, d.length()), mat)
  m.position.copy(a).add(b).multiplyScalar(0.5)
  m.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), d.normalize())
  m.castShadow = false
  return m
}

/** Toes from the big toe (medial) to the little toe: x offset toward medial, base z, length, radius. */
const TOES: [number, number, number, number][] = [
  [0.027, 0.0, 0.036, 0.0135],
  [0.006, -0.004, 0.031, 0.0095],
  [-0.011, -0.009, 0.027, 0.009],
  [-0.025, -0.015, 0.023, 0.0085],
  [-0.037, -0.023, 0.019, 0.008],
]
const MID_JOINT = new THREE.Vector3(0, -0.05, 0.02)

interface Leg {
  hip: THREE.Group
  knee: THREE.Group
  ankle: THREE.Group
  /** Midfoot (arch) joint: forefoot hinges here. */
  mid: THREE.Group
  toes: THREE.Group
}
interface Arm {
  shoulder: THREE.Group
  elbow: THREE.Group
  wrist: THREE.Group
}

// scratch objects
const _v1 = new THREE.Vector3()
const _v2 = new THREE.Vector3()
const _v3 = new THREE.Vector3()
const _q1 = new THREE.Quaternion()
const _m = new THREE.Matrix4()

export class Mannequin {
  root = new THREE.Group()
  pelvis = new THREE.Group()
  spine = new THREE.Group()
  neck = new THREE.Group()
  legs: Record<SideKey, Leg>
  arms: Record<SideKey, Arm>
  private eyes: THREE.Mesh[] = []
  private highlightMats = {} as Record<Target, THREE.MeshStandardMaterial>
  private highlightMeshes: Record<Target, THREE.Mesh[]> = {
    fascia: [], gastrocnemius: [], soleus: [], hip: [], quads: [], invertors: [],
  }
  /** Meshes that only exist to show a highlighted tissue (hidden when not highlighted). */
  private overlayOnly = new Set<Target>(['fascia', 'invertors', 'quads', 'hip'])

  constructor() {
    const body = new THREE.MeshStandardMaterial({ color: BODY, roughness: 0.6, metalness: 0.02 })
    const joint = new THREE.MeshStandardMaterial({ color: JOINT, roughness: 0.6 })
    const dark = new THREE.MeshStandardMaterial({ color: '#39424c', roughness: 0.4 })
    for (const k of Object.keys(this.highlightMeshes) as Target[]) {
      this.highlightMats[k] = new THREE.MeshStandardMaterial({
        color: HIGHLIGHT, emissive: HIGHLIGHT, emissiveIntensity: 0.4, roughness: 0.4,
      })
    }
    const hl = (t: Target, m: THREE.Mesh, side: SideKey) => {
      // only the affected (right, before mirroring) side carries highlights
      if (side === 'R') {
        m.material = this.highlightMats[t]
        this.highlightMeshes[t].push(m)
      } else if (this.overlayOnly.has(t)) m.visible = false
      return m
    }

    this.root.add(this.pelvis)

    // pelvis
    const pelvisMesh = ellipsoid(0.148, 0.1, 0.1, body)
    pelvisMesh.position.y = 0.03
    this.pelvis.add(pelvisMesh)
    for (const side of ['R', 'L'] as SideKey[]) {
      const sx = side === 'R' ? -1 : 1
      // gluteus medius on the side of the hip
      const glute = ellipsoid(0.035, 0.065, 0.06, body)
      glute.position.set(sx * 0.15, 0.04, -0.02)
      this.pelvis.add(hl('hip', glute, side))
    }

    // spine / torso
    this.spine.position.set(0, DIM.spineY, -0.005)
    this.pelvis.add(this.spine)
    const torso = taper(0.47, [0.115, 0.102, 0.11, 0.13, 0.137, 0.118], body)
    torso.rotation.x = Math.PI
    torso.scale.set(1.18, 1, 0.72)
    torso.position.y = -0.02
    this.spine.add(torso)

    this.neck.position.set(0, 0.46, 0)
    this.spine.add(this.neck)
    const neckMesh = taper(0.09, [0.042, 0.038], body)
    neckMesh.rotation.x = Math.PI
    this.neck.add(neckMesh)
    const head = ellipsoid(0.088, 0.108, 0.1, body)
    head.position.set(0, 0.15, 0.01)
    this.neck.add(head)
    const jaw = ellipsoid(0.066, 0.06, 0.07, body)
    jaw.position.set(0, 0.095, 0.035)
    this.neck.add(jaw)
    const nose = ellipsoid(0.013, 0.022, 0.016, body)
    nose.position.set(0, 0.135, 0.105)
    this.neck.add(nose)
    for (const sx of [-1, 1]) {
      const ear = ellipsoid(0.012, 0.024, 0.018, body)
      ear.position.set(sx * 0.088, 0.145, 0.005)
      this.neck.add(ear)
      const eye = sphere(0.011, dark)
      eye.position.set(sx * 0.033, 0.163, 0.093)
      eye.castShadow = false
      this.neck.add(eye)
      this.eyes.push(eye)
    }

    const mkLeg = (side: SideKey): Leg => {
      const sx = side === 'R' ? -1 : 1
      const med = -sx // medial direction (towards the midline)
      const hip = new THREE.Group()
      hip.position.set(sx * DIM.hipX, 0, 0)
      this.pelvis.add(hip)
      hip.add(sphere(0.072, body))
      const thigh = taper(DIM.thigh, [0.084, 0.08, 0.071, 0.06, 0.054], body)
      thigh.scale.set(1, 1, 1.06)
      hip.add(thigh)
      const quad = ellipsoid(0.05, 0.13, 0.035, body)
      quad.position.set(0, -0.2, 0.05)
      hip.add(hl('quads', quad, side))

      const knee = new THREE.Group()
      knee.position.y = -DIM.thigh
      hip.add(knee)
      knee.add(sphere(0.054, joint))
      const patella = ellipsoid(0.03, 0.035, 0.02, joint)
      patella.position.set(0, 0.005, 0.045)
      knee.add(patella)
      knee.add(taper(DIM.shin, [0.054, 0.05, 0.043, 0.036, 0.031], body))
      // calf muscles on the back of the shin (-Z): gastrocnemius high, soleus lower
      const gast = ellipsoid(0.045, 0.09, 0.036, body)
      gast.position.set(0, -0.14, -0.035)
      knee.add(hl('gastrocnemius', gast, side))
      const sol = ellipsoid(0.038, 0.075, 0.028, body)
      sol.position.set(0, -0.27, -0.025)
      knee.add(hl('soleus', sol, side))
      const tibPost = ellipsoid(0.014, 0.085, 0.018, body)
      tibPost.position.set(med * 0.034, -0.31, -0.008)
      knee.add(hl('invertors', tibPost, side))

      const ankle = new THREE.Group()
      ankle.position.y = -DIM.shin
      knee.add(ankle)
      ankle.add(sphere(0.034, joint))
      for (const s of [-1, 1]) {
        const mall = sphere(0.014, joint)
        mall.position.set(s * 0.033, -0.005, -0.004)
        ankle.add(mall)
      }
      // rearfoot: heel
      const heel = ellipsoid(0.034, 0.033, 0.044, body)
      heel.position.set(0, -0.044, -0.04)
      ankle.add(heel)
      const rearBody = ellipsoid(0.036, 0.03, 0.045, body)
      rearBody.position.set(0, -0.04, 0.0)
      ankle.add(rearBody)
      ankle.add(hl('fascia', band(new THREE.Vector3(0, -0.071, -0.06), new THREE.Vector3(0, -0.07, MID_JOINT.z), 0.007, body), side))

      // midfoot + forefoot, hinged at the arch
      const mid = new THREE.Group()
      mid.position.copy(MID_JOINT)
      ankle.add(mid)
      const midBody = ellipsoid(0.039, 0.024, 0.055, body)
      midBody.position.set(-med * 0.004, 0.006, 0.035)
      mid.add(midBody)
      const fore = ellipsoid(0.047, 0.021, 0.042, body)
      fore.position.set(med * 0.002, 0.0, 0.082)
      mid.add(fore)

      const toes = new THREE.Group()
      toes.position.set(0, DIM.ballY - MID_JOINT.y, DIM.ballZ - MID_JOINT.z)
      mid.add(toes)
      for (const [x, z0, len, r] of TOES) {
        const tx = med * x
        const toe = capsule(r, len, joint)
        toe.rotation.x = Math.PI / 2
        toe.scale.set(1, 1, 0.85)
        toe.position.set(tx, -0.02 + r * 0.85, z0 + len / 2 + r * 0.2)
        toes.add(toe)
        // fascia slips: from the heel band, fanning out to each toe
        mid.add(hl('fascia', band(new THREE.Vector3(0, -0.021, 0.0), new THREE.Vector3(tx * 0.9, -0.022, toes.position.z + z0), 0.0045, body), side))
        toes.add(hl('fascia', band(new THREE.Vector3(tx, -0.021, z0), new THREE.Vector3(tx, -0.02, z0 + len * 0.55), 0.004, body), side))
      }

      return { hip, knee, ankle, mid, toes }
    }

    const mkArm = (side: SideKey): Arm => {
      const sx = side === 'R' ? -1 : 1
      const shoulder = new THREE.Group()
      shoulder.position.set(sx * DIM.shoulderX, DIM.shoulderY, 0)
      this.spine.add(shoulder)
      shoulder.add(sphere(0.056, body))
      shoulder.add(taper(DIM.upperArm, [0.05, 0.046, 0.04, 0.036], body))
      const elbow = new THREE.Group()
      elbow.position.y = -DIM.upperArm
      shoulder.add(elbow)
      elbow.add(sphere(0.037, joint))
      elbow.add(taper(DIM.forearm, [0.04, 0.038, 0.03, 0.026], body))
      const wrist = new THREE.Group()
      wrist.position.y = -DIM.forearm
      elbow.add(wrist)
      // hand: palm faces local +Z, fingers point along -Y
      const palm = capsule(0.036, 0.04, body)
      palm.scale.set(1.05, 1, 0.45)
      palm.position.y = -0.055
      wrist.add(palm)
      const fingers = capsule(0.032, 0.045, joint)
      fingers.scale.set(1, 1, 0.42)
      fingers.position.set(0, -0.125, 0.006)
      fingers.rotation.x = -0.25 // slight curl toward the palm
      wrist.add(fingers)
      const thumb = capsule(0.012, 0.035, joint)
      thumb.position.set(-sx * 0.04, -0.06, 0.018)
      thumb.rotation.z = sx * 0.5
      wrist.add(thumb)
      return { shoulder, elbow, wrist }
    }

    this.legs = { R: mkLeg('R'), L: mkLeg('L') }
    this.arms = { R: mkArm('R'), L: mkArm('L') }
    this.setHighlight([], 0)
  }

  setHighlight(targets: Target[], intensity: number) {
    for (const key of Object.keys(this.highlightMeshes) as Target[]) {
      const on = targets.includes(key)
      const mat = this.highlightMats[key]
      mat.color.copy(on ? HIGHLIGHT : BODY)
      mat.emissive.copy(on ? HIGHLIGHT : BODY)
      mat.emissiveIntensity = on ? 0.15 + 0.85 * intensity : 0
      const show = on || !this.overlayOnly.has(key)
      this.highlightMeshes[key].forEach((m) => (m.visible = show))
    }
  }

  /** 1 = eyes open, 0 = closed. */
  setEyes(open: number) {
    this.eyes.forEach((e) => e.scale.set(1, Math.max(0.12, open), 1))
  }

  /** Resets every joint to the neutral standing pose. */
  reset() {
    const all = [this.pelvis, this.spine, this.neck]
    for (const s of ['R', 'L'] as SideKey[]) {
      const l = this.legs[s]
      const a = this.arms[s]
      all.push(l.hip, l.knee, l.ankle, l.mid, l.toes, a.shoulder, a.elbow, a.wrist)
    }
    all.forEach((g) => g.quaternion.identity())
    this.setEyes(1)
    this.pelvis.position.set(0, DIM.thigh + DIM.shin + DIM.ankleH, 0)
    this.root.updateMatrixWorld(true)
  }

  setPelvis(pos: THREE.Vector3, rot: THREE.Euler) {
    this.pelvis.position.copy(pos)
    this.pelvis.quaternion.setFromEuler(rot)
    this.pelvis.updateMatrixWorld(true)
  }

  /** Position the pelvis so that the given hip joint lands on `hipWorld`. */
  placePelvisByHip(side: SideKey, hipWorld: THREE.Vector3, rot: THREE.Euler) {
    this.pelvis.quaternion.setFromEuler(rot)
    const off = _v1.copy(this.legs[side].hip.position).applyQuaternion(this.pelvis.quaternion)
    // pelvis lives directly under root, which is identity apart from mirroring handled outside
    this.pelvis.position.copy(hipWorld).sub(off)
    this.pelvis.updateMatrixWorld(true)
  }

  setSpine(rot: THREE.Euler, neck?: THREE.Euler) {
    this.spine.quaternion.setFromEuler(rot)
    if (neck) this.neck.quaternion.setFromEuler(neck)
    else this.neck.quaternion.identity()
    this.spine.updateMatrixWorld(true)
  }

  /**
   * Two-bone IK. `upper` rotates at `upper`'s origin, `mid` is the hinge joint, `end` is the
   * joint we want to land on `target`. `pole` is the world direction the hinge should point to
   * (knees forward, elbows back). Positions are in root space.
   */
  private solveTwoBone(
    upper: THREE.Group, mid: THREE.Group, lenA: number, lenB: number,
    target: THREE.Vector3, pole: THREE.Vector3, hingePointsMinusZ: boolean,
  ) {
    const parent = upper.parent!
    parent.updateMatrixWorld(true)
    const rootInv = _m.copy(this.root.matrixWorld).invert()
    const base = _v1.setFromMatrixPosition(upper.matrixWorld).applyMatrix4(rootInv)
    const toT = _v2.copy(target).sub(base)
    const dist = THREE.MathUtils.clamp(toT.length(), 0.05, lenA + lenB - 1e-4)
    const dir = toT.normalize()
    const cosA = (lenA * lenA + dist * dist - lenB * lenB) / (2 * lenA * dist)
    const sinA = Math.sqrt(Math.max(0, 1 - cosA * cosA))
    const perp = _v3.copy(pole).addScaledVector(dir, -pole.dot(dir))
    if (perp.lengthSq() < 1e-8) perp.set(0, 0, 1).addScaledVector(dir, -dir.z)
    perp.normalize()
    const midPos = base.clone().addScaledVector(dir, lenA * cosA).addScaledVector(perp, lenA * sinA)
    const endPos = base.clone().addScaledVector(dir, dist)

    // upper bone world basis: Y up the bone, Z towards (or away from) the pole
    const yA = base.clone().sub(midPos).normalize()
    const zA = perp.clone().addScaledVector(yA, -perp.dot(yA)).normalize()
    if (hingePointsMinusZ) zA.negate()
    const xA = new THREE.Vector3().crossVectors(yA, zA).normalize()
    zA.crossVectors(xA, yA)
    const qUpperRoot = new THREE.Quaternion().setFromRotationMatrix(new THREE.Matrix4().makeBasis(xA, yA, zA))

    const yB = midPos.clone().sub(endPos).normalize()
    const zB = new THREE.Vector3().crossVectors(xA, yB).normalize()
    const qMidRoot = new THREE.Quaternion().setFromRotationMatrix(new THREE.Matrix4().makeBasis(xA, yB, zB))

    // convert root-space orientations to local
    const parentRootQ = this.rootSpaceQuat(parent, _q1)
    upper.quaternion.copy(parentRootQ.invert().multiply(qUpperRoot))
    mid.quaternion.copy(qUpperRoot.clone().invert().multiply(qMidRoot))
    upper.updateMatrixWorld(true)
  }

  /** Orientation of an object relative to the mannequin root (robust to a mirrored parent). */
  rootSpaceQuat(obj: THREE.Object3D, out: THREE.Quaternion) {
    out.identity()
    let o: THREE.Object3D | null = obj
    while (o && o !== this.root) {
      out.premultiply(o.quaternion)
      o = o.parent
    }
    return out
  }

  rootSpacePos(obj: THREE.Object3D, out = new THREE.Vector3()) {
    obj.updateWorldMatrix(true, false)
    out.setFromMatrixPosition(obj.matrixWorld)
    return out.applyMatrix4(_m.copy(this.root.matrixWorld).invert())
  }

  /** Root-space point in an object's local frame. */
  pointOn(obj: THREE.Object3D, local: THREE.Vector3, out = new THREE.Vector3()) {
    obj.updateWorldMatrix(true, false)
    out.copy(local).applyMatrix4(obj.matrixWorld)
    return out.applyMatrix4(_m.copy(this.root.matrixWorld).invert())
  }

  solveLeg(side: SideKey, ankleTarget: THREE.Vector3, kneePole: THREE.Vector3) {
    const l = this.legs[side]
    this.solveTwoBone(l.hip, l.knee, DIM.thigh, DIM.shin, ankleTarget, kneePole, false)
  }

  solveArm(side: SideKey, wristTarget: THREE.Vector3, elbowPole: THREE.Vector3) {
    const a = this.arms[side]
    this.solveTwoBone(a.shoulder, a.elbow, DIM.upperArm, DIM.forearm, wristTarget, elbowPole, true)
  }

  /** Set an ankle/wrist joint so its child segment has the given root-space orientation. */
  setRootOrientation(joint: THREE.Group, q: THREE.Quaternion) {
    const parentQ = this.rootSpaceQuat(joint.parent!, _q1)
    joint.quaternion.copy(parentQ.invert().multiply(q))
    joint.updateMatrixWorld(true)
  }

  setFoot(side: SideKey, q: THREE.Quaternion) {
    this.setRootOrientation(this.legs[side].ankle, q)
  }

  /** Ankle angles relative to the shin, in degrees. dorsi: toes up (+). inversion: sole turns in (+). */
  setAnkle(side: SideKey, dorsi: number, inversion = 0) {
    const sx = side === 'R' ? -1 : 1
    const e = new THREE.Euler(-THREE.MathUtils.degToRad(dorsi), 0, -sx * THREE.MathUtils.degToRad(inversion), 'XZY')
    this.legs[side].ankle.quaternion.setFromEuler(e)
    this.legs[side].ankle.updateMatrixWorld(true)
  }

  /** Toe extension at the ball of the foot, degrees (+ = toes pulled up). */
  setToes(side: SideKey, extension: number) {
    this.legs[side].toes.quaternion.setFromAxisAngle(new THREE.Vector3(1, 0, 0), -THREE.MathUtils.degToRad(extension))
    this.legs[side].toes.updateMatrixWorld(true)
  }

  /** Arch (midfoot) flexion, degrees: + lifts the arch by tipping the forefoot down. */
  setArch(side: SideKey, deg: number) {
    this.legs[side].mid.quaternion.setFromAxisAngle(new THREE.Vector3(1, 0, 0), THREE.MathUtils.degToRad(deg))
    this.legs[side].mid.updateMatrixWorld(true)
  }

  /** Root-space centre of a foot, used to aim the foot close-up camera. */
  footCenter(side: SideKey, out = new THREE.Vector3()) {
    return this.pointOn(this.legs[side].mid, new THREE.Vector3(0, -0.01, 0.03), out)
  }

  setHand(side: SideKey, q: THREE.Quaternion) {
    this.setRootOrientation(this.arms[side].wrist, q)
  }
}

/** Orientation whose local +Z is `forward` and local +Y is as close to `up` as possible. */
export function basisQuat(forward: THREE.Vector3, up: THREE.Vector3) {
  const z = forward.clone().normalize()
  const y = up.clone().addScaledVector(z, -up.dot(z)).normalize()
  const x = new THREE.Vector3().crossVectors(y, z)
  return new THREE.Quaternion().setFromRotationMatrix(new THREE.Matrix4().makeBasis(x, y, z))
}

/** Hand orientation: fingers along `fingers`, palm facing `palm`. (Hand local: fingers -Y, palm +Z.) */
export function handQuat(fingers: THREE.Vector3, palm: THREE.Vector3) {
  const y = fingers.clone().normalize().negate()
  const z = palm.clone().addScaledVector(y, -palm.dot(y)).normalize()
  const x = new THREE.Vector3().crossVectors(y, z)
  return new THREE.Quaternion().setFromRotationMatrix(new THREE.Matrix4().makeBasis(x, y, z))
}
