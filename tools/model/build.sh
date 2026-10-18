#!/usr/bin/env bash
# Regenerate both body models from scratch:  bash tools/model/build.sh
# Output: public/models/body-{male,female}.glb and docs/muscle-debug/*.png
set -euo pipefail
HERE="$(cd "$(dirname "$0")" && pwd)"
ROOT="$(cd "$HERE/../.." && pwd)"
cd "$ROOT"
command -v blender >/dev/null || { echo "Blender 4.2+ must be on PATH (see tools/model/README.md)"; exit 1; }

bash "$HERE/install_assets.sh"

echo "== Stage A: bodies"
blender -b -P "$HERE/build_bodies.py" | grep -E "^BUILT"

echo "== Stage B: muscle map"
ZA_JSON="$HERE/cache/zanatomy.json"
if [ ! -f "$ZA_JSON" ]; then
  blender -b "$HERE/cache/zanatomy/Z-Anatomy/Startup.blend" -P "$HERE/extract_zanatomy.py" -- "$ZA_JSON" | grep -E "^EXTRACTED"
fi
mkdir -p public/models docs/muscle-debug
for sex in male female; do
  blender -b "$HERE/build/body-$sex.blend" -P "$HERE/bake_muscles.py" -- "$ZA_JSON" | grep -E "^(BAKED|NO_SKIN)" | cut -c1-200
  blender -b "$HERE/build/body-$sex.blend" -P "$HERE/export_glb.py" -- "$HERE/build/body-$sex.raw.glb" | grep -E "^EXPORTED"
  node "$HERE/compress.mjs" "$HERE/build/body-$sex.raw.glb" "public/models/body-$sex.glb" | grep -E "^COMPRESSED"
  for layer in "" "--deep"; do
    name="$sex${layer:+-deep}"
    blender -b "$HERE/build/body-$sex.blend" -P "$HERE/render_views.py" -- "$HERE/build/$name.png" --muscles $layer >/dev/null
    python3 "$HERE/legend.py" "$HERE/build/$name.png" "docs/muscle-debug/$name.png"
  done
done
echo "Done."
