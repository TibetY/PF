import { Canvas, useFrame, useThree } from '@react-three/fiber'
import { OrbitControls } from '@react-three/drei'
import { forwardRef, useEffect, useImperativeHandle, useMemo, useRef } from 'react'
import * as THREE from 'three'
import type { OrbitControls as OrbitControlsImpl } from 'three-stdlib'
import type { Exercise } from '../data/exercises'
import type { Side } from '../lib/settings'
import { Mannequin } from './rig'
import { CAMERAS, FOOT_CAMS, LAYOUT, POSES, bandPoints, iceRoll, type PoseInput } from './poses'

export interface AnimFrame extends PoseInput {
  /** Highlight glow, 0..1. */
  glow: number
}

export interface SceneHandle {
  resetView: () => void
}

interface Props {
  exercise: Exercise
  side: Side
  dark: boolean
  /** Called every frame to get the current pose parameters (synced to the timer). */
  getFrame: (dt: number) => AnimFrame
  /** Show the zoomed foot close-up inset. */
  footCam: boolean
}

/** Inset rectangle for the foot close-up, in CSS pixels from the canvas' bottom-right. Mirrored by the HTML frame. */
export const FOOT_CAM_RECT = { right: 10, bottom: 52, maxWidth: 190, widthFrac: 0.42, aspect: 1.15 }

export const ExerciseScene = forwardRef<SceneHandle, Props>(function ExerciseScene(props, ref) {
  const controls = useRef<OrbitControlsImpl>(null)
  const resetRef = useRef<() => void>(() => {})
  useImperativeHandle(ref, () => ({ resetView: () => resetRef.current() }), [])
  const bg = props.dark ? '#141b22' : '#eef1f4'

  return (
    <Canvas
      shadows
      dpr={[1, 2]}
      camera={{ fov: 40, near: 0.05, far: 50, position: [2, 1.4, 2] }}
      gl={{ antialias: true, preserveDrawingBuffer: false }}
      style={{ touchAction: 'none' }}
    >
      <color attach="background" args={[bg]} />
      <fog attach="fog" args={[bg, 6, 14]} />
      <hemisphereLight args={[props.dark ? '#9fb3c8' : '#ffffff', props.dark ? '#1c242c' : '#b8c2cc', props.dark ? 0.9 : 1.1]} />
      <directionalLight
        position={[2.5, 4, 2]}
        intensity={props.dark ? 1.6 : 1.9}
        castShadow
        shadow-mapSize={[1024, 1024]}
        shadow-camera-left={-2}
        shadow-camera-right={2}
        shadow-camera-top={2.5}
        shadow-camera-bottom={-1}
        shadow-bias={-0.0004}
      />
      <directionalLight position={[-3, 2.5, -2]} intensity={props.dark ? 0.7 : 0.9} />
      <World {...props} />
      <OrbitControls
        ref={controls}
        makeDefault
        enablePan
        enableDamping
        dampingFactor={0.12}
        minDistance={0.6}
        maxDistance={6}
        maxPolarAngle={Math.PI * 0.55}
      />
      <CameraRig exercise={props.exercise} side={props.side} controls={controls} resetRef={resetRef} />
    </Canvas>
  )
})

