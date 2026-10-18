// Print what's inside a body GLB: meshes, attributes, skin, textures, muscle-id ranges.
//   node tools/model/inspect.mjs public/models/body-male.glb
import { NodeIO } from '@gltf-transform/core'
import { ALL_EXTENSIONS } from '@gltf-transform/extensions'
import { MeshoptDecoder } from 'meshoptimizer'

await MeshoptDecoder.ready
const io = new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({ 'meshopt.decoder': MeshoptDecoder })
const doc = await io.read(process.argv[2])
const root = doc.getRoot()
for (const skin of root.listSkins()) console.log('skin joints', skin.listJoints().length, skin.listJoints().slice(0, 3).map((j) => j.getName()), '...')
for (const node of root.listNodes()) {
  const mesh = node.getMesh()
  if (!mesh) continue
  for (const prim of mesh.listPrimitives()) {
    const attrs = prim.listSemantics().map((s) => `${s}:${prim.getAttribute(s).getComponentType()}${prim.getAttribute(s).getNormalized() ? 'n' : ''}`)
    const ids = prim.getAttribute('_MUSCLE_ID')
    let range = ''
    if (ids) {
      const a = ids.getArray()
      const set = new Set(a)
      range = ` muscle ids: ${set.size} distinct, max ${Math.max(...a)}`
    }
    console.log(`mesh ${node.getName()} skin=${!!node.getSkin()} verts=${prim.getAttribute('POSITION').getCount()} ${attrs.join(' ')}${range} material=${prim.getMaterial()?.getName()}`)
  }
}
for (const t of root.listTextures()) console.log('texture', t.getName() || t.getURI(), t.getMimeType(), t.getSize(), (t.getImage()?.byteLength / 1024).toFixed(0) + 'KB')
console.log('extensions', root.listExtensionsUsed().map((e) => e.extensionName))
