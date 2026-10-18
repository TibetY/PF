import { forwardRef, useImperativeHandle, useRef } from 'react'
import * as THREE from 'three'
import type { PropSpec } from './pose'
import type { BodyRig } from './rig'

/** Props come from each pose file (positions in reference-body metres, scaled with the body). */
export interface PropsHandle {
  /** Per-frame update for props that move with the body (bottle under the arch, elastic band). */
  update: (rig: BodyRig, working: 'L' | 'R') => void
}

export const Props = forwardRef<PropsHandle, { specs: PropSpec[]; scale: number; dark: boolean }>(function Props({ specs, scale, dark }, ref) {
  const bottle = useRef<THREE.Group>(null)
  const bandA = useRef<THREE.Mesh>(null)
  const bandB = useRef<THREE.Mesh>(null)
  const bottleRest = useRef<number | null>(null)

  useImperativeHandle(ref, () => ({
    update(rig, s) {
      if (bottle.current) {
        // rolling without slipping: the bottle travels half as far as the foot
        const ankle = rig.worldPos(`foot${s}`)
        if (bottleRest.current === null) bottleRest.current = ankle.z
        const d = ankle.z - bottleRest.current
        // under the arch, just in front of the ankle; spins as it rolls
        bottle.current.position.set(ankle.x, 0.036 * scale, ankle.z + 0.035 * scale - d / 2)
        bottle.current.rotation.x = d / 2 / (0.036 * scale)
      }
      if (bandA.current && bandB.current) {
        const o = s === 'L' ? 'R' : 'L'
        const sx = s === 'L' ? 1 : -1
        const lateral = rig.pointOn(`foot${s}`, [sx * 0.045, -0.04, 0.11])
        const medial = rig.pointOn(`foot${s}`, [-sx * 0.04, -0.04, 0.11])
        const anchor = rig.pointOn(`foot${o}`, [0, -0.07, 0.08])
        place(bandA.current, lateral, anchor)
        place(bandB.current, medial, anchor)
      }
    },
  }))

  const wood = dark ? '#7a5f45' : '#b48a62'
  return (
    <group>
      {specs.map((p, i) => {
        const pos = p.pos.map((c) => c * scale) as [number, number, number]
        const size = p.size?.map((c) => c * scale) as [number, number, number] | undefined
        switch (p.kind) {
          case 'chair':
            return <Chair key={i} pos={pos} scale={scale} wood={wood} />
          case 'wall':
            return (
              // one-sided plane facing the person: invisible when the camera orbits behind it
              <mesh key={i} position={[pos[0], 1.2, pos[2]]} rotation-y={Math.PI} receiveShadow>
                <planeGeometry args={[3, 2.4]} />
                <meshStandardMaterial color={dark ? '#3a4652' : '#f2efe9'} roughness={0.95} side={THREE.FrontSide} />
              </mesh>
            )
          case 'step': {
            const [w, h, d] = size ?? [0.8, 0.2, 0.4]
            return (
              <group key={i}>
                <mesh position={[pos[0], h / 2, pos[2] + d / 2]} castShadow receiveShadow>
                  <boxGeometry args={[w, h, d]} />
                  <meshStandardMaterial color={dark ? '#4a5866' : '#8a9aa8'} roughness={0.8} />
                </mesh>
                <mesh position={[pos[0], h + 0.003, pos[2] + d / 2]} receiveShadow>
                  <boxGeometry args={[w - 0.02, 0.006, d - 0.02]} />
                  <meshStandardMaterial color={dark ? '#2b333b' : '#3b4650'} roughness={1} />
                </mesh>
              </group>
            )
          }
          case 'towel':
            return (
              <mesh key={i} position={[pos[0], pos[1] + 0.03 * scale, pos[2]]} rotation-z={Math.PI / 2} castShadow>
                <cylinderGeometry args={[0.024 * scale, 0.024 * scale, 0.2 * scale, 24]} />
                <meshStandardMaterial color="#7cc4c6" roughness={1} />
              </mesh>
            )
          case 'mat':
            return (
              <mesh key={i} position={[pos[0], 0.004, pos[2]]} receiveShadow>
                <boxGeometry args={size ?? [1.9, 0.008, 0.75]} />
                <meshStandardMaterial color={dark ? '#2f5f62' : '#7cc4c6'} roughness={0.9} />
              </mesh>
            )
          case 'bottle':
            return (
              <group key={i} ref={bottle}>
                <group rotation-z={Math.PI / 2}>
                  <mesh castShadow>
                    <cylinderGeometry args={[0.036 * scale, 0.036 * scale, 0.22 * scale, 24]} />
                    <meshStandardMaterial color="#bfe6ff" roughness={0.2} transparent opacity={0.78} />
                  </mesh>
                  <mesh>
                    <cylinderGeometry args={[0.029 * scale, 0.029 * scale, 0.2 * scale, 16]} />
                    <meshStandardMaterial color="#eaf7ff" roughness={0.6} />
                  </mesh>
                  <mesh position={[0, 0.125 * scale, 0]}>
                    <cylinderGeometry args={[0.014 * scale, 0.025 * scale, 0.04 * scale, 16]} />
                    <meshStandardMaterial color="#2f8285" roughness={0.5} />
                  </mesh>
                  {/* stripe, so the rolling is visible */}
                  <mesh position={[0, 0, 0.035 * scale]}>
                    <boxGeometry args={[0.012 * scale, 0.17 * scale, 0.004 * scale]} />
                    <meshStandardMaterial color="#5aa7d6" />
                  </mesh>
                </group>
              </group>
            )
          case 'band':
            return (
              <group key={i}>
                <mesh ref={bandA} castShadow>
                  <cylinderGeometry args={[0.007, 0.007, 1, 8]} />
                  <meshStandardMaterial color="#d93d3d" roughness={0.5} />
                </mesh>
                <mesh ref={bandB} castShadow>
                  <cylinderGeometry args={[0.007, 0.007, 1, 8]} />
                  <meshStandardMaterial color="#d93d3d" roughness={0.5} />
                </mesh>
              </group>
            )
          default:
            return null
        }
      })}
    </group>
  )
})