function CameraRig({
  exercise, side, controls, resetRef,
}: {
  exercise: Exercise
  side: Side
  controls: React.RefObject<OrbitControlsImpl>
  resetRef: React.MutableRefObject<() => void>
}) {
  const { camera, size } = useThree()
  useEffect(() => {
    const reset = () => {
      const c = CAMERAS[exercise.id]
      const mx = side === 'left' ? -1 : 1
      // pull back a little on tall, narrow (portrait phone) viewports
      const aspect = size.width / Math.max(1, size.height)
      const k = aspect < 0.8 ? 1.4 : aspect < 1.2 ? 1.2 : 1
      const target = new THREE.Vector3(c.target[0] * mx, c.target[1], c.target[2])
      const pos = new THREE.Vector3(c.position[0] * mx, c.position[1], c.position[2])
      pos.sub(target).multiplyScalar(k).add(target)
      camera.position.copy(pos)
      camera.lookAt(target)
      if (controls.current) {
        controls.current.target.copy(target)
        controls.current.update()
      }
    }
    resetRef.current = reset
    reset()
    if (import.meta.env.DEV) {
      ;(window as unknown as { __cam?: unknown }).__cam = (p: number[], t: number[]) => {
        camera.position.set(p[0], p[1], p[2])
        controls.current?.target.set(t[0], t[1], t[2])
        controls.current?.update()
      }
    }
    // only re-frame when the exercise or side changes, not on every resize
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [exercise.id, side])
  return null
}

function World({ exercise, side, dark, getFrame, footCam }: Props) {
  const mannequin = useMemo(() => new Mannequin(), [])
  const bottle = useRef<THREE.Group>(null)
  const bandA = useRef<THREE.Mesh>(null)
  const bandB = useRef<THREE.Mesh>(null)
  const pose = POSES[exercise.id]
  const insetCam = useMemo(() => new THREE.PerspectiveCamera(32, 1.15, 0.02, 10), [])
  const focus = useRef(new THREE.Vector3())
  const camPos = useRef(new THREE.Vector3())
  const first = useRef(true)
  const { gl, scene, camera, size } = useThree()

  useEffect(() => {
    first.current = true
  }, [exercise.id, side])

  useFrame((_, dt) => {
    const f = getFrame(Math.min(dt, 0.1))
    mannequin.reset()
    pose(mannequin, f)
    mannequin.setHighlight(exercise.targets, f.glow)
    if (bottle.current) {
      const r = iceRoll(f.t)
      bottle.current.position.z = LAYOUT.bottle.z + r.bottle
      bottle.current.rotation.x = r.spin
    }
    if (bandA.current && bandB.current) {
      const [lat, med, anchor] = bandPoints(mannequin)
      placeBand(bandA.current, lat, anchor)
      placeBand(bandB.current, med, anchor)
    }

    // ---- render: main view, then the foot close-up inset (manual two-pass render) ----
    gl.autoClear = true
    gl.setScissorTest(false)
    gl.setViewport(0, 0, size.width, size.height)
    gl.render(scene, camera)
    const off = FOOT_CAMS[exercise.id]
    if (!footCam || !off) return

    const target = mannequin.legs.R.mid.localToWorld(new THREE.Vector3(0, -0.015, 0.035))
    const mx = side === 'left' ? -1 : 1
    const want = target.clone().add(new THREE.Vector3(off[0] * mx, off[1], off[2]))
    const k = first.current ? 1 : 1 - Math.exp(-dt * 6)
    focus.current.lerp(target, k)
    camPos.current.lerp(want, k)
    first.current = false
    insetCam.position.copy(camPos.current)
    insetCam.lookAt(focus.current)

    const R = FOOT_CAM_RECT
    const w = Math.min(size.width * R.widthFrac, R.maxWidth)
    const h = w / R.aspect
    const x = size.width - w - R.right
    const y = R.bottom
    insetCam.aspect = w / h
    insetCam.updateProjectionMatrix()
    gl.setScissorTest(true)
    gl.setScissor(x, y, w, h)
    gl.setViewport(x, y, w, h)
    const prev = gl.getClearColor(new THREE.Color())
    gl.setClearColor(dark ? '#1b242d' : '#ffffff')
    gl.clear()
    gl.render(scene, insetCam)
    gl.setClearColor(prev)
    gl.setScissorTest(false)
    gl.setViewport(0, 0, size.width, size.height)
  }, 1)

  const id = exercise.id
  const seated = id === 'pf-stretch' || id === 'ice' || id === 'inversion-band'
  return (
    <group scale={[side === 'left' ? -1 : 1, 1, 1]}>
      <Floor dark={dark} />
      <primitive object={mannequin.root} />
      {seated && <Chair dark={dark} />}
      {(id === 'calf-straight' || id === 'calf-bent') && <Wall z={LAYOUT.wallStretch.wallZ} dark={dark} />}
      {id === 'intrinsic-foot' && <Wall z={LAYOUT.shortFoot.wallZ} dark={dark} />}
      {id === 'heel-raise' && (
        <>
          <Wall z={LAYOUT.step.wallZ} dark={dark} />
          <Step dark={dark} />
          <Towel />
        </>
      )}
      {id === 'step-down' && <StepDownBox dark={dark} />}
      {id === 'side-plank-abduction' && <Mat dark={dark} />}
      {id === 'ice' && <Bottle ref={bottle} />}
      {id === 'inversion-band' && (
        <>
          <BandStrand ref={bandA} />
          <BandStrand ref={bandB} />
        </>
      )}
    </group>
  )
}

function placeBand(mesh: THREE.Mesh, a: THREE.Vector3, b: THREE.Vector3) {
  const d = b.clone().sub(a)
  mesh.position.copy(a).add(b).multiplyScalar(0.5)
  mesh.scale.set(1, d.length(), 1)
  mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), d.normalize())
}

