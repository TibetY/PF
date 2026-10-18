import { Canvas, useFrame, useThree } from '@react-three/fiber'
import { CameraControls, ContactShadows, Environment, useGLTF } from '@react-three/drei'
import { Suspense, useEffect, useMemo, useRef, useState } from 'react'
import * as THREE from 'three'
import type { Exercise } from '../data/exercises'
import type { Phase } from '../lib/phases'
import type { LiveState } from '../lib/session'
import { useSettings } from '../lib/settingsStore'
import { POSES } from '../stretches/poses'
import { applyKey, sampleClip } from './pose'
import { Props, type PropsHandle } from './Props'
import { BodyRig } from './rig'
import { createHighlightUniforms, packStrengths, withHighlights, type HighlightUniforms } from './highlight'
import { MUSCLE_CODES, MUSCLE_LABELS, muscleCode, type BodySide } from './muscles'
import { forSide, frameAt, type Frame } from './timeline'
import SvgBody from './SvgBody'

export interface TimerSource {
  /** Called every frame: the session's live state and phase list for this exercise. */
  (): { live: LiveState; phases: Phase[] }
}

interface BodyModelProps {
  exercise: Exercise
  /** Side shown before the session starts. */
  defaultSide: BodySide
  dark: boolean
  timer: TimerSource
}

const MODEL_URL = { male: '/models/body-male.glb', female: '/models/body-female.glb' }
const REF_LEG = 0.88 // reference (male) thigh + shin, metres

function webglAvailable() {
  try {
    const c = document.createElement('canvas')
    return !!(c.getContext('webgl2') || c.getContext('webgl'))
  } catch {
    return false
  }
}

/**
 * The 3D body: a realistic male or female model performing the exercise in step with the timer,
 * with the target muscles highlighted. Falls back to a 2D muscle map without WebGL.
 */
export default function BodyModel({ exercise, defaultSide, dark, timer }: BodyModelProps) {
  const [settings, update] = useSettings()
  const [webgl] = useState(webglAvailable)
  const [ready, setReady] = useState(false)
  const [follow, setFollow] = useState(true)
  const [side, setSide] = useState<BodySide>(defaultSide)
  const sex = settings.bodyModel
  useEffect(() => setReady(false), [sex])

  const working = exercise.highlightSides === 'both' ? 'both sides' : `${side} side`
  const list = (
    <div className="pointer-events-none absolute bottom-3 left-3 right-3 flex flex-wrap items-end gap-1.5 text-xs font-semibold">
      {exercise.primary.map((m) => (
        <span key={m} className="flex items-center gap-1.5 rounded-full bg-white/90 px-2.5 py-1 shadow backdrop-blur dark:bg-slate-800/90">
          <span className="h-2.5 w-2.5 rounded-full bg-[#ee2a14]" /> {MUSCLE_LABELS[m]}
        </span>
      ))}
      {exercise.secondary.map((m) => (
        <span key={m} className="flex items-center gap-1.5 rounded-full bg-white/80 px-2.5 py-1 font-medium shadow backdrop-blur dark:bg-slate-800/80">
          <span className="h-2.5 w-2.5 rounded-full bg-[#ffa261]" /> {MUSCLE_LABELS[m]}
        </span>
      ))}
      <span className="rounded-full bg-slate-900/70 px-2.5 py-1 text-white">{working}</span>
    </div>
  )

  if (!webgl) {
    return (
      <div className="relative h-full w-full overflow-hidden">
        <SvgBody primary={exercise.primary} secondary={exercise.secondary} dark={dark} />
        {list}
      </div>
    )
  }

  return (
    <div className="relative h-full w-full">
      <Canvas shadows dpr={[1, 2]} camera={{ fov: 35, near: 0.05, far: 40, position: [1.5, 1.3, 2.5] }} gl={{ antialias: true }} style={{ touchAction: 'none' }}>
        <color attach="background" args={[dark ? '#141b22' : '#eef1f4']} />
        <Suspense fallback={null}>
          <Environment files="/hdri/studio_small_09.hdr" environmentIntensity={dark ? 0.7 : 0.9} />
          <Scene
            key={`${sex}-${exercise.id}`}
            url={MODEL_URL[sex]}
            exercise={exercise}
            defaultSide={defaultSide}
            dark={dark}
            timer={timer}
            anatomy={settings.anatomyView}
            follow={follow}
            onUserCamera={() => setFollow(false)}
            onReady={() => setReady(true)}
            onSide={setSide}
          />
        </Suspense>
        <directionalLight position={[2, 4, 3]} intensity={dark ? 0.7 : 0.9} castShadow shadow-mapSize={[1024, 1024]} />
        <ContactShadows position={[0, 0.001, 0]} opacity={dark ? 0.55 : 0.4} scale={4} blur={2.4} far={1.6} resolution={512} />
        <Floor dark={dark} />
      </Canvas>

      {!ready && (
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
          <span className="rounded-full bg-white/85 px-4 py-2 text-sm font-medium shadow dark:bg-slate-800/85">Loading 3D body…</span>
        </div>
      )}

      <div className="absolute right-3 top-[max(0.75rem,env(safe-area-inset-top))] flex gap-2">
        <button
          onClick={() => update({ bodyModel: sex === 'male' ? 'female' : 'male' })}
          className="flex h-12 items-center rounded-full bg-white/85 px-3.5 text-sm font-semibold shadow backdrop-blur dark:bg-slate-800/85"
          aria-label={`Show the ${sex === 'male' ? 'female' : 'male'} body`}
        >
          {sex === 'male' ? 'Male' : 'Female'}
        </button>
        <button
          onClick={() => update({ anatomyView: !settings.anatomyView })}
          aria-pressed={settings.anatomyView}
          className={`flex h-12 items-center rounded-full px-3.5 text-sm font-semibold shadow backdrop-blur ${
            settings.anatomyView ? 'bg-brand-600 text-white dark:bg-brand-500 dark:text-slate-950' : 'bg-white/85 dark:bg-slate-800/85'
          }`}
        >
          Anatomy
        </button>
        <button
          onClick={() => setFollow(true)}
          className={`flex h-12 items-center rounded-full px-3.5 text-sm font-semibold shadow backdrop-blur ${follow ? 'bg-white/60 text-slate-500 dark:bg-slate-800/60' : 'bg-white/90 dark:bg-slate-800/90'}`}
          aria-label="Reset view"
        >
          Reset view
        </button>
      </div>
      {list}
    </div>
  )
}

