import * as THREE from 'three'
import { FIBRE_DIR, MUSCLES, MUSCLE_CODES } from './muscles'

/**
 * Muscle highlighting for the skin and clothes. MeshStandardMaterial (and Physical) is extended in
 * onBeforeCompile: it reads the baked `_muscle_id` / `_muscle_id_deep` vertex attributes and a
 * uniform array of per-muscle strengths (one entry per muscle code, so left/right are separate).
 */
export interface HighlightUniforms {
  /** Strengths per muscle code, packed four per vec4 (WebGL only guarantees 128 vertex uniform vectors). */
  uPrimary: { value: THREE.Vector4[] }
  uSecondary: { value: THREE.Vector4[] }
  uFibre: { value: THREE.Vector3[] }
  uPulse: { value: number }
  uHold: { value: number }
  uAnatomy: { value: number }
}

export function createHighlightUniforms(): HighlightUniforms {
  return {
    uPrimary: { value: Array.from({ length: MUSCLE_CODES / 4 }, () => new THREE.Vector4()) },
    uSecondary: { value: Array.from({ length: MUSCLE_CODES / 4 }, () => new THREE.Vector4()) },
    uFibre: { value: MUSCLES.map((m) => new THREE.Vector3(...FIBRE_DIR[m]).normalize()) },
    uPulse: { value: 0 },
    uHold: { value: 0 },
    uAnatomy: { value: 0 },
  }
}

const VERT_HEAD = /* glsl */ `
attribute float _muscle_id;
attribute float _muscle_id_deep;
uniform vec4 uPrimary[${MUSCLE_CODES / 4}];
uniform vec4 uSecondary[${MUSCLE_CODES / 4}];
float unpack(vec4 v, int k) { return k == 0 ? v.x : k == 1 ? v.y : k == 2 ? v.z : v.w; }
float prim(int i) { return unpack(uPrimary[i / 4], i - (i / 4) * 4); }
float sec(int i) { return unpack(uSecondary[i / 4], i - (i / 4) * 4); }
uniform vec3 uFibre[${MUSCLES.length}];
varying float vPrim;
varying float vSec;
varying vec3 vRest;
varying vec3 vFibre;
`
const VERT_BODY = /* glsl */ `
  int mid = int(_muscle_id + 0.5);
  int did = int(_muscle_id_deep + 0.5);
  // the deep muscle (e.g. piriformis under the glutes) shows through slightly weaker
  vPrim = max(prim(mid), prim(did) * 0.85);
  vSec = max(sec(mid), sec(did) * 0.75);
  vRest = position;
  int which = prim(did) * 0.85 > prim(mid) || (prim(mid) == 0.0 && sec(did) > sec(mid)) ? did : mid;
  vFibre = which > 0 ? uFibre[(which - 1) / 2] : vec3(0.0, 1.0, 0.0);
`
const FRAG_HEAD = /* glsl */ `
uniform float uPulse;
uniform float uHold;
uniform float uAnatomy;
varying float vPrim;
varying float vSec;
varying vec3 vRest;
varying vec3 vFibre;
`
const FRAG_BODY = /* glsl */ `
  {
    vec3 warm = vec3(0.93, 0.16, 0.08);
    vec3 soft = vec3(1.0, 0.56, 0.24);
    float pulse = 1.0 + uHold * 0.18 * sin(uPulse);
    float p = clamp(vPrim * pulse, 0.0, 1.15) * HL_PRIM;
    float s = vSec * (1.0 - min(1.0, p)) * HL_SEC;
    float a = uAnatomy * clamp(p + s, 0.0, 1.0);
    if (a > 0.001) {
      // muscle-fibre look: fine stripes running along the fibre direction
      vec3 f = normalize(vFibre);
      vec3 across = normalize(cross(f, abs(f.z) < 0.9 ? vec3(0.0, 0.0, 1.0) : vec3(1.0, 0.0, 0.0)));
      float u = dot(vRest, across) * 260.0 + 0.35 * sin(dot(vRest, f) * 40.0);
      float fibre = smoothstep(0.15, 0.85, 0.5 + 0.5 * sin(u));
      vec3 tissue = mix(vec3(0.42, 0.05, 0.05), vec3(0.78, 0.22, 0.18), fibre);
      diffuseColor.rgb = mix(diffuseColor.rgb, tissue, a);
    }
    diffuseColor.rgb = mix(diffuseColor.rgb, warm, min(1.0, p) * 0.72 * (1.0 - uAnatomy * 0.6));
    diffuseColor.rgb = mix(diffuseColor.rgb, soft, s * 0.5 * (1.0 - uAnatomy * 0.5));
    totalEmissiveRadiance += (warm * p * 0.28 + soft * s * 0.06) * HL_GLOW;
  }
`

/**
 * Patch a material (clones it) so it renders muscle highlights. Clothing (`fabric`) gets a softer
 * tint: it is coarser than the skin, so full-strength muscle edges look blocky on it.
 */
export function withHighlights(material: THREE.Material, uniforms: HighlightUniforms, fabric = false): THREE.Material {
  const m = material.clone() as THREE.MeshStandardMaterial
  const defs = fabric ? '#define HL_PRIM 0.6\n#define HL_SEC 0.3\n#define HL_GLOW 0.4\n' : '#define HL_PRIM 1.0\n#define HL_SEC 1.0\n#define HL_GLOW 1.0\n'
  m.onBeforeCompile = (shader) => {
    Object.assign(shader.uniforms, uniforms)
    shader.vertexShader = VERT_HEAD + shader.vertexShader.replace('#include <begin_vertex>', '#include <begin_vertex>\n' + VERT_BODY)
    shader.fragmentShader = defs + FRAG_HEAD + shader.fragmentShader.replace('#include <emissivemap_fragment>', '#include <emissivemap_fragment>\n' + FRAG_BODY)
  }
  m.customProgramCacheKey = () => (fabric ? 'muscle-highlight-fabric' : 'muscle-highlight')
  return m
}

/** Write per-code strengths (array of MUSCLE_CODES numbers) into the packed uniform. */
export function packStrengths(target: THREE.Vector4[], values: ArrayLike<number>) {
  for (let i = 0; i < target.length; i++) target[i].set(values[i * 4] ?? 0, values[i * 4 + 1] ?? 0, values[i * 4 + 2] ?? 0, values[i * 4 + 3] ?? 0)
}