const BandStrand = forwardRef<THREE.Mesh>(function BandStrand(_, ref) {
  return (
    <mesh ref={ref} castShadow>
      <cylinderGeometry args={[0.007, 0.007, 1, 8]} />
      <meshStandardMaterial color="#d93d3d" roughness={0.5} />
    </mesh>
  )
})

function StepDownBox({ dark }: { dark: boolean }) {
  const st = LAYOUT.stepDown
  const depth = st.frontZ - st.backZ
  return (
    <group>
      <mesh position={[0, st.height / 2, st.backZ + depth / 2]} castShadow receiveShadow>
        <boxGeometry args={[st.width, st.height, depth]} />
        <meshStandardMaterial color={dark ? '#4a5866' : '#8a9aa8'} roughness={0.8} />
      </mesh>
      <mesh position={[0, st.height + 0.003, st.backZ + depth / 2]} receiveShadow>
        <boxGeometry args={[st.width - 0.02, 0.006, depth - 0.02]} />
        <meshStandardMaterial color={dark ? '#2b333b' : '#3b4650'} roughness={1} />
      </mesh>
    </group>
  )
}

function Mat({ dark }: { dark: boolean }) {
  return (
    <mesh position={[0.05, 0.004, -0.1]} receiveShadow>
      <boxGeometry args={[1.9, 0.008, 0.75]} />
      <meshStandardMaterial color={dark ? '#2f5f62' : '#7cc4c6'} roughness={0.9} />
    </mesh>
  )
}

function Floor({ dark }: { dark: boolean }) {
  return (
    <mesh rotation-x={-Math.PI / 2} receiveShadow>
      <circleGeometry args={[4, 64]} />
      <meshStandardMaterial color={dark ? '#1d262f' : '#dde3e8'} roughness={0.95} />
    </mesh>
  )
}

function Chair({ dark }: { dark: boolean }) {
  const { seatY, seatZ, depth, width } = LAYOUT.chair
  const wood = dark ? '#7a5f45' : '#b48a62'
  const t = 0.04
  const legs: [number, number][] = [
    [-width / 2 + 0.03, seatZ - depth / 2 + 0.03], [width / 2 - 0.03, seatZ - depth / 2 + 0.03],
    [-width / 2 + 0.03, seatZ + depth / 2 - 0.03], [width / 2 - 0.03, seatZ + depth / 2 - 0.03],
  ]
  return (
    <group>
      <mesh position={[0, seatY - t / 2, seatZ]} castShadow receiveShadow>
        <boxGeometry args={[width, t, depth]} />
        <meshStandardMaterial color={wood} roughness={0.7} />
      </mesh>
      {legs.map(([x, z], i) => (
        <mesh key={i} position={[x, (seatY - t) / 2, z]} castShadow>
          <boxGeometry args={[0.035, seatY - t, 0.035]} />
          <meshStandardMaterial color={wood} roughness={0.7} />
        </mesh>
      ))}
      {[-1, 1].map((sx) => (
        <mesh key={sx} position={[sx * (width / 2 - 0.03), seatY + 0.25, seatZ - depth / 2 + 0.02]} castShadow>
          <boxGeometry args={[0.035, 0.5, 0.035]} />
          <meshStandardMaterial color={wood} roughness={0.7} />
        </mesh>
      ))}
      <mesh position={[0, seatY + 0.38, seatZ - depth / 2 + 0.02]} castShadow>
        <boxGeometry args={[width, 0.2, 0.03]} />
        <meshStandardMaterial color={wood} roughness={0.7} />
      </mesh>
    </group>
  )
}

