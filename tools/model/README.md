# Body model pipeline

One command regenerates both bodies from scratch:

```bash
bash tools/model/build.sh
```

Output: `public/models/body-{male,female}.glb` and the muscle-map check images in
`docs/muscle-debug/`. Takes about 4 minutes; downloads ~450 MB of source assets the first time
into `tools/model/cache/` (git-ignored).

## Requirements

- **Blender 4.2 or newer** on `PATH` (tested with 4.5.14 LTS). Linux:
  ```bash
  curl -L https://download.blender.org/release/Blender4.5/blender-4.5.14-linux-x64.tar.xz | tar -xJ -C /opt
  ln -s /opt/blender-4.5.14-linux-x64/blender /usr/local/bin/blender
  # headless Blender needs a few X/GL libraries even with -b:
  apt-get install -y libxi6 libxkbcommon0 libxrender1 libgl1 libsm6 libxxf86vm1 libxfixes3
  ```
- **MPFB 2**: installed automatically by `install_assets.sh`
  (`blender --online-mode --command extension install --sync --enable mpfb`).
- Node (for `compress.mjs`, uses the repo's devDependencies) and Python 3 with Pillow (for the legend image).
- Network access to download.blender.org, extensions.blender.org, files.makehumancommunity.org and github.com.

## Stages

| Script | Does |
|---|---|
| `install_assets.sh` | Installs MPFB, the CC0 MakeHuman asset packs, and Z-Anatomy (idempotent) |
| `build_bodies.py` | **Stage A.** Male and female bodies (athletic proportions, ~13k-vertex skin), the MakeHuman *default* rig (163 bones incl. 3-bone fingers and individual toes, identical names on both), PBR materials, CC0 sports top, fitted shorts generated from the skin. Saves `build/body-*.blend` |
| `extract_zanatomy.py` | **Stage B.1** Muscle surface points for 27 groups × left/right, plus skeletal landmarks, from Z-Anatomy |
| `bake_muscles.py` | **Stage B.2** Segment-by-segment landmark alignment, nearest-muscle projection with region gating, border smoothing. Writes `_MUSCLE_ID` and `_MUSCLE_ID_DEEP` vertex attributes |
| `render_views.py` + `legend.py` | Muscle debug renders (front/side/back/three-quarter + legend) |
| `export_glb.py` | glTF export with skin weights and custom attributes (rest pose, WebP textures) |
| `compress.mjs` | meshopt compression + quantisation (muscle ids kept as exact uint8) |
| `inspect.mjs` | Prints what's inside a GLB |

Muscle ids: `1 + index * 2 + (0 left | 1 right)`, index in `muscle_ids.py` (same order as
`src/body/muscles.ts`). 0 = no muscle.

## Rig

MakeHuman "default" (MPFB `rig.default.json`): root, pelvis, spine01–05, neck01–03, head,
clavicle, shoulder01, upperarm01/02, lowerarm01/02, wrist, metacarpal1–4, finger1–5 (3 bones each),
upperleg01/02, lowerleg01/02, foot, toe1 (2 bones), toe2–5 (3 bones each), plus face bones.
In three.js the dots are dropped from names (`upperleg01.L` → `upperleg01L`).
