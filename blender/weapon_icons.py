"""High resolution weapon pictures for the shop boards -> assets/ui/weapons/<id>.png

  python -I tools/blender.py blender/weapon_icons.py -- [samples] [only_prefix,...]

The same builders as the in-game sprites (weapons.py), rendered about three times larger, under a harder light and with
richer colour, so a blade stands out on its card. The spear gets a shorter shaft here: its head can be seen. The puppet's
own sprites (assets/chars/kit) are not touched. Blades lie flat (hilt left); the boards stand them up.
"""
import bpy, sys, os, time
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import numpy as np  # noqa: E402
import sprite_lib as sl  # noqa: E402
import weapons  # noqa: E402

argv = sys.argv[sys.argv.index('--') + 1:] if '--' in sys.argv else []
SAMPLES = int(argv[0]) if argv else 96
ONLY = [p for p in (argv[1].split(',') if len(argv) > 1 else []) if p]
OUT = os.path.join(sl.GAME, 'assets', 'ui', 'weapons')
os.makedirs(OUT, exist_ok=True)
PPU = 260.0           # kit sprites: 90
SATURATION = 1.38
CONTRAST = 1.1
BRIGHTNESS = 1.04
DEPTH = 1.9           # paper layers further apart than in the game: deeper shadows between them
INK_PX = 5            # dark die-cut line around the whole weapon
INK = (0.13, 0.055, 0.03)

sl.setup(samples=SAMPLES, world_strength=0.46, sun_strength=3.7)
weapons.ICON = True

jobs = {}
for fam, table in (('sword', weapons.SWORDS), ('axe', weapons.AXES), ('spear', weapons.SPEARS), ('hammer', weapons.HAMMERS)):
    for t, fn in table.items():     # the families the weaponsmith sells
        jobs[f'{fam}{t}'] = fn


def enrich(path):
    """richer colour, a little more contrast and an ink line around the silhouette (straight-alpha pixels)"""
    im = bpy.data.images.load(path)
    w, h = im.size
    px = np.empty(w * h * 4, dtype=np.float32)
    im.pixels.foreach_get(px)
    rgba = px.reshape(-1, 4)
    rgb = rgba[:, :3]
    lum = (rgb @ np.array([0.2126, 0.7152, 0.0722], dtype=np.float32))[:, None]
    rgb = lum + (rgb - lum) * SATURATION
    rgb = (rgb - 0.55) * CONTRAST + 0.55
    rgba[:, :3] = np.clip(rgb * BRIGHTNESS, 0.0, 1.0)
    # the ink line: the silhouette grown by INK_PX, laid under the picture
    pic = rgba.reshape(h, w, 4)
    alpha = pic[:, :, 3]
    grown = alpha.copy()
    for dy in range(-INK_PX, INK_PX + 1):
        for dx in range(-INK_PX, INK_PX + 1):
            if dx * dx + dy * dy <= INK_PX * INK_PX:   # the render's pad keeps the wrap-around empty
                np.maximum(grown, np.roll(alpha, (dy, dx), (0, 1)), out=grown)
    a = alpha[:, :, None]
    out_a = a + grown[:, :, None] * (1.0 - a)
    ink = np.array(INK, dtype=np.float32)
    pic[:, :, :3] = (pic[:, :, :3] * a + ink * (out_a - a)) / np.maximum(out_a, 1e-6)
    pic[:, :, 3:] = out_a
    im.pixels.foreach_set(px)
    im.filepath_raw = path
    im.file_format = 'PNG'
    im.save()
    bpy.data.images.remove(im)


t0 = time.time()
n = 0
for key, fn in jobs.items():
    if ONLY and not any(key.startswith(p) for p in ONLY):
        continue
    coll = sl.new_coll('job')
    fn(coll)
    for o in coll.objects:
        o.location.z *= DEPTH
    path = os.path.join(OUT, key + '.png')
    info = sl.render_coll(coll, path, pad=0.08, ppu=PPU)
    enrich(path)
    sl.clear_coll(coll)
    bpy.data.collections.remove(coll)
    n += 1
    print('ICON', key, info['w'], info['h'], f'{time.time() - t0:.0f}s', flush=True)
print('ICONS', n, 'rendered', f'{time.time() - t0:.0f}s')
