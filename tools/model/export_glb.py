"""Export a built body to glTF binary (uncompressed; compress.mjs compresses it).

    blender -b tools/model/build/body-male.blend -P tools/model/export_glb.py -- tools/model/build/body-male.raw.glb
"""
import sys

import bpy

out = sys.argv[sys.argv.index("--") + 1]
rig = bpy.data.objects["Skeleton"]
bpy.ops.object.select_all(action="DESELECT")
rig.select_set(True)
for o in rig.children:
    o.select_set(True)
bpy.context.view_layer.objects.active = rig
# rest pose, so the bind pose matches the mesh exactly
rig.data.pose_position = "REST"

bpy.ops.export_scene.gltf(
    filepath=out,
    export_format="GLB",
    use_selection=True,
    export_yup=True,
    export_apply=True,            # modifiers other than the armature are baked in
    export_skins=True,
    export_all_influences=False,  # 4 weights per vertex
    export_def_bones=False,
    export_morph=False,
    export_animations=False,
    export_attributes=True,       # custom attributes whose names start with "_" (_MUSCLE_ID, _MUSCLE_ID_DEEP)
    export_image_format="WEBP",
    export_image_quality=88,
    export_materials="EXPORT",
    export_extras=False,
)
print("EXPORTED", out)
