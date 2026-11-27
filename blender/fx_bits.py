"""Ground effects for the fight (#17): small torn paper flakes, torn strips and puffs of tissue-paper dust kicked up
on landing, after a charge and when a fighter falls. Rendered in Cycles like the kit, packed into one sheet so the
runtime draws every piece from a single texture.

  "C:/Program Files/Blender Foundation/Blender 5.3/blender.exe" -b --python blender/fx_bits.py -- [samples]

Writes assets/fx/bits.png (sheet) and assets/fx/bits.json ({ "frames": { name: { x, y, w, h } } }, px, top-left).
Materials are procedural paper (pc_lib.paper_mat), so the BlenderKit scans are not needed: at 10-40 px on screen the
fibres would not read anyway. Colours follow the arena sand (#d9b98a .. #b48a5a) so the bits belong to the floor.
"""
import bpy, sys, os, json, math, random
import numpy as np
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import sprite_lib as sl  # noqa: E402
pc = sl.pc

argv = sys.argv[sys.argv.index('--') + 1:] if '--' in sys.argv else []
SAMPLES = int(argv[0]) if argv else 64
OUT = os.path.join(sl.GAME, 'assets', 'fx')
TMP = os.path.join(sl.GAME, 'out', 'fx_bits')
PPU = 120.0        # sprites are drawn at ~38 px per unit, so this leaves headroom for the pop-in scale
os.makedirs(OUT, exist_ok=True)
os.makedirs(TMP, exist_ok=True)

sc = sl.setup(samples=SAMPLES, world='#f3e6d6', world_strength=0.7, sun_strength=3.0)
rnd = random.Random(17)

SAND = pc.paper_mat('sand', '#d9b98a', grain=0.5, grit=0.6, mottle=0.25)
KRAFT = pc.paper_mat('kraft', '#b48a5a', grain=0.6, grit=0.7, mottle=0.3)
CREAM = pc.paper_mat('cream', '#efe3cc', grain=0.4, grit=0.5, mottle=0.15)
OCHRE = pc.paper_mat('ochre', '#c9a46a', grain=0.5, grit=0.6, mottle=0.25)
TISSUE = pc.paper_mat('tissue', '#e6d2ae', rough=0.95, grain=0.3, grit=0.3, mottle=0.2, sss=0.3)
TISSUE_LO = pc.paper_mat('tissue_lo', '#cfb38a', rough=0.95, grain=0.3, grit=0.3, mottle=0.2, sss=0.3)


def torn_blob(rx, ry, seed):
    """an irregular flake: a shard of 7-9 corners at random radii, with a torn (jagged) outline"""
    r = random.Random(seed)
    n = r.randint(7, 9)
    pts = []
    for i in range(n):
        a = (i + r.uniform(-0.3, 0.3)) / n * math.tau
        k = r.uniform(0.62, 1.0)
        pts.append((math.cos(a) * rx * k, math.sin(a) * ry * k))
    return sl.torn(pts, amp=0.022, seed=seed, step=0.035)


def strip(length, width, seed):
    r = random.Random(seed)
    top = [(-length / 2 + i * length / 8, width / 2 + r.uniform(-0.03, 0.03)) for i in range(9)]
    bot = [(length / 2 - i * length / 8, -width / 2 + r.uniform(-0.03, 0.03)) for i in range(9)]
    return sl.torn(top + bot, amp=0.02, seed=seed, step=0.035)


def piece(name, build):
    coll = sl.new_coll(name)
    for pts, mat, z in build():
        pc.layer(pts, mat, h=0.02, z=z, name=name, coll=coll, bevel=0.006)
    return coll


PIECES = {
    'flake1': lambda: [(torn_blob(0.26, 0.2, 3), SAND, 0)],
    'flake2': lambda: [(torn_blob(0.2, 0.16, 8), KRAFT, 0)],
    'flake3': lambda: [(torn_blob(0.3, 0.17, 12), CREAM, 0)],
    'flake4': lambda: [(torn_blob(0.18, 0.18, 21), OCHRE, 0)],
    'strip1': lambda: [(strip(0.7, 0.14, 5), SAND, 0)],
    'strip2': lambda: [(strip(0.55, 0.12, 9), KRAFT, 0)],
}


def puff(seed, w, h):
    """dust as the papercraft style does smoke: a cluster of overlapping tissue cut-outs, darker ones at the back"""
    r = random.Random(seed)
    out = []
    n = 7
    for i in range(n):
        t = i / (n - 1)
        x = (t - 0.5) * w * 0.7 + r.uniform(-0.1, 0.1) * w
        y = math.sin(t * math.pi) * h * 0.25 + r.uniform(-0.05, 0.05) * h
        rx = r.uniform(0.22, 0.32) * w
        ry = r.uniform(0.32, 0.45) * h
        back = i % 2 == 0
        # every cut-out on its own height: coplanar overlapping solids render dark where they intersect
        z = (0.0 if back else 0.12) + i * 0.02
        out.append((pc.xf(pc.blob_pts(rx, ry, 0.1, seed * 13 + i, n=40), x, y), TISSUE_LO if back else TISSUE, z))
    return out


for i, (w, h) in enumerate([(1.6, 0.9), (1.3, 0.8), (1.9, 1.0)], 1):
    PIECES[f'puff{i}'] = (lambda s=i, w=w, h=h: puff(40 + s, w, h))

renders = {}
for name, build in PIECES.items():
    coll = piece(name, build)
    path = os.path.join(TMP, name + '.png')
    renders[name] = sl.render_coll(coll, path, pad=0.06, ppu=PPU)
    renders[name]['path'] = path

# ---------------------------------------------------------------- pack into one sheet (rows, 2 px gutter)
GUT = 2
SHEET_W = 512
x = y = row_h = 0
frames = {}
for name in PIECES:
    r = renders[name]
    if x + r['w'] > SHEET_W:
        x, y, row_h = 0, y + row_h + GUT, 0
    frames[name] = {'x': x, 'y': y, 'w': r['w'], 'h': r['h']}
    x += r['w'] + GUT
    row_h = max(row_h, r['h'])
SHEET_H = y + row_h

sheet = np.zeros((SHEET_H, SHEET_W, 4), dtype=np.float32)
for name, f in frames.items():
    im = bpy.data.images.load(renders[name]['path'])
    px = np.array(im.pixels[:], dtype=np.float32).reshape(im.size[1], im.size[0], 4)[::-1]   # Blender rows start at the bottom
    sheet[f['y']:f['y'] + f['h'], f['x']:f['x'] + f['w']] = px
    bpy.data.images.remove(im)

out = bpy.data.images.new('fx_bits', SHEET_W, SHEET_H, alpha=True)
out.pixels[:] = sheet[::-1].ravel()
out.filepath_raw = os.path.join(OUT, 'bits.png')
out.file_format = 'PNG'
out.save()
with open(os.path.join(OUT, 'bits.json'), 'w') as fh:
    json.dump({'frames': frames}, fh, indent=1)
print('FX_BITS', SHEET_W, SHEET_H, ', '.join(frames))
