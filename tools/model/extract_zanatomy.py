"""Stage B, step 1: pull muscle surface points and skeletal landmarks out of Z-Anatomy.

    blender -b /path/to/Z-Anatomy/Startup.blend -P tools/model/extract_zanatomy.py -- tools/model/cache/zanatomy.json

Z-Anatomy (CC BY-SA 4.0) stands in the anatomical position facing -Y, Z up, with the body's
left on +X: the same axes MPFB uses, so no flip is needed.
"""
import json
import os
import sys

import bpy
from mathutils import Vector

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from zanatomy_map import GROUPS, group_for  # noqa: E402

out = sys.argv[sys.argv.index("--") + 1]
VOXEL = 0.005  # downsample muscle surfaces to a 5 mm grid


def world_verts(name):
    o = bpy.data.objects[name]
    m = o.matrix_world
    return [m @ v.co for v in o.data.vertices]


def centroid(vs):
    return sum(vs, Vector()) / len(vs)


def extreme(vs, axis, top, depth):
    """Centroid of the vertices within `depth` of the extreme along an axis."""
    vals = [v[axis] for v in vs]
    lim = (max(vals) - depth) if top else (min(vals) + depth)
    sel = [v for v in vs if (v[axis] >= lim if top else v[axis] <= lim)]
    return centroid(sel)


landmarks = {}
for s in ("l", "r"):
    sx = 1 if s == "l" else -1
    femur = world_verts(f"Femur.{s}")
    top = [v for v in femur if v.z > max(w.z for w in femur) - 0.06]
    # femoral head: the medial half of the top of the femur (the greater trochanter is lateral)
    mid_x = sorted(v.x * sx for v in top)[len(top) // 2]
    landmarks[f"hip.{s}"] = centroid([v for v in top if v.x * sx <= mid_x])
    tibia = world_verts(f"Tibia.{s}")
    landmarks[f"knee.{s}"] = extreme(tibia, 2, True, 0.02)
    landmarks[f"ankle.{s}"] = centroid(world_verts(f"Talus.{s}"))
    landmarks[f"toe.{s}"] = extreme(world_verts(f"Second metatarsal bone.{s}"), 1, False, 0.01)  # distal end (facing -Y)
    humerus = world_verts(f"Humerus.{s}")
    landmarks[f"shoulder.{s}"] = extreme(humerus, 2, True, 0.035)
    landmarks[f"elbow.{s}"] = extreme(humerus, 2, False, 0.02)
    landmarks[f"wrist.{s}"] = extreme(world_verts(f"Radius.{s}") + world_verts(f"Ulna.{s}"), 2, False, 0.015)
    landmarks[f"index_knuckle.{s}"] = extreme(world_verts(f"Second metacarpal bone.{s}"), 2, False, 0.01)
    landmarks[f"pinky_knuckle.{s}"] = extreme(world_verts(f"Fifth metacarpal bone.{s}"), 2, False, 0.01)
skull = world_verts("Frontal bone") + world_verts("Parietal bone.l") + world_verts("Parietal bone.r") + world_verts("Occipital bone")
landmarks["head_top"] = Vector((0.0, centroid(skull).y, max(v.z for v in skull)))

muscles = {}
used = {}
for o in bpy.data.objects:
    if o.type != "MESH" or not any(c.name == "4: Muscular system" for c in o.users_collection):
        continue
    if not (o.name.endswith(".l") or o.name.endswith(".r")):
        continue
    g = group_for(o.name[:-2])
    if not g:
        continue
    key = f"{g}.{o.name[-1]}"
    cells = muscles.setdefault(key, {})
    for v in world_verts(o.name):
        cells.setdefault((round(v.x / VOXEL), round(v.y / VOXEL), round(v.z / VOXEL)), v)
    used.setdefault(key, []).append(o.name)

missing = [f"{g}.{s}" for g in GROUPS for s in "lr" if f"{g}.{s}" not in muscles]
if missing:
    raise SystemExit(f"No Z-Anatomy objects matched: {missing}")

data = {
    "source": "Z-Anatomy (CC BY-SA 4.0), derived from BodyParts3D (CC BY-SA 2.1 JP)",
    "landmarks": {k: [round(c, 5) for c in v] for k, v in landmarks.items()},
    "muscles": {k: [[round(c, 4) for c in v] for v in cells.values()] for k, cells in muscles.items()},
    "objects": used,
}
os.makedirs(os.path.dirname(os.path.abspath(out)), exist_ok=True)
with open(out, "w") as f:
    json.dump(data, f)
print("EXTRACTED", out, {k: len(v) for k, v in sorted(data["muscles"].items()) if k.endswith(".l")})
