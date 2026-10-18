import * as THREE from 'three'
import { BodyRig, type HandShape, type Side, type V3 } from './rig'

/**
 * Pose data format. Stretches are authored for the RIGHT side as the working side and mirrored
 * for the left. Positions are metres for the reference (male) body and are scaled to the body in
 * use. Angles are degrees, anatomical, relative to the bind pose (standing, arms in an A-pose).
 */
export interface Keyframe {
  pelvis: {
    /** Root (pelvis) bone position. Alternatively `hip` puts one hip joint at a point. */
    pos?: V3
    hip?: { side: Side; at: V3 }
    /** pitch (lean forward +), yaw (turn left +), roll (tilt toward the left, i.e. left side down +) */
    rot?: V3
  }
  spine?: { flex?: number; side?: number; twist?: number }
  neck?: { flex?: number; side?: number; twist?: number }
  legs: Record<Side, LegKey>
  arms: Record<Side, ArmKey>
  /** 1 = open, 0 = closed */
  eyes?: number
}

export type LegKey =
  | {
      /** Forward kinematics: anatomical hip/knee/ankle angles. */
      fk: { hip?: [number, number, number]; knee?: number; ankle?: [number, number] }
      toes?: [number, number]
    }
  | {
      /** Foot planted on a support: contact point, foot orientation, pivot. */
      plant: { at: V3; yaw?: number; pitch?: number; roll?: number; pivot?: 'ball' | 'heel' | 'flat' }
      /** Direction the knee points. */
      knee: V3
      toes?: [number, number]
    }
  | {
      /** Ankle placed by IK, ankle angles relative to the shin. */
      ankle: V3
      knee: V3
      angles?: [number, number]
      toes?: [number, number]
    }

export interface ArmKey {
  /** Wrist target: a world point, or a point on a bone (offset in that bone's rest-aligned frame). */
  wrist: V3 | { bone: string; offset: V3; frame?: 'bone' | 'world' }
  /** Direction the elbow points. */
  elbow: V3
  /** Hand orientation: where the fingers point and which way the palm faces (world, or on a bone). */
  hand?: { fingers: V3; palm: V3; bone?: string }
  shape?: HandShape
}

export interface PropSpec {
  kind: 'chair' | 'wall' | 'step' | 'towel' | 'bottle' | 'band' | 'mat'
  pos: V3
  size?: V3
}

export interface Clip {
  /** Keyframe names with normalised times 0..1 */
  keys: [string, number][]
  /** Seconds (enter/exit). The hold always lasts as long as the timer. */
  duration?: number
}

export interface StretchAnimation {
  id: string
  props: PropSpec[]
  keys: Record<string, Keyframe>
  enter: Clip
  hold: Clip
  exit: Clip
  /** Repeating movement for self-paced / continuous exercises (seconds per cycle). */
  cycle?: { keys: [string, number][]; seconds: number; alternate?: boolean }
  /** Breathing amplitude during the hold (degrees of spine flexion). */
  breathe?: number
  /** Preferred camera: yaw (deg, 0 = from the front, 90 = from the body's left), pitch (deg), distance (m). */
  camera: { yaw: number; pitch: number; distance: number; target?: V3 }
  /** Key shown between sets / before starting, if different from the enter clip's first key. */
  rest?: string
}

// ---------------------------------------------------------------------------------------------
// Mirroring: right-working poses -> left-working poses.

const other = (s: Side): Side => (s === 'L' ? 'R' : 'L')
const mx = ([x, y, z]: V3): V3 => [-x, y, z]
const swapBone = (b: string) => b.replace(/L$/, '\u0000').replace(/R$/, 'L').replace('\u0000', 'R')

function mirrorLeg(l: LegKey): LegKey {
  if ('fk' in l) return l
  if ('plant' in l) return { ...l, plant: { ...l.plant, at: mx(l.plant.at) }, knee: mx(l.knee) }
  return { ...l, ankle: mx(l.ankle), knee: mx(l.knee) }
}
function mirrorArm(a: ArmKey): ArmKey {
  const wrist = Array.isArray(a.wrist) ? mx(a.wrist as V3) : { ...a.wrist, bone: swapBone(a.wrist.bone), offset: mx(a.wrist.offset) }
  return {
    ...a,
    wrist,
    elbow: mx(a.elbow),
    hand: a.hand && { fingers: mx(a.hand.fingers), palm: mx(a.hand.palm), bone: a.hand.bone && swapBone(a.hand.bone) },
  }
}

export function mirrorKey(k: Keyframe): Keyframe {
  const [p, y, r] = k.pelvis.rot ?? [0, 0, 0]
  return {
    ...k,
    pelvis: {
      pos: k.pelvis.pos && mx(k.pelvis.pos),
      hip: k.pelvis.hip && { side: other(k.pelvis.hip.side), at: mx(k.pelvis.hip.at) },
      rot: [p, -y, -r],
    },
    spine: k.spine && { ...k.spine, side: -(k.spine.side ?? 0), twist: -(k.spine.twist ?? 0) },
    neck: k.neck && { ...k.neck, side: -(k.neck.side ?? 0), twist: -(k.neck.twist ?? 0) },
    legs: { L: mirrorLeg(k.legs.R), R: mirrorLeg(k.legs.L) },
    arms: { L: mirrorArm(k.arms.R), R: mirrorArm(k.arms.L) },
  }
}

