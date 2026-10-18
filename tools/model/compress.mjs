// Compress a body GLB for the web: meshopt geometry, quantised positions/normals/UVs/weights,
// and the muscle-id attributes stored as exact unsigned bytes (never quantised or normalised).
//
//   node tools/model/compress.mjs in.glb out.glb
import { NodeIO } from '@gltf-transform/core'
import { ALL_EXTENSIONS, EXTMeshoptCompression } from '@gltf-transform/extensions'
import { dedup, prune, quantize, reorder, resample } from '@gltf-transform/functions'
import { MeshoptDecoder, MeshoptEncoder } from 'meshoptimizer'

const [input, output] = process.argv.slice(2)
await MeshoptEncoder.ready
await MeshoptDecoder.ready
const io = new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({
  'meshopt.encoder': MeshoptEncoder,
  'meshopt.decoder': MeshoptDecoder,
})
const doc = await io.read(input)

// muscle ids: float -> uint8, exact
for (const mesh of doc.getRoot().listMeshes()) {
  for (const prim of mesh.listPrimitives()) {
    for (const name of ['_MUSCLE_ID', '_MUSCLE_ID_DEEP']) {
      const acc = prim.getAttribute(name)
      if (!acc) continue
      const src = acc.getArray()
      const dst = new Uint8Array(src.length)
      for (let i = 0; i < src.length; i++) dst[i] = Math.round(src[i])
      acc.setArray(dst).setNormalized(false)
    }
  }
}

await doc.transform(
  dedup(),
  prune(),
  resample(),
  reorder({ encoder: MeshoptEncoder }),
  quantize({ pattern: /^(POSITION|NORMAL|TANGENT|TEXCOORD_\d|WEIGHTS_\d)$/ }),
)
doc.createExtension(EXTMeshoptCompression).setRequired(true).setEncoderOptions({
  method: EXTMeshoptCompression.EncoderMethod.FILTER,
})
await io.write(output, doc)

const bytes = (await import('node:fs')).statSync(output).size
console.log(`COMPRESSED ${output} ${(bytes / 1048576).toFixed(2)} MB`)
