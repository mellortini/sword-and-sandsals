"""The living crowd (#52): paper pieces the game moves over the arena's painted spectators and throws onto the sand.

  arm            a raised sleeve, white paper: the game tints it to the spectator's clothes (assets/bg/arena_crowd.json)
  hand0..2       a hand in three skin tones, drawn at the top of the sleeve
  flower0..2     a paper flower thrown onto the sand (red, pink, yellow)
  coin, coin_side  a gold coin, face on and turning edge-on (the game swaps them to spin it)

  python -I tools/blender.py blender/crowd_fx.py -- [samples]

Writes assets/fx/crowd.png and assets/fx/crowd.json ({ "frames": { name: { x, y, w, h, px, py } } }; px / py = the
pivot in the frame: the shoulder for the sleeve, the wrist for the hand, the middle of the rest). Sizes follow the
spectators in blender/arena.py (sleeve 0.22 x 1.1 units), rendered at 120 px per unit like the other effect sheets.
"""
import bpy, sys, os, json, math
import numpy as np
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import sprite_lib as sl  # noqa: E402
pc = sl.pc

argv = sys.argv[sys.argv.index('--') + 1:] if '--' in sys.argv else []
SAMPLES = int(argv[0]) if argv else 64
OUT = os.path.join(sl.GAME, 'assets', 'fx')
TMP = os.path.join(sl.GAME, 'out', 'crowd_fx')
PPU = 120.0
os.makedirs(OUT, exist_ok=True)
os.makedirs(TMP, exist_ok=True)

sl.setup(samples=SAMPLES, world='#f3e6d6', world_strength=0.7, sun_strength=3.0)

SLEEVE = pc.paper_mat('cr_sleeve', '#f4f1ea', grain=0.4, grit=0.4)
SLEEVE_D = pc.paper_mat('cr_sleeve_d', '#d8d3c8', grain=0.4, grit=0.4)
SKINS = ['#f2c29b', '#c98b66', '#9a6646']
STEM = pc.paper_mat('cr_stem', '#4f7a34', grain=0.4, grit=0.4)
GOLD = sl.foil('cr_gold', '#e2b64a', metal=0.65, rough=0.3, emit=0.3)
GOLD_D = sl.foil('cr_gold_d', '#b88a2e', metal=0.65, rough=0.32, emit=0.24)


def L(coll, pts, mat, z, h=0.04):
    return pc.layer(pts, mat, h=h, z=z, coll=coll, name='p', bevel=0.006)


def arm(c):
    """origin = shoulder; the sleeve rises along +y like the arena's raised arms"""
    L(c, pc.xf(pc.rrect(0.24, 1.1, 0.1), 0.0, 0.55), SLEEVE, 0.0)
    L(c, pc.xf(pc.rrect(0.26, 0.12, 0.05), 0.0, 1.02), SLEEVE_D, 0.04, 0.02)   # the cuff


def hand(skin):
    def build(c):
        m = pc.paper_mat('cr_skin_' + skin, skin, grain=0.3, grit=0.3)
        L(c, pc.xf(pc.ellipse_pts(0.13, 0.16, 24), 0.0, 0.12), m, 0.0)          # palm, origin = wrist
        for i, a in enumerate((-0.5, -0.17, 0.15, 0.45)):                     # fingers spread in a wave
            L(c, pc.xf(pc.rrect(0.06, 0.16, 0.03), 0.07 * math.sin(a) * 2.2, 0.27 + 0.03 * math.cos(a), -a), m, 0.02, 0.03)
        L(c, pc.xf(pc.rrect(0.06, 0.13, 0.03), -0.14, 0.1, 0.9), m, 0.02, 0.03)  # thumb
    return build


