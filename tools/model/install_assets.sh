#!/usr/bin/env bash
# Fetch everything the body build needs (idempotent). Requires Blender 4.2+ on PATH.
set -euo pipefail
HERE="$(cd "$(dirname "$0")" && pwd)"
CACHE="$HERE/cache"
mkdir -p "$CACHE/assets"

# 1. MPFB 2 extension (GPL-3.0 tool; its output meshes are CC0)
installed="$(blender --command extension list 2>/dev/null || true)"
if ! grep -q "mpfb \[installed\]" <<<"$installed"; then
  blender --online-mode --command extension install --sync --enable mpfb
fi

# 2. CC0 MakeHuman asset packs: skins/eyes/hair/brows (system assets) + the sports top (underwear01)
for pack in makehuman_system_assets underwear01; do
  zip="$CACHE/assets/${pack}_cc0.zip"
  if [ ! -f "$zip" ]; then
    curl -fL -o "$zip" "https://files.makehumancommunity.org/asset_packs/$pack/${pack}_cc0.zip"
  fi
  marker="$CACHE/assets/$pack.installed"
  if [ ! -f "$marker" ]; then
    blender -b -P "$HERE/install_assets.py" -- "$zip" | grep INSTALLED_TO
    touch "$marker"
  fi
done

# 3. Z-Anatomy (CC BY-SA 4.0) for the muscle map
if [ ! -f "$CACHE/zanatomy/Z-Anatomy/Startup.blend" ]; then
  rm -rf "$CACHE/zanatomy-repo"
  git clone --depth 1 --filter=blob:none --no-checkout https://github.com/Z-Anatomy/Models-of-human-anatomy.git "$CACHE/zanatomy-repo"
  git -C "$CACHE/zanatomy-repo" checkout HEAD -- Z-Anatomy.zip License.txt
  mkdir -p "$CACHE/zanatomy"
  (cd "$CACHE/zanatomy" && unzip -q -o "$CACHE/zanatomy-repo/Z-Anatomy.zip")
fi
echo "Assets ready."