/**
 * Clothing is coarser than the skin and its baked muscle map has small islands (a hamstring
 * vertex in the middle of the quads), which show as blotches. A few rounds of majority vote over
 * each vertex's neighbours clean it up. Vertices are welded by position first (UV seams).
 */
function smoothIds(geo: THREE.BufferGeometry, name: string, rounds = 4) {
  const attr = geo.getAttribute(name) as THREE.BufferAttribute | undefined
  const index = geo.getIndex()
  if (!attr || !index) return
  const pos = geo.getAttribute('position')
  const weld = new Map<string, number>()
  const rep = new Int32Array(pos.count)
  for (let i = 0; i < pos.count; i++) {
    const k = `${pos.getX(i).toFixed(4)},${pos.getY(i).toFixed(4)},${pos.getZ(i).toFixed(4)}`
    if (!weld.has(k)) weld.set(k, i)
    rep[i] = weld.get(k)!
  }
  const nbrs: Set<number>[] = Array.from({ length: pos.count }, () => new Set())
  for (let t = 0; t < index.count; t += 3) {
    const v = [rep[index.getX(t)], rep[index.getX(t + 1)], rep[index.getX(t + 2)]]
    for (let a = 0; a < 3; a++) for (let b = 0; b < 3; b++) if (a !== b) nbrs[v[a]].add(v[b])
  }
  let ids = Array.from({ length: pos.count }, (_, i) => Math.round(attr.getX(rep[i])))
  for (let r = 0; r < rounds; r++) {
    const next = ids.slice()
    for (let i = 0; i < pos.count; i++) {
      if (rep[i] !== i || !nbrs[i].size) continue
      const votes = new Map<number, number>([[ids[i], 1]])
      nbrs[i].forEach((n) => votes.set(ids[n], (votes.get(ids[n]) ?? 0) + 1))
      let best = ids[i]
      votes.forEach((c, id) => { if (c > (votes.get(best) ?? 0)) best = id })
      next[i] = best
    }
    ids = next
  }
  for (let i = 0; i < pos.count; i++) attr.setX(i, ids[rep[i]])
  attr.needsUpdate = true
}

