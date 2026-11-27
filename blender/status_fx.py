"""Status effects on the fighters (#50), paper-style, packed into one sheet like the ground bits (blender/fx_bits.py):

  flame1..3   burning: cut-paper flames, red / orange / yellow layers
  blot1..2    soaked: dark wet stains (the game draws them at part alpha over the body)
  drop        soaked: a water drop that runs off
  star        stunned: a five-point paper star that circles the head
  tape1..2    taped: strips of translucent tape stuck over the body
  rip         torn: a torn flap of paper with a white fibrous edge
  sweat       feared: a pale blue sweat drop flying off the head
  glue        slowed: a sticky glue drip hanging from a hand or a foot

  python -I tools/blender.py blender/status_fx.py -- [samples]

Writes assets/fx/status.png and assets/fx/status.json ({ "frames": { name: { x, y, w, h } } }, px, top-left).
Every piece is drawn around its own centre at 120 px per rig unit, like the ground bits.
"""
import bpy, sys, os, json, math, random
import numpy as np
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import sprite_lib as sl  # noqa: E402
pc = sl.pc

argv = sys.argv[sys.argv.index('--') + 1:] if '--' in sys.argv else []
SAMPLES = int(argv[0]) if argv else 64
OUT = os.path.join(sl.GAME, 'assets', 'fx')
TMP = os.path.join(sl.GAME, 'out', 'status_fx')
PPU = 120.0
os.makedirs(OUT, exist_ok=True)
os.makedirs(TMP, exist_ok=True)

sl.setup(samples=SAMPLES, world='#f3e6d6', world_strength=0.7, sun_strength=3.0)

RED = pc.paper_mat('st_red', '#c8402a', grain=0.4, grit=0.4)
ORANGE = pc.paper_mat('st_orange', '#ec8a2c', grain=0.4, grit=0.4)
YELLOW = pc.paper_mat('st_yellow', '#f6cf55', grain=0.4, grit=0.4)
BLOT = pc.paper_mat('st_blot', '#2c3442', rough=0.6, grain=0.3, grit=0.3, mottle=0.3)
BLOT_D = pc.paper_mat('st_blot_d', '#1f2631', rough=0.6, grain=0.3, grit=0.3)
WATER = pc.paper_mat('st_water', '#6aa6d6', rough=0.3, grain=0.2, grit=0.2, sss=0.3)
WATER_HI = pc.paper_mat('st_water_hi', '#d9ecf8', rough=0.3, grain=0.2, grit=0.2)
STAR = pc.paper_mat('st_star', '#f6d34a', grain=0.4, grit=0.4)
STAR_D = pc.paper_mat('st_star_d', '#e0a92a', grain=0.4, grit=0.4)
TAPE = pc.paper_mat('st_tape', '#e9dca0', rough=0.35, grain=0.2, grit=0.2, sss=0.4)
TAPE_D = pc.paper_mat('st_tape_d', '#cdbd7a', rough=0.35, grain=0.2, grit=0.2, sss=0.4)
TISSUE = pc.paper_mat('st_tissue', '#f7f1e3', rough=0.95, grain=0.5, grit=0.5, sss=0.3)
SHADE = pc.paper_mat('st_shade', '#5a3a30', rough=0.9)
SWEAT = pc.paper_mat('st_sweat', '#a9d4f0', rough=0.3, grain=0.2, grit=0.2, sss=0.3)
GLUE = pc.paper_mat('st_glue', '#f3efe2', rough=0.25, grain=0.1, grit=0.1, sss=0.4)


def L(coll, pts, mat, z, h=0.03):
    return pc.layer(pts, mat, h=h, z=z, coll=coll, name='p', bevel=0.006)


def flame(seed, w, h):
    def build(c):
        r = random.Random(seed)
        for k, (mat, s) in enumerate(((RED, 1.0), (ORANGE, 0.72), (YELLOW, 0.44))):
            # each layer a little off-centre, so the three papers do not look stamped
            L(c, pc.xf(pc.teardrop_pts(w * s, h * s, 28), r.uniform(-0.03, 0.03) * k, -h * (1 - s) * 0.35), mat, k * 0.04)
        # a lick of flame breaking off at the side
        L(c, pc.xf(pc.teardrop_pts(w * 0.3, h * 0.35), w * 0.32, h * 0.22, -0.4), ORANGE, 0.02)
    return build


def blot(seed, rx, ry):
    def build(c):
        L(c, pc.blob_pts(rx, ry, 0.18, seed, n=60), BLOT, 0.0, 0.01)
        L(c, pc.xf(pc.blob_pts(rx * 0.55, ry * 0.5, 0.2, seed + 1, n=40), rx * 0.1, -ry * 0.1), BLOT_D, 0.012, 0.01)
    return build


