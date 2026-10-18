"""Stage A: generate the male and female base bodies with MPFB 2 (MakeHuman Plugin for Blender).

Run headless (Blender 4.2+ with the MPFB 2 extension and the CC0 asset packs installed;
see tools/model/README.md):

    blender -b -P tools/model/build_bodies.py

Writes tools/model/build/body-{male,female}.blend. Every setting below is fixed, so the
output is reproducible. Materials are rebuilt as plain Principled BSDF so they export to
glTF as standard PBR materials.
"""
import os
import sys

import bmesh
import bpy
from mathutils import Vector

from bl_ext.blender_org.mpfb.services.assetservice import AssetService
from bl_ext.blender_org.mpfb.services.humanservice import HumanService
from bl_ext.blender_org.mpfb.services.targetservice import TargetService

HERE = os.path.dirname(os.path.abspath(__file__))
OUT = os.path.join(HERE, "build")

RACE = {"african": 0.3333, "asian": 0.3333, "caucasian": 0.3334}

# MakeHuman macro sliders, 0..1. Age 0.5 = 25 years. Athletic but not exaggerated.
BODIES = {
    "male": {
        "macro": {"gender": 1.0, "age": 0.5, "muscle": 0.68, "weight": 0.48, "proportions": 0.75,
                  "height": 0.54, "cupsize": 0.5, "firmness": 0.5},
        "skin": "young_caucasian_male/young_caucasian_male.mhmat",
        "hair": "short02/short02.mhclo",
        "eyebrows": "eyebrow001/eyebrow001.mhclo",
        "clothes": [],
    },
    "female": {
        "macro": {"gender": 0.0, "age": 0.5, "muscle": 0.62, "weight": 0.46, "proportions": 0.75,
                  "height": 0.55, "cupsize": 0.45, "firmness": 0.65},
        "skin": "young_caucasian_female/young_caucasian_female.mhmat",
        "hair": "ponytail01/ponytail01.mhclo",
        "eyebrows": "eyebrow010/eyebrow010.mhclo",
        "clothes": [("wolgade_female_top_01/wolgade_female_top_01.mhclo", (0.09, 0.42, 0.45))],
    },
}
SHORTS_COLOUR = (0.025, 0.03, 0.04)
RIG = "default"  # 163 bones incl. 3-bone fingers and individual toes (toe1-1.L ... toe5-3.R)


def asset(sub, frag):
    path = AssetService.find_asset_absolute_path(frag, asset_subdir=sub)
    if not path:
        raise SystemExit(f"Missing MPFB asset {sub}/{frag}. Run tools/model/install_assets.sh first.")
    return path


def mhmat_texture(mhmat_path, key="diffuseTexture"):
    folder = os.path.dirname(mhmat_path)
    with open(mhmat_path, encoding="utf-8", errors="ignore") as f:
        for line in f:
            parts = line.strip().split(None, 1)
            if len(parts) == 2 and parts[0] == key:
                p = os.path.join(folder, os.path.basename(parts[1].strip()))
                if os.path.exists(p):
                    return p
    return None


def pbr(name, base_image=None, color=(0.8, 0.8, 0.8), roughness=0.5, normal_image=None, alpha=False,
        tint=None, sheen=0.0, coat=0.0, subsurface=0.0):
    """A glTF-exportable Principled BSDF material."""
    mat = bpy.data.materials.new(name)
    mat.use_nodes = True
    nt = mat.node_tree
    bsdf = nt.nodes["Principled BSDF"]
    bsdf.inputs["Roughness"].default_value = roughness
    bsdf.inputs["Base Color"].default_value = (*color, 1.0)
    if sheen:
        bsdf.inputs["Sheen Weight"].default_value = sheen
    if coat:
        bsdf.inputs["Coat Weight"].default_value = coat
    if subsurface:
        bsdf.inputs["Subsurface Weight"].default_value = subsurface
    if base_image:
        tex = nt.nodes.new("ShaderNodeTexImage")
        tex.image = bpy.data.images.load(base_image, check_existing=True)
        if tint:
            # recolour fabric: keep the texture's shading detail, replace its hue
            mix = nt.nodes.new("ShaderNodeMix")
            mix.data_type = "RGBA"
            mix.blend_type = "MULTIPLY"
            mix.inputs["Factor"].default_value = 1.0
            bw = nt.nodes.new("ShaderNodeRGBToBW")
            nt.links.new(tex.outputs["Color"], bw.inputs["Color"])
            nt.links.new(bw.outputs["Val"], mix.inputs["A"])
            mix.inputs["B"].default_value = (*tint, 1.0)
            nt.links.new(mix.outputs["Result"], bsdf.inputs["Base Color"])
        else:
            nt.links.new(tex.outputs["Color"], bsdf.inputs["Base Color"])
        if alpha:
            nt.links.new(tex.outputs["Alpha"], bsdf.inputs["Alpha"])
            mat.blend_method = "HASHED"
    elif tint:
        bsdf.inputs["Base Color"].default_value = (*tint, 1.0)
    if normal_image:
        ntex = nt.nodes.new("ShaderNodeTexImage")
        ntex.image = bpy.data.images.load(normal_image, check_existing=True)
        ntex.image.colorspace_settings.name = "Non-Color"
        nmap = nt.nodes.new("ShaderNodeNormalMap")
        nt.links.new(ntex.outputs["Color"], nmap.inputs["Color"])
        nt.links.new(nmap.outputs["Normal"], bsdf.inputs["Normal"])
    return mat