/**
 * The sports top's straps carry some upper-arm weight, so with the arm across the body they
 * stretch into a pale band over the deltoid. Hand that weight to the shoulder bone instead.
 */
function moveWeights(mesh: THREE.SkinnedMesh, from: RegExp, to: string) {
  const bones = mesh.skeleton.bones
  const remap = new Map<number, number>()
  bones.forEach((b, i) => {
    const m = b.name.match(from)
    const j = m ? bones.findIndex((x) => x.name === to + m[1]) : -1
    if (j >= 0) remap.set(i, j)
  })
  const idx = mesh.geometry.getAttribute('skinIndex') as THREE.BufferAttribute
  for (let v = 0; v < idx.count; v++)
    for (let c = 0; c < 4; c++) {
      const j = remap.get(idx.getComponent(v, c))
      if (j !== undefined) idx.setComponent(v, c, j)
    }
  idx.needsUpdate = true
}

const BIND = new WeakMap<THREE.Object3D, Map<string, [THREE.Vector3, THREE.Quaternion, THREE.Vector3]>>()
/** First call snapshots every bone's local transform (a freshly loaded model is in its bind pose); later calls restore it. */
function restoreBindPose(scene: THREE.Object3D) {
  let snap = BIND.get(scene)
  if (!snap) {
    snap = new Map()
    scene.traverse((o) => {
      if ((o as THREE.Bone).isBone) snap!.set(o.uuid, [o.position.clone(), o.quaternion.clone(), o.scale.clone()])
    })
    BIND.set(scene, snap)
  } else {
    scene.traverse((o) => {
      const r = snap!.get(o.uuid)
      if (r) {
        o.position.copy(r[0])
        o.quaternion.copy(r[1])
        o.scale.copy(r[2])
      }
    })
  }
  scene.updateMatrixWorld(true)
}

function Floor({ dark }: { dark: boolean }) {
  return (
    <mesh rotation-x={-Math.PI / 2} receiveShadow>
      <circleGeometry args={[6, 64]} />
      <meshStandardMaterial color={dark ? '#1d262f' : '#dfe4e8'} roughness={0.95} />
    </mesh>
  )
}

/** Fixed pose + camera for preview renders (Stage E screenshots). */
export interface PreviewSpec {
  clip: 'enter' | 'hold' | 'exit'
  t: number
  side: BodySide
  /** camera yaw (0 = front, 90 = from the body's left), pitch, distance; framing the whole body */
  view: { yaw: number; pitch: number; distance: number; targetY: number }
}

interface SceneProps extends Omit<BodyModelProps, 'defaultSide'> {
  url: string
  preview?: PreviewSpec
  defaultSide: BodySide
  anatomy: boolean
  follow: boolean
  onUserCamera: () => void
  onReady: () => void
  onSide: (s: BodySide) => void
}