def flower(col, col_d):
    def build(c):
        petal = pc.paper_mat('cr_petal_' + col, col, grain=0.3, grit=0.3)
        heart = pc.paper_mat('cr_heart_' + col_d, col_d, grain=0.3, grit=0.3)
        L(c, pc.xf(pc.rrect(0.04, 0.32, 0.02), 0.0, -0.22, 0.2), STEM, 0.0, 0.02)
        L(c, pc.xf(pc.teardrop_pts(0.12, 0.2), 0.08, -0.22, -1.0), STEM, 0.0, 0.02)
        for i in range(5):
            a = i * math.tau / 5
            L(c, pc.xf(pc.ellipse_pts(0.07, 0.11, 20), 0.1 * math.sin(a), 0.1 * math.cos(a), -a), petal, 0.02 + 0.005 * i, 0.02)
        L(c, pc.ellipse_pts(0.055, 0.055, 16), heart, 0.06, 0.02)
    return build


def coin(c):
    L(c, pc.ellipse_pts(0.14, 0.14, 40), GOLD_D, 0.0, 0.03)
    L(c, pc.ellipse_pts(0.115, 0.115, 40), GOLD, 0.03, 0.02)
    L(c, pc.xf(pc.rrect(0.05, 0.1, 0.02), 0.0, 0.0), GOLD_D, 0.05, 0.01)       # a stamped mark


def coin_side(c):
    L(c, pc.rrect(0.07, 0.28, 0.03), GOLD_D, 0.0, 0.03)
    L(c, pc.rrect(0.03, 0.24, 0.015), GOLD, 0.03, 0.01)


PIECES = {
    'arm': (arm, (0.0, 0.0)),
    **{f'hand{i}': (hand(s), (0.0, 0.0)) for i, s in enumerate(SKINS)},
    'flower0': (flower('#c8302a', '#f2c14e'), None), 'flower1': (flower('#e86a9a', '#f6e27a'), None),
    'flower2': (flower('#f2c14e', '#c8642e'), None),
    'coin': (coin, None), 'coin_side': (coin_side, None),
}

renders = {}
for name, (build, origin) in PIECES.items():
    coll = sl.new_coll(name)
    build(coll)
    path = os.path.join(TMP, name + '.png')
    if origin is None:   # pivot in the middle of the piece
        x0, y0, x1, y1 = sl.bbox_xy(coll.all_objects)
        origin = ((x0 + x1) / 2, (y0 + y1) / 2)
    r = sl.render_coll(coll, path, pad=0.04, ppu=PPU, origin=origin)
    r['path'] = path
    renders[name] = r

# ---------------------------------------------------------------- pack into one sheet (rows, 2 px gutter)
GUT, SHEET_W = 2, 256
x = y = row_h = 0
frames = {}
for name in PIECES:
    r = renders[name]
    if x + r['w'] > SHEET_W:
        x, y, row_h = 0, y + row_h + GUT, 0
    frames[name] = {'x': x, 'y': y, 'w': r['w'], 'h': r['h'], 'px': r['pivot'][0], 'py': r['pivot'][1]}
    x += r['w'] + GUT
    row_h = max(row_h, r['h'])
SHEET_H = y + row_h

sheet = np.zeros((SHEET_H, SHEET_W, 4), dtype=np.float32)
for name, f in frames.items():
    im = bpy.data.images.load(renders[name]['path'])
    px = np.array(im.pixels[:], dtype=np.float32).reshape(im.size[1], im.size[0], 4)[::-1]
    sheet[f['y']:f['y'] + f['h'], f['x']:f['x'] + f['w']] = px
    bpy.data.images.remove(im)

out = bpy.data.images.new('crowd_fx', SHEET_W, SHEET_H, alpha=True)
out.pixels[:] = sheet[::-1].ravel()
out.filepath_raw = os.path.join(OUT, 'crowd.png')
out.file_format = 'PNG'
out.save()
with open(os.path.join(OUT, 'crowd.json'), 'w', newline='\n') as fh:
    json.dump({'frames': frames}, fh, indent=1)
print('CROWD_FX', SHEET_W, SHEET_H, ', '.join(frames))