def set_material(obj, mat):
    obj.data.materials.clear()
    obj.data.materials.append(mat)


def apply_modifier(obj, name):
    bpy.context.view_layer.objects.active = obj
    mod = obj.modifiers[name]
    mod.show_viewport = True  # MPFB adds some modifiers render-only
    if mod.type == "SUBSURF":
        mod.levels = max(mod.levels, mod.render_levels, 1)
    idx = list(obj.modifiers).index(obj.modifiers[name])
    if idx:
        bpy.ops.object.modifier_move_to_index(modifier=name, index=0)
    bpy.ops.object.modifier_apply(modifier=name)


def delete_vertices(body):
    """Keep only real skin: drop helper geometry (not in 'body') and skin under clothes (Delete.* groups)."""
    keep = body.vertex_groups["body"].index
    drop = {g.index for g in body.vertex_groups if g.name.startswith("Delete.")}
    bm = bmesh.new()
    bm.from_mesh(body.data)
    deform = bm.verts.layers.deform.active
    doomed = []
    for v in bm.verts:
        groups = v[deform]
        if groups.get(keep, 0.0) <= 0.0 or any(groups.get(i, 0.0) > 0.0 for i in drop):
            doomed.append(v)
    bmesh.ops.delete(bm, geom=doomed, context="VERTS")
    bm.to_mesh(body.data)
    bm.free()
    for m in list(body.modifiers):
        if m.type == "MASK":
            body.modifiers.remove(m)


TRUNK_BONES = ("upperleg", "pelvis", "root", "spine05", "spine04", "spine03")


def make_fitted(body, rig, name, offset, waist_above_hip=0.075, hem_below_hip=0.2):
    """Fitted athletic shorts from the body's own skin: the band between a waistband plane and a
    hem plane (measured from the hip joints), on skin driven by the pelvis/thigh/lower-spine bones,
    cut exactly at both planes and offset along the normals. Same skin weights as the body, so it
    deforms with it. The skin underneath (minus a small margin) is removed from the body."""
    hip_z = sum((rig.matrix_world @ rig.data.bones[f"upperleg01.{s}"].head_local).z for s in "LR") / 2
    waist, hem = hip_z + waist_above_hip, hip_z - hem_below_hip

    obj = body.copy()
    obj.data = body.data.copy()
    body.users_collection[0].objects.link(obj)
    trunk = {g.index for g in obj.vertex_groups if g.name.startswith(TRUNK_BONES)}
    keep = obj.vertex_groups["body"].index

    def in_trunk(weights):
        return sum(w for i, w in weights.items() if i in trunk) > 0.5

    bm = bmesh.new()
    bm.from_mesh(obj.data)
    deform = bm.verts.layers.deform.active
    mw = body.matrix_world
    band = lambda f, lo, hi: lo <= (mw @ f.calc_center_median()).z <= hi  # noqa: E731
    drop = [f for f in bm.faces if not (all(v[deform].get(keep, 0) > 0 and in_trunk(v[deform]) for v in f.verts)
                                        and band(f, hem - 0.03, waist + 0.03))]
    bmesh.ops.delete(bm, geom=drop, context="FACES")
    bmesh.ops.delete(bm, geom=[v for v in bm.verts if not v.link_faces], context="VERTS")
    inv = mw.inverted()
    for z, normal in ((waist, (0, 0, 1)), (hem, (0, 0, -1))):
        geom = bm.verts[:] + bm.edges[:] + bm.faces[:]
        bmesh.ops.bisect_plane(bm, geom=geom, plane_co=inv @ Vector((0, 0, z)), plane_no=normal, clear_outer=True)
    bm.normal_update()
    for v in bm.verts:
        v.co += v.normal * offset
    bm.to_mesh(obj.data)
    bm.free()
    for m in list(obj.modifiers):
        if m.type != "ARMATURE":
            obj.modifiers.remove(m)
    obj.name = obj.data.name = name

    # skin well inside the band (4.5 cm margin: deleting vertices leaves a stepped edge) is hidden
    hidden = [v.index for v in body.data.vertices
              if hem + 0.045 <= (mw @ v.co).z <= waist - 0.045
              and in_trunk({g.group: g.weight for g in v.groups})]
    g = body.vertex_groups.new(name="Delete.fitted." + name)
    g.add(hidden, 1.0, "REPLACE")
    return obj


