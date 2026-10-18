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
export type Target = 'fascia' | 'gastrocnemius' | 'soleus' | 'none'

const BODY = new THREE.Color('#c9d1d9')
const JOINT = new THREE.Color('#9aa6b2')
const HIGHLIGHT = new THREE.Color('#ff6a3d')

function capsule(radius: number, length: number, mat: THREE.Material) {
  const m = new THREE.Mesh(new THREE.CapsuleGeometry(radius, length, 6, 16), mat)
  m.castShadow = true
  return m
}
function sphere(radius: number, mat: THREE.Material) {
  const m = new THREE.Mesh(new THREE.SphereGeometry(radius, 20, 14), mat)
  m.castShadow = true
  return m
}
/** Capsule hanging down from the joint along -Y. */
function limb(radius: number, length: number, mat: THREE.Material) {
  const m = capsule(radius, Math.max(0.001, length - 2 * radius), mat)
  m.position.y = -length / 2
  return m
}

interface Leg {
  hip: THREE.Group
  knee: THREE.Group
  ankle: THREE.Group
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
  private highlightMats: Record<Exclude<Target, 'none'>, THREE.MeshStandardMaterial>
  private highlightMeshes: Record<Exclude<Target, 'none'>, THREE.Mesh[]> = { fascia: [], gastrocnemius: [], soleus: [] }