function Wall({ z, dark }: { z: number; dark: boolean }) {
  return (
    <group>
      <mesh position={[0, 1.2, z + 0.05]} receiveShadow>
        <boxGeometry args={[3, 2.4, 0.1]} />
        <meshStandardMaterial color={dark ? '#34414d' : '#f7f4ef'} roughness={0.9} />
      </mesh>
      <mesh position={[0, 0.05, z - 0.008]}>
        <boxGeometry args={[3, 0.1, 0.02]} />
        <meshStandardMaterial color={dark ? '#3a4652' : '#d9d3c9'} roughness={0.8} />
      </mesh>
    </group>
  )
}

function Step({ dark }: { dark: boolean }) {
  const st = LAYOUT.step
  const depth = st.frontZ - st.backEdgeZ
  return (
    <group>
      <mesh position={[0, st.height / 2, st.backEdgeZ + depth / 2]} castShadow receiveShadow>
        <boxGeometry args={[st.width, st.height, depth]} />
        <meshStandardMaterial color={dark ? '#4a5866' : '#8a9aa8'} roughness={0.8} />
      </mesh>
      {/* grippy top */}
      <mesh position={[0, st.height + 0.003, st.backEdgeZ + depth / 2]} receiveShadow>
        <boxGeometry args={[st.width - 0.02, 0.006, depth - 0.02]} />
        <meshStandardMaterial color={dark ? '#2b333b' : '#3b4650'} roughness={1} />
      </mesh>
    </group>
  )
}

function Towel() {
  const st = LAYOUT.step
  const tw = LAYOUT.towel
  return (
    <group position={[st.ballX, st.height + 0.006 + tw.radius, tw.z]} rotation-z={Math.PI / 2}>
      <mesh castShadow>
        <cylinderGeometry args={[tw.radius, tw.radius, tw.length, 24]} />
        <meshStandardMaterial color="#7cc4c6" roughness={1} />
      </mesh>
      {[-0.06, 0, 0.06].map((y) => (
        <mesh key={y} position={[0, y, 0]}>
          <torusGeometry args={[tw.radius + 0.001, 0.0025, 6, 24]} />
          <meshStandardMaterial color="#5aa7aa" roughness={1} />
        </mesh>
      ))}
    </group>
  )
}

const Bottle = forwardRef<THREE.Group>(function Bottle(_, ref) {
  const b = LAYOUT.bottle
  return (
    <group ref={ref} position={[b.x, b.radius, b.z]}>
      <group rotation-z={Math.PI / 2}>
        <mesh castShadow>
          <cylinderGeometry args={[b.radius, b.radius, b.length, 24]} />
          <meshStandardMaterial color="#bfe6ff" roughness={0.25} metalness={0} transparent opacity={0.75} />
        </mesh>
        {/* frozen core */}
        <mesh>
          <cylinderGeometry args={[b.radius * 0.8, b.radius * 0.8, b.length * 0.9, 16]} />
          <meshStandardMaterial color="#eaf7ff" roughness={0.6} />
        </mesh>
        <mesh position={[0, b.length / 2 + 0.02, 0]}>
          <cylinderGeometry args={[0.012, b.radius * 0.7, 0.04, 16]} />
          <meshStandardMaterial color="#bfe6ff" roughness={0.25} transparent opacity={0.75} />
        </mesh>
        <mesh position={[0, b.length / 2 + 0.05, 0]}>
          <cylinderGeometry args={[0.014, 0.014, 0.02, 12]} />
          <meshStandardMaterial color="#2f8285" roughness={0.5} />
        </mesh>
        {/* stripe so the rolling is visible */}
        <mesh position={[0, 0, b.radius * 0.98]}>
          <boxGeometry args={[0.012, b.length * 0.8, 0.004]} />
          <meshStandardMaterial color="#5aa7d6" />
        </mesh>
      </group>
    </group>
  )
})