export function mirrorAnimation(a: StretchAnimation): StretchAnimation {
  return {
    ...a,
    keys: Object.fromEntries(Object.entries(a.keys).map(([n, k]) => [n, mirrorKey(k)])),
    props: a.props.map((p) => ({ ...p, pos: mx(p.pos) })),
    camera: { ...a.camera, yaw: -a.camera.yaw, target: a.camera.target && mx(a.camera.target) },
  }
}

// ---------------------------------------------------------------------------------------------
// Blending: numbers lerp, rotations slerp, then the pose is solved once.

export type Blend = { a: Keyframe; b: Keyframe; t: number }

const lerp = (a: number, b: number, t: number) => a + (b - a) * t
const lerpV = (a: V3, b: V3, t: number): V3 => [lerp(a[0], b[0], t), lerp(a[1], b[1], t), lerp(a[2], b[2], t)]
const num = (v: number | undefined) => v ?? 0
const v3 = (v: V3 | undefined): V3 => v ?? [0, 0, 0]

function blendLeg(a: LegKey, b: LegKey, t: number): LegKey {
  if ('fk' in a && 'fk' in b) {
    return {
      fk: {
        hip: lerpV(a.fk.hip ?? [0, 0, 0], b.fk.hip ?? [0, 0, 0], t),
        knee: lerp(num(a.fk.knee), num(b.fk.knee), t),
        ankle: lerpV([...(a.fk.ankle ?? [0, 0]), 0] as V3, [...(b.fk.ankle ?? [0, 0]), 0] as V3, t).slice(0, 2) as [number, number],
      },
      toes: lerpV([...(a.toes ?? [0, 0]), 0] as V3, [...(b.toes ?? [0, 0]), 0] as V3, t).slice(0, 2) as [number, number],
    }
  }
  if ('plant' in a && 'plant' in b) {
    return {
      plant: {
        at: lerpV(a.plant.at, b.plant.at, t),
        yaw: lerp(num(a.plant.yaw), num(b.plant.yaw), t),
        pitch: lerp(num(a.plant.pitch), num(b.plant.pitch), t),
        roll: lerp(num(a.plant.roll), num(b.plant.roll), t),
        pivot: t < 0.5 ? a.plant.pivot : b.plant.pivot,
      },
      knee: lerpV(a.knee, b.knee, t),
      toes: lerpV([...(a.toes ?? [0, 0]), 0] as V3, [...(b.toes ?? [0, 0]), 0] as V3, t).slice(0, 2) as [number, number],
    }
  }
  if ('ankle' in a && 'ankle' in b) {
    return {
      ankle: lerpV(a.ankle, b.ankle, t),
      knee: lerpV(a.knee, b.knee, t),
      angles: lerpV([...(a.angles ?? [0, 0]), 0] as V3, [...(b.angles ?? [0, 0]), 0] as V3, t).slice(0, 2) as [number, number],
      toes: lerpV([...(a.toes ?? [0, 0]), 0] as V3, [...(b.toes ?? [0, 0]), 0] as V3, t).slice(0, 2) as [number, number],
    }
  }
  // different modes: a planted foot lifting off etc. Switch at the midpoint.
  return t < 0.5 ? a : b
}

function blendArm(a: ArmKey, b: ArmKey, t: number): ArmKey {
  const wa = a.wrist
  const wb = b.wrist
  let wrist: ArmKey['wrist']
  if (Array.isArray(wa) && Array.isArray(wb)) wrist = lerpV(wa as V3, wb as V3, t)
  else if (!Array.isArray(wa) && !Array.isArray(wb) && wa.bone === wb.bone) wrist = { ...wa, offset: lerpV(wa.offset, wb.offset, t) }
  else wrist = t < 0.5 ? wa : wb
  return {
    wrist,
    elbow: lerpV(a.elbow, b.elbow, t),
    hand:
      a.hand && b.hand && a.hand.bone === b.hand.bone
        ? { fingers: lerpV(a.hand.fingers, b.hand.fingers, t), palm: lerpV(a.hand.palm, b.hand.palm, t), bone: a.hand.bone }
        : t < 0.5 ? a.hand : b.hand,
    shape: t < 0.5 ? a.shape : b.shape,
  }
}

