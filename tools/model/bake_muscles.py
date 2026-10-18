"""Stage B, step 2: bake muscle IDs onto the body (and clothes) as vertex attributes.

    blender -b tools/model/build/body-male.blend -P tools/model/bake_muscles.py -- tools/model/cache/zanatomy.json

Method
  1. Align: Z-Anatomy muscle points are carried onto the MPFB body segment by segment
     (thigh, shin, foot, upper arm, forearm per side, plus the torso/neck/head), using matching
     landmarks: hip, knee, ankle, 2nd toe, shoulder, elbow, wrist, index/pinky knuckles, head top.
     Limb points keep their position along the bone (scaled to the body's bone length) and their
     offset around it (rotated onto the body's bone; the forearm also untwists from Z-Anatomy's
     palms-forward pose). Torso points are scaled piecewise by height, with width interpolated
     between hip and shoulder width. Points near a joint blend the transforms of both segments.
  2. Project: each skin vertex takes the nearest muscle within a distance threshold, choosing only
     among muscles plausible for the bone that drives it and only on its own side, which stops
     bleeding across regions and left/right swaps.
  3. Smooth: majority vote over neighbouring vertices removes speckle at the borders.

Writes _MUSCLE_ID (the superficial muscle) and _MUSCLE_ID_DEEP (a deep muscle lying under it,
e.g. piriformis under the glutes) as float point attributes; 0 = none. Codes: muscle_ids.py.
"""
import json
import math
import os
import sys
from collections import Counter

import bmesh
import bpy
from mathutils import Matrix, Quaternion, Vector
from mathutils.kdtree import KDTree

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from muscle_ids import MUSCLES, code  # noqa: E402

cache = sys.argv[sys.argv.index("--") + 1]
with open(cache) as f:
    ZA = json.load(f)

rig = bpy.data.objects["Skeleton"]
body = bpy.data.objects["Body"]
SIDES = ("l", "r")

# ---------------------------------------------------------------- landmarks on the body
def bone_head(name):
    return rig.matrix_world @ rig.data.bones[name].head_local


body_lm = {}
for s in SIDES:
    S = s.upper()
    body_lm.update({
        f"hip.{s}": bone_head(f"upperleg01.{S}"), f"knee.{s}": bone_head(f"lowerleg01.{S}"),
        f"ankle.{s}": bone_head(f"foot.{S}"), f"toe.{s}": bone_head(f"toe2-1.{S}"),
        f"shoulder.{s}": bone_head(f"upperarm01.{S}"), f"elbow.{s}": bone_head(f"lowerarm01.{S}"),
        f"wrist.{s}": bone_head(f"wrist.{S}"), f"index_knuckle.{s}": bone_head(f"finger2-1.{S}"),
        f"pinky_knuckle.{s}": bone_head(f"finger5-1.{S}"),
    })
verts_w = [body.matrix_world @ v.co for v in body.data.vertices]
top = max(v.z for v in verts_w)
head_y = sum(v.y for v in verts_w if v.z > top - 0.05) / max(1, sum(1 for v in verts_w if v.z > top - 0.05))
body_lm["head_top"] = Vector((0.0, head_y, top))
za_lm = {k: Vector(v) for k, v in ZA["landmarks"].items()}


# ---------------------------------------------------------------- segment transforms
class Limb:
    def __init__(self, a, b, twist_ref=None):
        self.A, self.B = za_lm[a], za_lm[b]
        self.A2, self.B2 = body_lm[a], body_lm[b]
        ab, ab2 = self.B - self.A, self.B2 - self.A2
        self.L, self.L2 = ab.length, ab2.length
        self.u, self.u2 = ab.normalized(), ab2.normalized()
        self.rot = self.u.rotation_difference(self.u2)
        self.radial = self.L2 / self.L
        self.twist = 0.0
        if twist_ref:
            i, p = twist_ref
            v1 = self.rot @ (za_lm[i] - za_lm[p])
            v2 = body_lm[i] - body_lm[p]
            v1 = (v1 - v1.dot(self.u2) * self.u2).normalized()
            v2 = (v2 - v2.dot(self.u2) * self.u2).normalized()
            self.twist = math.atan2(self.u2.dot(v1.cross(v2)), v1.dot(v2))

    def dist(self, p):
        t = max(0.0, min(1.0, (p - self.A).dot(self.u) / self.L))
        return (p - (self.A + self.u * t * self.L)).length

    def map(self, p):
        d = p - self.A
        along = d.dot(self.u)
        radial = self.rot @ (d - self.u * along)
        t = max(0.0, min(1.0, along / self.L))
        if self.twist:
            radial = Quaternion(self.u2, self.twist * t) @ radial
        return self.A2 + self.u2 * (along * self.L2 / self.L) + radial * self.radial