function Scene({ url, exercise, defaultSide, dark, timer, anatomy, follow, onUserCamera, onReady, onSide, preview }: SceneProps) {
  const gltf = useGLTF(url, false, true)
  const controls = useRef<CameraControls>(null)
  const props = useRef<PropsHandle>(null)
  const { size } = useThree()
  const anim = POSES[exercise.id]

  // one rig + highlight-patched materials per loaded model
  const { rig, uniforms, body, samples } = useMemo(() => {
    const uniforms: HighlightUniforms = createHighlightUniforms()
    let body: THREE.SkinnedMesh | null = null
    gltf.scene.traverse((o) => {
      const m = o as THREE.SkinnedMesh
      if (!m.isSkinnedMesh) return
      m.frustumCulled = false
      m.castShadow = true
      if (m.geometry.getAttribute('_muscle_id')) {
        const src = (m.userData.srcMaterial ??= m.material) as THREE.Material
        const fabric = m.name !== 'Body'
        if (fabric && !m.userData.smoothed) {
          smoothIds(m.geometry, '_muscle_id')
          smoothIds(m.geometry, '_muscle_id_deep')
          m.userData.smoothed = true
        }
        m.material = withHighlights(src, uniforms, fabric)
      }
      if (m.name === 'Body') body = m
      if (m.name === 'Top' && !m.userData.strapsFixed) {
        moveWeights(m, /^upperarm0[12]([LR])$/, 'shoulder01')
        m.userData.strapsFixed = true
      }
      const mat = m.material as THREE.MeshPhysicalMaterial
      // the exported fabric sheen turns white at grazing angles in three.js (hips when sitting)
      if (mat.sheen) mat.sheen = 0
      if (mat.map && mat.transparent) {
        // hair cards, brows, lashes: alpha-tested so they sort cleanly
        mat.alphaTest = 0.45
        mat.transparent = false
        mat.depthWrite = true
      }
    })
    // useGLTF caches the scene, so its bones may still hold the previous exercise's pose:
    // put back the bind pose captured the first time this model was used
    restoreBindPose(gltf.scene)
    const rig = new BodyRig(gltf.scene)
    if (import.meta.env.DEV) Object.assign(window, { __rig: rig, __applyKey: applyKey })
    // sample vertices per muscle code for camera framing
    const samples = new Map<number, number[]>()
    const ids = body ? (body as THREE.SkinnedMesh).geometry.getAttribute('_muscle_id') : null
    if (ids) {
      const all = new Map<number, number[]>()
      for (let i = 0; i < ids.count; i++) {
        const c = Math.round(ids.getX(i))
        if (!c) continue
        if (!all.has(c)) all.set(c, [])
        all.get(c)!.push(i)
      }
      for (const [c, list] of all) {
        const step = Math.max(1, Math.floor(list.length / 40))
        samples.set(c, list.filter((_, i) => i % step === 0))
      }
    }
    return { rig, uniforms, body: body as THREE.SkinnedMesh | null, samples }
  }, [gltf])

  const scale = (rig.metrics.thigh + rig.metrics.shin) / REF_LEG
  const strengths = useRef({ p: new Float32Array(MUSCLE_CODES), s: new Float32Array(MUSCLE_CODES) })
  const cam = useRef({ target: new THREE.Vector3(), pos: new THREE.Vector3(), init: false })
  const clock = useRef(0)
  const lastSide = useRef<BodySide | null>(null)

  useEffect(() => {
    onReady()
    uniforms.uAnatomy.value = anatomy ? 1 : 0
  }, [onReady, uniforms, anatomy])

  useEffect(() => {
    const c = controls.current
    if (!c) return
    const user = () => onUserCamera()
    c.addEventListener('controlstart', user)
    return () => c.removeEventListener('controlstart', user)
  }, [onUserCamera])

  useEffect(() => {
    if (follow) cam.current.init = false
  }, [follow])

  const tmp = useMemo(() => ({ v: new THREE.Vector3(), sum: new THREE.Vector3() }), [])

  useFrame((_, rawDt) => {
    const dt = Math.min(rawDt, 0.1)
    clock.current += dt
    const { live, phases } = timer()
    let frame: Frame = frameAt(exercise, anim, live, phases, defaultSide, clock.current)
    if (preview) {
      const a = forSide(anim, preview.side)
      frame = { key: sampleClip(a, a[preview.clip].keys, preview.t), side: preview.side, holding: preview.clip === 'hold', breath: 0 }
      uniforms.uHold.value = 0
    }
    if (frame.side !== lastSide.current) {
      lastSide.current = frame.side
      onSide(frame.side)
    }
    applyKey(rig, frame.key, { scale, breath: frame.breath })
    props.current?.update(rig, frame.side === 'left' ? 'L' : 'R')

    // ---- highlights: fade toward this frame's targets (working side only, unless bilateral)
    const sides: BodySide[] = exercise.highlightSides === 'both' ? ['left', 'right'] : [frame.side]
    const tp = new Float32Array(MUSCLE_CODES)
    const ts = new Float32Array(MUSCLE_CODES)
    for (const s of sides) {
      exercise.primary.forEach((m) => (tp[muscleCode(m, s)] = 1))
      exercise.secondary.forEach((m) => (ts[muscleCode(m, s)] = 0.75))
    }
    const k = 1 - Math.exp(-dt * 3.5)
    const st = strengths.current
    for (let i = 0; i < MUSCLE_CODES; i++) {
      st.p[i] += (tp[i] - st.p[i]) * k
      st.s[i] += (ts[i] - st.s[i]) * k
    }
    packStrengths(uniforms.uPrimary.value, st.p)
    packStrengths(uniforms.uSecondary.value, st.s)
    uniforms.uPulse.value = clock.current * 3.2
    uniforms.uHold.value += ((frame.holding ? 1 : 0) - uniforms.uHold.value) * k

    if (preview && controls.current) {
      // instant highlights and a fixed whole-body view for screenshots
      packStrengths(uniforms.uPrimary.value, tp)
      packStrengths(uniforms.uSecondary.value, ts)
      const v = preview.view
      const y = (v.yaw * Math.PI) / 180
      const pt = (v.pitch * Math.PI) / 180
      const t = new THREE.Vector3(0, v.targetY * scale, 0)
      const p = t.clone().add(new THREE.Vector3(Math.sin(y) * Math.cos(pt), Math.sin(pt), Math.cos(y) * Math.cos(pt)).multiplyScalar(v.distance))
      controls.current.setLookAt(p.x, p.y, p.z, t.x, t.y, t.z, false)
      return
    }

    // ---- camera: frame the primary muscle from the pose's preferred angle and follow it
    if (!follow || !controls.current) return
    let n = 0
    tmp.sum.set(0, 0, 0)
    if (body) {
      for (const s of sides) {
        for (const m of exercise.primary) {
          for (const i of samples.get(muscleCode(m, s)) ?? []) {
            body.getVertexPosition(i, tmp.v)
            tmp.sum.add(body.localToWorld(tmp.v))
            n++
          }
        }
      }
    }
    const target = n ? tmp.sum.divideScalar(n) : new THREE.Vector3(0, 0.9 * scale, 0)
    const c = anim.camera
    const yaw = ((frame.side === 'left' ? -c.yaw : c.yaw) * Math.PI) / 180
    const pitch = (c.pitch * Math.PI) / 180
    const aspect = size.width / Math.max(1, size.height)
    const dist = c.distance * scale * (aspect < 0.8 ? 1.35 : aspect < 1.2 ? 1.15 : 1)
    const pos = target.clone().add(new THREE.Vector3(Math.sin(yaw) * Math.cos(pitch), Math.sin(pitch), Math.cos(yaw) * Math.cos(pitch)).multiplyScalar(dist))
    const f = cam.current
    const kk = f.init ? 1 - Math.exp(-dt * 2.5) : 1
    f.target.lerp(target, kk)
    f.pos.lerp(pos, kk)
    f.init = true
    controls.current.setLookAt(f.pos.x, f.pos.y, f.pos.z, f.target.x, f.target.y, f.target.z, false)
  })

  return (
    <>
      <primitive object={gltf.scene} />
      <Props ref={props} specs={anim.props} scale={scale} dark={dark} />
      <CameraControls ref={controls} makeDefault minDistance={0.4} maxDistance={6} maxPolarAngle={Math.PI * 0.55} />
    </>
  )
}