export function blendKeys(a: Keyframe, b: Keyframe, t: number): Keyframe {
  if (t <= 0) return a
  if (t >= 1) return b
  return {
    pelvis: {
      pos: a.pelvis.pos && b.pelvis.pos ? lerpV(a.pelvis.pos, b.pelvis.pos, t) : undefined,
      hip: a.pelvis.hip && b.pelvis.hip ? { side: a.pelvis.hip.side, at: lerpV(a.pelvis.hip.at, b.pelvis.hip.at, t) } : undefined,
      rot: lerpV(v3(a.pelvis.rot), v3(b.pelvis.rot), t),
    },
    spine: {
      flex: lerp(num(a.spine?.flex), num(b.spine?.flex), t),
      side: lerp(num(a.spine?.side), num(b.spine?.side), t),
      twist: lerp(num(a.spine?.twist), num(b.spine?.twist), t),
    },
    neck: {
      flex: lerp(num(a.neck?.flex), num(b.neck?.flex), t),
      side: lerp(num(a.neck?.side), num(b.neck?.side), t),
      twist: lerp(num(a.neck?.twist), num(b.neck?.twist), t),
    },
    legs: { L: blendLeg(a.legs.L, b.legs.L, t), R: blendLeg(a.legs.R, b.legs.R, t) },
    arms: { L: blendArm(a.arms.L, b.arms.L, t), R: blendArm(a.arms.R, b.arms.R, t) },
    eyes: lerp(a.eyes ?? 1, b.eyes ?? 1, t),
  }
}

/** Sample a clip (keyframe names at normalised times) at t in 0..1, with smooth easing per segment. */
export function sampleClip(anim: StretchAnimation, keys: [string, number][], t: number): Keyframe {
  if (keys.length === 1 || t <= keys[0][1]) return anim.keys[keys[0][0]]
  for (let i = 0; i < keys.length - 1; i++) {
    const [ka, ta] = keys[i]
    const [kb, tb] = keys[i + 1]
    if (t <= tb) {
      const u = tb > ta ? (t - ta) / (tb - ta) : 1
      const eased = 0.5 - 0.5 * Math.cos(Math.PI * u)
      return blendKeys(anim.keys[ka], anim.keys[kb], eased)
    }
  }
  return anim.keys[keys[keys.length - 1][0]]
}

// ---------------------------------------------------------------------------------------------
// Applying a keyframe to the rig.

const V = (v: V3, k = 1) => new THREE.Vector3(v[0] * k, v[1] * k, v[2] * k)

export interface ApplyOptions {
  /** Body scale relative to the reference (male) body. */
  scale: number
  /** Extra spine flexion (breathing), degrees. */
  breath?: number
}

export function applyKey(rig: BodyRig, k: Keyframe, { scale, breath = 0 }: ApplyOptions) {
  rig.reset()
  const rot = k.pelvis.rot ?? [0, 0, 0]
  if (k.pelvis.hip) rig.setPelvisByHip(k.pelvis.hip.side, V(k.pelvis.hip.at, scale), rot)
  else rig.setPelvis(V(k.pelvis.pos ?? [0, 0.948, -0.064], scale), rot)
  rig.setSpine(num(k.spine?.flex) + breath, num(k.spine?.side), num(k.spine?.twist))
  rig.setNeck(num(k.neck?.flex) - breath * 0.6, num(k.neck?.side), num(k.neck?.twist))
  rig.setEyes(k.eyes ?? 1)
  rig.root.updateMatrixWorld(true)

  for (const s of ['L', 'R'] as Side[]) {
    const leg = k.legs[s]
    if ('fk' in leg) {
      const [f, a, r] = leg.fk.hip ?? [0, 0, 0]
      rig.setHip(s, f, a, r)
      rig.setKnee(s, leg.fk.knee ?? 0)
      const [d, inv] = leg.fk.ankle ?? [0, 0]
      rig.setAnkle(s, d, inv)
    } else if ('plant' in leg) {
      const q = rig.footWorldQuat(s, leg.plant.yaw, leg.plant.pitch, leg.plant.roll)
      const ankle = rig.plantedAnkle(s, V(leg.plant.at, scale), q, leg.plant.pivot ?? 'flat')
      rig.solveLeg(s, ankle, V(leg.knee))
      rig.setWorldQuat(`foot${s}`, q)
    } else {
      rig.solveLeg(s, V(leg.ankle, scale), V(leg.knee))
      const [d, inv] = leg.angles ?? [0, 0]
      rig.setAnkle(s, d, inv)
    }
    const [ext, curl] = leg.toes ?? [0, 0]
    rig.setToes(s, ext, curl)
  }
  rig.root.updateMatrixWorld(true)

  for (const s of ['L', 'R'] as Side[]) {
    const arm = k.arms[s]
    const w = arm.wrist
    const wrist = Array.isArray(w)
      ? V(w as V3, scale)
      : w.frame === 'world'
        ? rig.worldPos(w.bone).add(V(w.offset, scale))
        : rig.pointOn(w.bone, w.offset.map((c) => c * scale) as V3)
    rig.solveArm(s, wrist, V(arm.elbow))
    if (arm.hand) {
      const fingers = arm.hand.bone ? rig.dirOn(arm.hand.bone, arm.hand.fingers) : V(arm.hand.fingers).normalize()
      const palm = arm.hand.bone ? rig.dirOn(arm.hand.bone, arm.hand.palm) : V(arm.hand.palm).normalize()
      rig.setHand(s, fingers, palm)
    }
    rig.setHandShape(s, arm.shape ?? 'relaxed')
  }
  rig.root.updateMatrixWorld(true)
}
