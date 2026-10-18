"""Install the CC0 MakeHuman system asset pack into MPFB's user data dir (headless).

    blender -b --factory-startup -P tools/model/install_assets.py -- /path/to/makehuman_system_assets_cc0.zip
"""
import sys
import bpy  # noqa: F401  (Blender must be running)

zip_path = sys.argv[sys.argv.index("--") + 1]
mod = __import__("bl_ext.blender_org.mpfb", fromlist=["services"])
from bl_ext.blender_org.mpfb.services.assetservice import AssetService
from bl_ext.blender_org.mpfb.services.locationservice import LocationService

target = LocationService.get_user_data()
err = AssetService.check_asset_pack_zip(zip_path)
if err:
    raise SystemExit("Bad asset pack: " + err)
err = AssetService.fix_and_extract_asset_pack_zip(zip_path, target)
if err:
    raise SystemExit("Extraction failed: " + err)
AssetService.update_all_asset_lists()
print("INSTALLED_TO", target)
