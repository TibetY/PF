"""Compose the muscle debug renders + a colour legend into one image (plain Python + Pillow).

    python3 tools/model/legend.py <prefix> <out.png>   (prefix as passed to render_views.py)
"""
import json
import sys

from PIL import Image, ImageDraw, ImageFont

prefix, out = sys.argv[1], sys.argv[2]
views = [Image.open(prefix.replace(".png", f"-{v}.png")) for v in ("front", "side", "back", "threequarter")]
legend = json.load(open(prefix.replace(".png", "-legend.json")))
w = sum(v.width for v in views) + 300
h = max(v.height for v in views)
img = Image.new("RGB", (w, h), (245, 245, 245))
x = 0
for v in views:
    img.paste(v, (x, 0))
    x += v.width
d = ImageDraw.Draw(img)
try:
    font = ImageFont.truetype("DejaVuSans.ttf", 17)
except OSError:
    font = ImageFont.load_default()
y = 20
d.text((x + 16, y), "left side  |  right side (darker)", fill=(40, 40, 40), font=font)
y += 30
for name, hexcol in legend.items():
    c = tuple(int(hexcol[i:i + 2], 16) for i in (0, 2, 4))
    dark = tuple(int(v * 0.62 ** (1 / 2.2)) for v in c)
    d.rectangle([x + 16, y, x + 40, y + 20], fill=c)
    d.rectangle([x + 44, y, x + 68, y + 20], fill=dark)
    d.text((x + 78, y + 1), name, fill=(30, 30, 30), font=font)
    y += 30
img.save(out)
print("LEGEND", out)