class Torso:
    """Piecewise height mapping hip -> shoulder -> head top; width from hip/shoulder widths."""

    def __init__(self):
        def lvl(lm):
            hip = (lm["hip.l"] + lm["hip.r"]) / 2
            sh = (lm["shoulder.l"] + lm["shoulder.r"]) / 2
            return hip, sh, lm["head_top"], (lm["hip.l"] - lm["hip.r"]).length, (lm["shoulder.l"] - lm["shoulder.r"]).length
        self.za = lvl(za_lm)
        self.bd = lvl(body_lm)

    def dist(self, p):
        hip, sh, *_ = self.za
        z = max(hip.z - 0.12, min(sh.z + 0.25, p.z))
        return max(0.0, math.hypot(p.x, p.y - hip.y) - 0.10) + abs(p.z - z)

    def map(self, p):
        (h1, s1, t1, hw1, sw1), (h2, s2, t2, hw2, sw2) = self.za, self.bd
        if p.z <= s1.z:
            f = (p.z - h1.z) / (s1.z - h1.z)
            z = h2.z + f * (s2.z - h2.z)
        else:
            f = 1 + (p.z - s1.z) / (t1.z - s1.z)
            z = s2.z + (f - 1) * (t2.z - s2.z)
        k = max(0.0, min(1.0, f))
        xs = (hw2 / hw1) * (1 - k) + (sw2 / sw1) * k
        y0a = h1.y + (s1.y - h1.y) * k
        y0b = h2.y + (s2.y - h2.y) * k
        return Vector((p.x * xs, y0b + (p.y - y0a) * xs, z))


segs = {"torso": Torso()}
for s in SIDES:
    segs[f"thigh.{s}"] = Limb(f"hip.{s}", f"knee.{s}")
    segs[f"shin.{s}"] = Limb(f"knee.{s}", f"ankle.{s}")
    segs[f"foot.{s}"] = Limb(f"ankle.{s}", f"toe.{s}")
    segs[f"upperarm.{s}"] = Limb(f"shoulder.{s}", f"elbow.{s}")
    segs[f"forearm.{s}"] = Limb(f"elbow.{s}", f"wrist.{s}", twist_ref=(f"index_knuckle.{s}", f"pinky_knuckle.{s}"))

SEGMENTS_FOR = {
    "hamstrings": ["thigh", "torso", "shin"], "quadriceps": ["thigh", "torso", "shin"],
    "adductors": ["thigh", "torso"], "it_band": ["thigh", "torso", "shin"],
    "hip_flexors": ["torso", "thigh"], "glutes": ["torso", "thigh"], "abductors": ["torso", "thigh"],
    "piriformis": ["torso", "thigh"],
    "calves": ["shin", "thigh"], "soleus": ["shin"], "tibialis_anterior": ["shin"], "foot_flexors": ["foot", "shin"],
    "front_delts": ["upperarm", "torso"], "side_delts": ["upperarm", "torso"], "rear_delts": ["upperarm", "torso"],
    "biceps": ["upperarm", "forearm", "torso"], "triceps": ["upperarm", "forearm", "torso"],
    "forearm_flexors": ["forearm", "upperarm"], "forearm_extensors": ["forearm", "upperarm"],
}
SIGMA = 0.035


def carry(group, side, p):
    names = SEGMENTS_FOR.get(group, ["torso", "upperarm"])
    cands = [segs[n if n == "torso" else f"{n}.{side}"] for n in names]
    ds = [c.dist(p) for c in cands]
    dmin = min(ds)
    ws = [math.exp(-((d - dmin) / SIGMA) ** 2) for d in ds]
    tot = sum(ws)
    out = Vector()
    for c, w in zip(cands, ws):
        if w / tot > 0.02:
            out += c.map(p) * (w / tot)
        else:
            tot -= w
    return out * (sum(ws) / tot) if tot else cands[0].map(p)


trees = {}
for key, pts in ZA["muscles"].items():
    g, s = key.rsplit(".", 1)
    t = KDTree(len(pts))
    for i, p in enumerate(pts):
        t.insert(carry(g, s, Vector(p)), i)
    t.balance()
    trees[(g, s)] = t