def drop(c):
    L(c, pc.teardrop_pts(0.16, 0.26), WATER, 0.0)
    L(c, pc.xf(pc.ellipse_pts(0.03, 0.045, 12), -0.03, -0.02), WATER_HI, 0.04, 0.01)


def star(c):
    pts = []
    for i in range(10):
        a = math.pi / 2 + i * math.pi / 5
        r = 0.22 if i % 2 == 0 else 0.095
        pts.append((r * math.cos(a), r * math.sin(a)))
    L(c, pts, STAR_D, 0.0)
    L(c, pc.xf(pts, 0.0, 0.0, 0.0, 0.7), STAR, 0.04)


def tape(seed, length):
    def build(c):
        r = random.Random(seed)
        top = [(-length / 2 + i * length / 6, 0.09 + r.uniform(-0.006, 0.006)) for i in range(7)]
        bot = [(length / 2 - i * length / 6, -0.09 + r.uniform(-0.006, 0.006)) for i in range(7)]
        # the ends are torn off the roll: zig-zag
        L(c, sl.torn(top + bot, amp=0.012, seed=seed, step=0.03), TAPE, 0.0, 0.01)
        L(c, pc.rrect(length * 0.8, 0.03, 0.01), TAPE_D, 0.012, 0.005)
    return build


def rip(c):
    # a dark gap with a white fibrous edge and a flap of paper folded back over it
    gap = [(-0.32, 0.06), (-0.1, 0.1), (0.12, 0.04), (0.34, 0.08), (0.3, -0.04), (0.08, -0.08), (-0.14, -0.03), (-0.34, -0.06)]
    L(c, sl.torn(pc.xf(gap, 0, 0, 0, 1.15), 0.02, 3, 0.03), TISSUE, 0.0, 0.01)
    L(c, sl.torn(gap, 0.015, 4, 0.03), SHADE, 0.012, 0.01)
    L(c, sl.torn([(0.04, 0.0), (0.36, 0.08), (0.3, 0.3), (0.06, 0.24)], 0.015, 5, 0.03), TISSUE, 0.03, 0.015)


def sweat(c):
    L(c, pc.teardrop_pts(0.12, 0.2), SWEAT, 0.0)
    L(c, pc.xf(pc.ellipse_pts(0.022, 0.035, 12), -0.02, -0.015), WATER_HI, 0.04, 0.01)


def glue(c):
    pts = [(-0.12, 0.2), (0.12, 0.2), (0.08, 0.02), (0.05, -0.22), (0.09, -0.3), (0.0, -0.38), (-0.09, -0.3), (-0.05, -0.22), (-0.08, 0.02)]
    L(c, pts, GLUE, 0.0, 0.04)


PIECES = {
    'flame1': flame(1, 0.42, 0.75), 'flame2': flame(2, 0.34, 0.6), 'flame3': flame(3, 0.5, 0.9),
    'blot1': blot(11, 0.45, 0.32), 'blot2': blot(12, 0.34, 0.4),
    'drop': drop, 'star': star,
    'tape1': tape(21, 1.1), 'tape2': tape(22, 0.85),
    'rip': rip, 'sweat': sweat, 'glue': glue,
}

renders = {}
for name, build in PIECES.items():
    coll = sl.new_coll(name)
    build(coll)
    path = os.path.join(TMP, name + '.png')
    renders[name] = sl.render_coll(coll, path, pad=0.05, ppu=PPU)
    renders[name]['path'] = path
    for c in list(bpy.data.collections):
        c.hide_render = True

# ---------------------------------------------------------------- pack into one sheet (rows, 2 px gutter)
GUT, SHEET_W = 2, 512
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
    px = np.array(im.pixels[:], dtype=np.float32).reshape(im.size[1], im.size[0], 4)[::-1]
    sheet[f['y']:f['y'] + f['h'], f['x']:f['x'] + f['w']] = px
    bpy.data.images.remove(im)

out = bpy.data.images.new('status_fx', SHEET_W, SHEET_H, alpha=True)
out.pixels[:] = sheet[::-1].ravel()
out.filepath_raw = os.path.join(OUT, 'status.png')
out.file_format = 'PNG'
out.save()
with open(os.path.join(OUT, 'status.json'), 'w', newline='\n') as fh:
    json.dump({'frames': frames}, fh, indent=1)
print('STATUS_FX', SHEET_W, SHEET_H, ', '.join(frames))
