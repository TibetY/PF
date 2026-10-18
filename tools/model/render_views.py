"""Render front / side / back / three-quarter views of a built body for visual checks.

    blender -b tools/model/build/body-male.blend -P tools/model/render_views.py -- out.png [--muscles]

--muscles colours the skin by the baked _MUSCLE_ID attribute (one distinct colour per muscle,
left/right sides in slightly different shades) for the Stage B debug image.
"""
import colorsys
import math
import os
import sys

import bpy
from mathutils import Vector

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

args = sys.argv[sys.argv.index("--") + 1:]
out = os.path.abspath(args[0])
muscles = "--muscles" in args
deep = "--deep" in args

scene = bpy.context.scene
scene.render.engine = "CYCLES"
scene.cycles.device = "CPU"
scene.cycles.samples = 24
scene.cycles.use_denoising = True
scene.render.resolution_x = 520
scene.render.resolution_y = 900
scene.render.film_transparent = False
scene.view_settings.view_transform = "AgX"

world = bpy.data.worlds.new("W") if not scene.world else scene.world
scene.world = world
world.use_nodes = True
world.node_tree.nodes["Background"].inputs["Color"].default_value = (0.92, 0.93, 0.95, 1)
world.node_tree.nodes["Background"].inputs["Strength"].default_value = 0.45

body = bpy.data.objects["Body"]
rig = bpy.data.objects["Skeleton"]
height = max((body.matrix_world @ v.co).z for v in body.data.vertices)

# soft key + fill lights
for name, loc, energy in [("Key", (2.5, -3.5, 3.0), 420), ("Fill", (-3.0, -2.0, 1.5), 140), ("Rim", (0.0, 4.0, 2.5), 260)]:
    light = bpy.data.lights.new(name, "AREA")
    light.energy = energy
    light.size = 3
    ob = bpy.data.objects.new(name, light)
    scene.collection.objects.link(ob)
    ob.location = loc
    ob.rotation_euler = (Vector((0, 0, height * 0.55)) - Vector(loc)).to_track_quat("-Z", "Y").to_euler()

from muscle_ids import MUSCLES  # noqa: E402

# 27 well-separated colours (sRGB -> linear below), one per muscle group
_HEX = ["e6194b", "3cb44b", "ffe119", "4363d8", "f58231", "911eb4", "42d4f4", "f032e6", "bfef45", "fabed4",
        "469990", "dcbeff", "9a6324", "008b8b", "800000", "aaffc3", "808000", "ffd8b1", "000075", "a9a9a9",
        "e6beff", "1f78b4", "b15928", "6a3d9a", "ff7f00", "33a02c", "fb9a99"]
PALETTE = [tuple((int(h[i:i + 2], 16) / 255) ** 2.2 for i in (0, 2, 4)) for h in _HEX]

if muscles:
    attr = "_MUSCLE_ID_DEEP" if deep else "_MUSCLE_ID"
    mat = bpy.data.materials.new("MuscleDebug")
    mat.use_nodes = True
    nt = mat.node_tree
    bsdf = nt.nodes["Principled BSDF"]
    bsdf.inputs["Roughness"].default_value = 0.7
    # one colour per muscle id, written straight into a colour attribute
    def colour(c):
        if c <= 0:
            return (0.78, 0.78, 0.78, 1)
        i, side = (c - 1) // 2, (c - 1) % 2
        r, g, b = PALETTE[i]
        k = 1.0 if side == 0 else 0.62  # the body's right side is a darker shade
        return (r * k, g * k, b * k, 1)

    painted = [o for o in rig.children if o.type == "MESH" and attr in o.data.attributes]
    for o in painted:
        vals = [0.0] * len(o.data.vertices)
        o.data.attributes[attr].data.foreach_get("value", vals)
        col = o.data.color_attributes.new("_Debug", "FLOAT_COLOR", "POINT")
        flat = []
        for v in vals:
            flat.extend(colour(int(round(v))))
        col.data.foreach_set("color", flat)
    a = nt.nodes.new("ShaderNodeAttribute")
    a.attribute_name = "_Debug"
    # flat colour with light shading so region borders read clearly
    emit = nt.nodes.new("ShaderNodeEmission")
    emit.inputs["Strength"].default_value = 0.75
    nt.links.new(a.outputs["Color"], emit.inputs["Color"])
    nt.links.new(a.outputs["Color"], bsdf.inputs["Base Color"])
    add = nt.nodes.new("ShaderNodeAddShader")
    nt.links.new(bsdf.outputs[0], add.inputs[0])
    nt.links.new(emit.outputs[0], add.inputs[1])
    nt.links.new(add.outputs[0], nt.nodes["Material Output"].inputs["Surface"])
    scene.view_settings.view_transform = "Standard"
    for o in painted:  # body and clothes (the glutes are mostly under the shorts)
        o.data.materials.clear()
        o.data.materials.append(mat)
    for o in rig.children:
        if o.type == "MESH" and o not in painted:
            o.hide_render = True  # hair, eyes, brows

cam_data = bpy.data.cameras.new("Cam")
cam_data.type = "ORTHO"
cam_data.ortho_scale = height * 1.12
cam = bpy.data.objects.new("Cam", cam_data)
scene.collection.objects.link(cam)
scene.camera = cam

views = {"front": 0, "side": 90, "back": 180, "threequarter": 35}
files = []
for name, deg in views.items():
    a = math.radians(deg)
    d = 6.0
    cam.location = (d * math.sin(a), -d * math.cos(a), height * 0.52)
    cam.rotation_euler = (math.radians(90), 0, a)
    path = out.replace(".png", f"-{name}.png")
    scene.render.filepath = path
    bpy.ops.render.render(write_still=True)
    files.append(path)
if muscles:
    # legend: muscle names in their colours, as a separate image
    try:
        from PIL import Image, ImageDraw  # noqa: F401  (only when Blender's Python has Pillow)
    except ImportError:
        pass
    with open(out.replace(".png", "-legend.json"), "w") as f:
        import json
        json.dump({m: _HEX[i] for i, m in enumerate(MUSCLES)}, f)
print("RENDERED", " ".join(files))