  constructor() {
    const body = new THREE.MeshStandardMaterial({ color: BODY, roughness: 0.55, metalness: 0.05 })
    const joint = new THREE.MeshStandardMaterial({ color: JOINT, roughness: 0.6 })
    const mkHL = () =>
      new THREE.MeshStandardMaterial({
        color: HIGHLIGHT, emissive: HIGHLIGHT, emissiveIntensity: 0.4, roughness: 0.4,
        transparent: true, opacity: 0.95,
      })
    this.highlightMats = { fascia: mkHL(), gastrocnemius: mkHL(), soleus: mkHL() }

    this.root.add(this.pelvis)

    // pelvis block
    const pelvisMesh = capsule(0.1, 0.1, body)
    pelvisMesh.rotation.z = Math.PI / 2
    pelvisMesh.scale.set(0.95, 1, 0.75)
    pelvisMesh.position.y = 0.03
    this.pelvis.add(pelvisMesh)

    // spine / torso
    this.spine.position.set(0, DIM.spineY, -0.005)
    this.pelvis.add(this.spine)
    const abdomen = capsule(0.105, 0.12, body)
    abdomen.scale.set(1.1, 1, 0.8)
    abdomen.position.y = 0.1
    this.spine.add(abdomen)
    const chest = capsule(0.13, 0.16, body)
    chest.scale.set(1.15, 1, 0.75)
    chest.position.y = 0.3
    this.spine.add(chest)

    this.neck.position.set(0, 0.46, 0)
    this.spine.add(this.neck)
    const neckMesh = capsule(0.04, 0.05, joint)
    neckMesh.position.y = 0.03
    this.neck.add(neckMesh)
    const head = sphere(0.1, body)
    head.scale.set(0.9, 1.08, 1)
    head.position.set(0, 0.14, 0.01)
    this.neck.add(head)
    const nose = sphere(0.022, joint)
    nose.position.set(0, 0.14, 0.105)
    this.neck.add(nose)

    const mkLeg = (side: SideKey): Leg => {
      const sx = side === 'R' ? -1 : 1
      const hip = new THREE.Group()
      hip.position.set(sx * DIM.hipX, 0, 0)
      this.pelvis.add(hip)
      hip.add(sphere(0.07, joint))
      const thigh = limb(0.075, DIM.thigh, body)
      thigh.scale.set(1, 1, 1.05)
      hip.add(thigh)

      const knee = new THREE.Group()
      knee.position.y = -DIM.thigh
      hip.add(knee)
      knee.add(sphere(0.058, joint))
      knee.add(limb(0.052, DIM.shin, body))
      // calf muscles on the back of the shin (-Z): gastrocnemius high, soleus lower
      const gast = capsule(0.042, 0.11, this.highlightMats.gastrocnemius)
      gast.position.set(0, -0.15, -0.035)
      gast.scale.set(1.15, 1, 0.9)
      knee.add(gast)
      const sol = capsule(0.036, 0.1, this.highlightMats.soleus)
      sol.position.set(0, -0.29, -0.028)
      sol.scale.set(1.1, 1, 0.85)
      knee.add(sol)
      if (side === 'R') {
        this.highlightMeshes.gastrocnemius.push(gast)
        this.highlightMeshes.soleus.push(sol)
      } else {
        gast.material = body
        sol.material = body
      }

      const ankle = new THREE.Group()
      ankle.position.y = -DIM.shin
      knee.add(ankle)
      ankle.add(sphere(0.042, joint))
      // foot body: heel to ball
      const foot = capsule(0.04, 0.13, body)
      foot.rotation.x = Math.PI / 2
      foot.scale.set(1.08, 1, 0.78) // (x, length, height) after rotation
      foot.position.set(0, -0.044, 0.03)
      ankle.add(foot)
      const heel = sphere(0.038, body)
      heel.position.set(0, -0.042, -0.045)
      ankle.add(heel)
      // plantar fascia: heel to ball along the sole
      const pf = capsule(0.009, 0.19, this.highlightMats.fascia)
      pf.rotation.x = Math.PI / 2 - 0.08
      pf.scale.set(1.8, 1, 1)
      pf.position.set(0, -0.069, 0.035)
      ankle.add(pf)
      if (side === 'R') this.highlightMeshes.fascia.push(pf)
      else pf.visible = false

      const toes = new THREE.Group()
      toes.position.set(0, DIM.ballY, DIM.ballZ)
      ankle.add(toes)
      const toeMesh = capsule(0.02, 0.035, joint)
      toeMesh.rotation.x = Math.PI / 2
      toeMesh.scale.set(1.9, 1, 0.85)
      toeMesh.position.set(0, -0.004, 0.035)
      toes.add(toeMesh)
      const pfToe = capsule(0.009, 0.03, this.highlightMats.fascia)
      pfToe.rotation.x = Math.PI / 2
      pfToe.scale.set(2.2, 1, 1)
      pfToe.position.set(0, -0.016, 0.018)
      toes.add(pfToe)
      if (side === 'R') this.highlightMeshes.fascia.push(pfToe)
      else pfToe.visible = false

      return { hip, knee, ankle, toes }
    }

    const mkArm = (side: SideKey): Arm => {
      const sx = side === 'R' ? -1 : 1
      const shoulder = new THREE.Group()
      shoulder.position.set(sx * DIM.shoulderX, DIM.shoulderY, 0)
      this.spine.add(shoulder)
      shoulder.add(sphere(0.05, joint))
      shoulder.add(limb(0.045, DIM.upperArm, body))
      const elbow = new THREE.Group()
      elbow.position.y = -DIM.upperArm
      shoulder.add(elbow)
      elbow.add(sphere(0.04, joint))
      elbow.add(limb(0.037, DIM.forearm, body))
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
    this.setHighlight('none', 0)
  }

  setHighlight(target: Target, intensity: number) {
    for (const key of Object.keys(this.highlightMeshes) as Exclude<Target, 'none'>[]) {
      const on = key === target
      const mat = this.highlightMats[key]
      mat.color.copy(on ? HIGHLIGHT : BODY)
      mat.emissive.copy(on ? HIGHLIGHT : BODY)
      mat.emissiveIntensity = on ? 0.15 + 0.85 * intensity : 0
      this.highlightMeshes[key].forEach((m) => {
        // the fascia strip only exists visually when highlighted; calf muscles stay as body shape
        m.visible = on || key !== 'fascia'
      })
    }
  }

  /** Resets every joint to the neutral standing pose. */
  reset() {
    const all = [this.pelvis, this.spine, this.neck]
    for (const s of ['R', 'L'] as SideKey[]) {
      const l = this.legs[s]
      const a = this.arms[s]
      all.push(l.hip, l.knee, l.ankle, l.toes, a.shoulder, a.elbow, a.wrist)
    }
    all.forEach((g) => g.quaternion.identity())
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