/** Dev-only: render one exercise at a fixed clip/time/side/view (used for docs/stretch-previews). */
export function BodyPreview({ exercise, sex, spec, dark = false }: { exercise: Exercise; sex: 'male' | 'female'; spec: PreviewSpec; dark?: boolean }) {
  const [ready, setReady] = useState(false)
  const idle = useMemo(() => () => ({ live: { status: 'idle' as const, index: 0, elapsed: 0 }, phases: [] as Phase[] }), [])
  return (
    <div className="relative h-full w-full" data-ready={ready ? 'yes' : 'no'}>
      <Canvas shadows dpr={1} camera={{ fov: 35, near: 0.05, far: 40 }} gl={{ antialias: true, preserveDrawingBuffer: true }}>
        <color attach="background" args={[dark ? '#141b22' : '#eef1f4']} />
        <Suspense fallback={null}>
          <Environment files="/hdri/studio_small_09.hdr" environmentIntensity={0.9} />
          <Scene
            key={`${sex}-${exercise.id}`}
            url={MODEL_URL[sex]}
            exercise={exercise}
            defaultSide={spec.side}
            dark={dark}
            timer={idle}
            anatomy={false}
            follow={false}
            onUserCamera={() => {}}
            onReady={() => setReady(true)}
            onSide={() => {}}
            preview={spec}
          />
        </Suspense>
        <directionalLight position={[2, 4, 3]} intensity={0.9} castShadow shadow-mapSize={[1024, 1024]} />
        <ContactShadows position={[0, 0.001, 0]} opacity={0.4} scale={4} blur={2.4} far={1.6} resolution={512} />
        <Floor dark={dark} />
      </Canvas>
    </div>
  )
}