def build(sex, spec):
    bpy.ops.wm.read_factory_settings(use_empty=True)

    macro = TargetService.get_default_macro_info_dict()
    macro.update(spec["macro"])
    macro["race"] = dict(RACE)
    body = HumanService.create_human(macro_detail_dict=macro, feet_on_ground=True)
    body.name = "Body"
    rig = HumanService.add_builtin_rig(body, RIG)
    rig.name = rig.data.name = "Skeleton"

    # (object, asset subdir, mhclo fragment, role, tint)
    added = []

    def add(sub, frag, role, tint=None, subdiv=0):
        before = set(bpy.data.objects)
        HumanService.add_mhclo_asset(asset(sub, frag), body, asset_type=sub, subdiv_levels=subdiv, material_type="MAKESKIN")
        obj = next(o for o in bpy.data.objects if o not in before and o.type == "MESH")
        obj.name = role
        added.append((obj, sub, frag, role, tint))

    add("eyes", "low-poly/low-poly.mhclo", "Eyes")
    add("eyebrows", spec["eyebrows"], "Eyebrows")
    add("eyelashes", "eyelashes02/eyelashes02.mhclo", "Eyelashes")
    add("hair", spec["hair"], "Hair")
    for frag, tint in spec["clothes"]:
        add("clothes", frag, "Top" if "top" in frag else "Shorts", tint, subdiv=1)

    # bake the macro shape keys into the mesh: the export needs a single static shape
    TargetService.bake_targets(body)

    # Fitted athletic shorts made from the body's own (CC0) skin: exact fit, straight hems,
    # same skin weights, so they can't separate from the body in any pose.
    shorts = make_fitted(body, rig, "Shorts", 0.004)
    added.append((shorts, "clothes", None, "Shorts", SHORTS_COLOUR))

    # drop MakeHuman helper geometry and the skin hidden under the clothes
    delete_vertices(body)
    for obj, *_ in added:
        for m in list(obj.modifiers):
            if m.type == "SUBSURF":
                apply_modifier(obj, m.name)

    # keep only deform-bone vertex groups (skin weights) and the armature modifier
    bone_names = {b.name for b in rig.data.bones}
    for o in [body] + [a[0] for a in added]:
        for g in list(o.vertex_groups):
            if g.name not in bone_names:
                o.vertex_groups.remove(g)
        for m in list(o.modifiers):
            if m.type != "ARMATURE":
                o.modifiers.remove(m)

    # ---- materials: glTF-friendly PBR ----
    set_material(body, pbr("Skin", base_image=mhmat_texture(asset("skins", spec["skin"])), roughness=0.52, subsurface=0.15))
    for obj, sub, frag, role, tint in added:
        if frag is None:  # generated garment
            set_material(obj, pbr(role, tint=tint, roughness=0.8, sheen=0.15))
            continue
        folder = os.path.dirname(asset(sub, frag))
        if role == "Eyes":
            mat = pbr("Eyes", base_image=os.path.join(folder, "..", "materials", "brown_eye.png"), roughness=0.15, coat=0.6)
        else:
            mhmat = next(os.path.join(folder, f) for f in sorted(os.listdir(folder)) if f.endswith(".mhmat"))
            normal = mhmat_texture(mhmat, "normalmapTexture")
            if sub == "clothes":
                # solid athletic colour; the source denim/print texture isn't used
                # (its normal map is skipped too: it bakes in a frayed denim hem)
                mat = pbr(role, tint=tint, roughness=0.8, sheen=0.15)
            else:  # hair cards, brows, lashes: alpha-tested textures
                mat = pbr(role, base_image=mhmat_texture(mhmat), roughness=0.6, normal_image=normal, alpha=True)
        set_material(obj, mat)

    body.name = "Body"
    os.makedirs(OUT, exist_ok=True)
    path = os.path.join(OUT, f"body-{sex}.blend")
    bpy.ops.wm.save_as_mainfile(filepath=path)

    stats = {o.name: (len(o.data.vertices), len(o.data.polygons)) for o in rig.children if o.type == "MESH"}
    height = max((body.matrix_world @ v.co).z for v in body.data.vertices)
    print(f"BUILT {sex}: {path} height={height:.3f}m bones={len(rig.data.bones)} meshes={stats}")


if __name__ == "__main__":
    which = sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else list(BODIES)
    for sex in which:
        build(sex, BODIES[sex])