# ---------------------------------------------------------------- which muscles a bone may carry
TORSO = ["abs", "obliques", "lower_back", "lats", "upper_back", "traps", "chest", "neck", "glutes", "hip_flexors", "abductors"]
ALLOWED = [
    (("upperleg",), ["hamstrings", "quadriceps", "hip_flexors", "glutes", "adductors", "abductors", "it_band", "piriformis"]),
    (("lowerleg",), ["calves", "soleus", "tibialis_anterior", "hamstrings", "quadriceps", "it_band"]),
    (("foot", "toe"), ["foot_flexors"]),
    (("pelvis", "root"), ["glutes", "abductors", "piriformis", "hip_flexors", "adductors", "abs", "obliques", "lower_back", "it_band"]),
    (("spine",), TORSO),
    (("breast",), ["chest"]),
    (("clavicle", "shoulder"), ["traps", "chest", "front_delts", "side_delts", "rear_delts", "upper_back", "neck", "lats"]),
    (("upperarm",), ["biceps", "triceps", "front_delts", "side_delts", "rear_delts", "chest", "lats", "upper_back"]),
    (("lowerarm",), ["forearm_flexors", "forearm_extensors", "biceps", "triceps"]),
    (("neck",), ["neck", "traps"]),
]
# Prefer a muscle belly over a neighbour's aponeurosis lying on top of it (metres subtracted from
# its distance): the external oblique's sheet covers the rectus abdominis, the thoracolumbar
# fascia the lower back, and the gluteus maximus the upper hamstrings.
BIAS = {"abs": 0.011, "lats": 0.012}
# Deep muscles that may show "through" the skin: max depth (m) and which way the skin must face
# (+1 = back, -1 = front, 0 = any). The body faces -Y.
DEEP = {"piriformis": (0.065, 1), "hip_flexors": (0.05, -1), "soleus": (0.04, 0),
        "upper_back": (0.035, 1), "lower_back": (0.04, 1)}
THRESH = 0.055       # skin to muscle surface, after alignment
HIP_Z = (body_lm["hip.l"].z + body_lm["hip.r"].z) / 2


def allowed_for(bone):
    for prefixes, groups in ALLOWED:
        if bone.startswith(prefixes):
            return groups
    return []


def classify(obj):
    mesh = obj.data
    groups = {g.index: g.name for g in obj.vertex_groups}
    mw = obj.matrix_world
    sup, deep = [], []
    for v in mesh.vertices:
        p = mw @ v.co
        side = "l" if p.x >= 0 else "r"
        if not v.groups:
            sup.append(0)
            deep.append(0)
            continue
        dominant = groups[max(v.groups, key=lambda g: g.weight).group]
        cands = []
        groups_ok = allowed_for(dominant)
        if groups_ok == ["foot_flexors"] and (mw.to_3x3() @ v.normal).normalized().z > -0.35:
            groups_ok = []  # foot flexors only on the sole
        for g in groups_ok:
            _, _, d = trees[(g, side)].find(p)
            cands.append((d - BIAS.get(g, 0.0), g))
        cands.sort()
        if not cands or cands[0][0] > THRESH:
            sup.append(0)
            first = None
        else:
            first = cands[0][1]
            sup.append(code(first, side))
        ny = (mw.to_3x3() @ v.normal).normalized().y
        dg = None
        for g, (limit, facing) in DEEP.items():
            if g == first or (facing and ny * facing < 0.15):
                continue
            if g == "hip_flexors" and p.z < HIP_Z - 0.12:
                continue  # deep iliopsoas only around the hip; the sartorius below is superficial
            hit = trees.get((g, side)) and trees[(g, side)].find(p)
            if hit and hit[2] < limit and (dg is None or hit[2] < dg[0]):
                dg = (hit[2], g)
        deep.append(code(dg[1], side) if dg else 0)
    return sup, deep


def smooth(obj, labels, rounds=3):
    bm = bmesh.new()
    bm.from_mesh(obj.data)
    bm.verts.ensure_lookup_table()
    nbrs = [[e.other_vert(v).index for e in v.link_edges] for v in bm.verts]
    bm.free()
    for _ in range(rounds):
        new = labels[:]
        for i, ns in enumerate(nbrs):
            if not ns:
                continue
            c = Counter(labels[j] for j in ns)
            c[labels[i]] += 1
            lab, n = c.most_common(1)[0]
            if lab != labels[i] and n > (len(ns) + 1) / 2:
                new[i] = lab
        labels = new
    return labels


def write(obj, name, labels):
    if name in obj.data.attributes:
        obj.data.attributes.remove(obj.data.attributes[name])
    a = obj.data.attributes.new(name, "FLOAT", "POINT")
    a.data.foreach_set("value", [float(x) for x in labels])


report = {}
for obj in [o for o in rig.children if o.type == "MESH" and o.name in ("Body", "Shorts", "Top")]:
    sup, deep = classify(obj)
    sup, deep = smooth(obj, sup), smooth(obj, deep)
    write(obj, "_MUSCLE_ID", sup)
    write(obj, "_MUSCLE_ID_DEEP", deep)
    report[obj.name] = Counter(sup)

counts = report["Body"]
print("BAKED", {f"{MUSCLES[(c - 1) // 2]}.{'lr'[(c - 1) % 2]}": n for c, n in sorted(counts.items()) if c},
      "unassigned", counts.get(0, 0), "of", sum(counts.values()))
empty = [m for m in MUSCLES for s in SIDES if not any(c == code(m, s) for c in counts) and not any(
    c == code(m, s) for o in report.values() for c in o)]
print("NO_SKIN", empty)
bpy.ops.wm.save_mainfile()