function place(mesh: THREE.Mesh, a: THREE.Vector3, b: THREE.Vector3) {
  const d = b.clone().sub(a)
  mesh.position.copy(a).add(b).multiplyScalar(0.5)
  mesh.scale.set(1, d.length(), 1)
  mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), d.normalize())
}

function Chair({ pos, scale, wood }: { pos: [number, number, number]; scale: number; wood: string }) {
  const seatY = 0.46 * scale
  const depth = 0.44 * scale
  const width = 0.46 * scale
  const t = 0.04 * scale
  const z = pos[2]
  const legs: [number, number][] = [
    [-width / 2 + 0.03, z - depth / 2 + 0.03], [width / 2 - 0.03, z - depth / 2 + 0.03],
    [-width / 2 + 0.03, z + depth / 2 - 0.03], [width / 2 - 0.03, z + depth / 2 - 0.03],
  ]
  const mat = <meshStandardMaterial color={wood} roughness={0.7} />
  return (
    <group position={[pos[0], 0, 0]}>
      <mesh position={[0, seatY - t / 2, z]} castShadow receiveShadow>
        <boxGeometry args={[width, t, depth]} />
        {mat}
      </mesh>
      {legs.map(([x, lz], i) => (
        <mesh key={i} position={[x, (seatY - t) / 2, lz]} castShadow>
          <boxGeometry args={[0.035, seatY - t, 0.035]} />
          {mat}
        </mesh>
      ))}
      {[-1, 1].map((sx) => (
        <mesh key={sx} position={[sx * (width / 2 - 0.03), seatY + 0.25 * scale, z - depth / 2 + 0.02]} castShadow>
          <boxGeometry args={[0.035, 0.5 * scale, 0.035]} />
          {mat}
        </mesh>
      ))}
      <mesh position={[0, seatY + 0.38 * scale, z - depth / 2 + 0.02]} castShadow>
        <boxGeometry args={[width, 0.2 * scale, 0.03]} />
        {mat}
      </mesh>
    </group>
  )
}
