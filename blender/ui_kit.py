"""Paper UI kit (#16): HP / EN flasks, a wooden name plate, 11 action icons, a yellow note and a scroll panel,
rendered in Cycles as cut paper and packed into one sheet for the HUD and menus.

  python -I tools/blender.py blender/ui_kit.py -- [samples]

Writes assets/ui/ui.png and assets/ui/ui.json:
  { "frames": { key: { x, y, w, h } }, "fill": { key: { top, bottom } } }   (px, top-left of the sheet)
Flasks come as four sprites with the SAME frame, drawn in this order: flask_back, flask_liquid_hp | flask_liquid_en,
flask_front. The liquid is a full flask: crop it from the top in the game; `fill` gives the px rows (inside its frame)
where the liquid is full (top) and empty (bottom). The scroll is 3-sliced: scroll_top, scroll_body (stretch it
vertically), scroll_bottom - all the same width.
Materials are procedural paper (pc_lib), so the BlenderKit scans are not needed.
"""
import bpy, sys, os, json, math
import numpy as np
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import sprite_lib as sl  # noqa: E402
pc = sl.pc

argv = sys.argv[sys.argv.index('--') + 1:] if '--' in sys.argv else []
SAMPLES = int(argv[0]) if argv else 64
OUT = os.path.join(sl.GAME, 'assets', 'ui')
TMP = os.path.join(sl.GAME, 'out', 'ui_kit')
os.makedirs(OUT, exist_ok=True)
os.makedirs(TMP, exist_ok=True)

sl.setup(samples=SAMPLES, world='#f3e6d6', world_strength=0.7, sun_strength=3.0)

# ---------------------------------------------------------------- materials
INK = pc.paper_mat('ink', '#3b2a22', grain=0.4, grit=0.4, mottle=0.1)
CREAM = pc.paper_mat('cream', '#efe2c4', grain=0.5, grit=0.6, mottle=0.2)
KRAFT = pc.paper_mat('kraft', '#8a5a34', grain=0.6, grit=0.7, mottle=0.25)
KRAFT_DK = pc.paper_mat('kraft_dk', '#5e3b22', grain=0.6, grit=0.7, mottle=0.25)
RED = pc.paper_mat('red', '#b8302a', grain=0.4, grit=0.5, mottle=0.2)
GOLD = pc.paper_mat('gold', '#c9a24e', grain=0.4, grit=0.5, mottle=0.2)
STEEL = pc.paper_mat('steel', '#c9ccd2', grain=0.3, grit=0.4, mottle=0.15)
YELLOW = pc.paper_mat('yellow', '#f2d65e', grain=0.4, grit=0.5, mottle=0.2)
YELLOW_DK = pc.paper_mat('yellow_dk', '#d9b843', grain=0.4, grit=0.5, mottle=0.2)
PARCH = pc.paper_mat('parch', '#ead7ad', grain=0.6, grit=0.7, mottle=0.35)
PARCH_DK = pc.paper_mat('parch_dk', '#c9ab76', grain=0.6, grit=0.7, mottle=0.35)
WOOD = pc.pattern_mat('wood', 'pinstripe', '#9a6a3e', '#7d5230', freq=2.6, ratio=0.9, wobble=0.25)
WOOD_DK = pc.paper_mat('wood_dk', '#5a3a22', grain=0.6, grit=0.7, mottle=0.3)
CORK = pc.paper_mat('cork', '#a87146', grain=0.8, grit=0.9, mottle=0.3)
HP = pc.paper_mat('hp', '#cf493d', grain=0.3, grit=0.3, mottle=0.25, sss=0.3)
HP_HI = pc.paper_mat('hp_hi', '#ff987a', grain=0.3, grit=0.3, mottle=0.2, sss=0.3)
EN = pc.paper_mat('en', '#377bb1', grain=0.3, grit=0.3, mottle=0.25, sss=0.3)
EN_HI = pc.paper_mat('en_hi', '#9adcff', grain=0.3, grit=0.3, mottle=0.2, sss=0.3)
GLASS_BACK = pc.paper_mat('glass_back', '#51424a', grain=0.3, grit=0.3, mottle=0.2)
GLASS = pc.paper_mat('glass', '#e6eef2', rough=0.35, grain=0.2, grit=0.2, mottle=0.1)


def translucent(mat, alpha):
    """tracing-paper glass: the principled alpha shows the liquid through it"""
    for n in mat.node_tree.nodes:
        if n.type == 'BSDF_PRINCIPLED':
            n.inputs['Alpha'].default_value = alpha
    return mat


GLASS_RIM = pc.paper_mat('glass_rim', '#dfe9ee', rough=0.35, grain=0.2, grit=0.2, mottle=0.1)
translucent(GLASS, 0.12)
translucent(GLASS_RIM, 0.7)

# ---------------------------------------------------------------- shape helpers


def lay(coll, pts, mat, z, h=0.04, holes=(), bevel=0.01):
    return pc.layer(pts, mat, h=h, z=z, holes=holes, name=coll.name, coll=coll, bevel=bevel)


def frame_marks(coll, x0, y0, x1, y1):
    """two tiny hidden triangles: render_coll fits its camera to them, so related sprites share one frame"""
    for x, y in ((x0, y0), (x1, y1)):
        ob = lay(coll, [(x, y), (x + 0.01, y), (x, y + 0.01)], INK, 0, h=0.01, bevel=0)
        ob.hide_render = True


def rect(cx, cy, w, h, rot=0.0):
    return pc.xf([(-w / 2, -h / 2), (w / 2, -h / 2), (w / 2, h / 2), (-w / 2, h / 2)], cx, cy, rot)


def arrow(x0, y0, x1, y1, w=0.16, head=0.36):
    """flat arrow from (x0, y0) to the point (x1, y1)"""
    a = math.atan2(y1 - y0, x1 - x0)
    L = math.hypot(x1 - x0, y1 - y0)
    shaft = L - head * 0.8
    pts = [(0, -w / 2), (shaft, -w / 2), (shaft, -head / 1.6), (L, 0), (shaft, head / 1.6), (shaft, w / 2), (0, w / 2)]
    return pc.xf(pts, x0, y0, a)


def sword_parts(cx, cy, length, rot):
    """blade, guard and grip of a gladius, point along +x of `rot`"""
    blade = [(0, -0.1), (length * 0.78, -0.1), (length, 0), (length * 0.78, 0.1), (0, 0.1)]
    guard = rect(0, 0, 0.1, 0.42)
    grip = rect(-0.22, 0, 0.36, 0.11)
    pommel = pc.xf(pc.ellipse_pts(0.09, 0.09, 16), -0.44, 0)
    off = -length * 0.35
    f = lambda p: pc.xf(pc.xf(p, off, 0), cx, cy, rot)  # noqa: E731
    return f(blade), f(guard), f(grip), f(pommel)


def star_pts(r0, r1, n, rot=0.0):
    return [((r1 if i % 2 == 0 else r0) * math.cos(rot + i * math.pi / n), (r1 if i % 2 == 0 else r0) * math.sin(rot + i * math.pi / n)) for i in range(n * 2)]


def foot(cx, cy, s=1.0, rot=0.0):
    sole = pc.xf(pc.blob_pts(0.17 * s, 0.3 * s, 0.05, 4, n=32), cx, cy, rot)
    toes = [pc.xf(pc.ellipse_pts(0.055 * s, 0.06 * s, 12), cx + dx * s, cy + 0.36 * s + dy * s) for dx, dy in ((-0.12, 0.0), (-0.04, 0.05), (0.04, 0.06), (0.12, 0.03))]
    return [sole] + toes


SPRITES = {}   # key -> (collection, ppu)

# ---------------------------------------------------------------- action icons: round paper badge + ink pictogram
ICON_PPU = 56.0


def badge(key, build):
    c = sl.new_coll(key)
    lay(c, pc.ellipse_pts(1.0, 1.0, 72), KRAFT_DK, 0.0, h=0.05)
    lay(c, sl.torn(pc.ellipse_pts(0.93, 0.93, 48), amp=0.015, seed=len(key), step=0.06), KRAFT, 0.06, h=0.04)
    lay(c, sl.torn(pc.ellipse_pts(0.8, 0.8, 48), amp=0.012, seed=len(key) + 3, step=0.06), CREAM, 0.12, h=0.04)
    # each pictogram piece on its own height: overlapping coplanar pieces would hide each other
    for i, (pts, mat) in enumerate(build()):
        lay(c, pts, mat, 0.2 + i * 0.05, h=0.04)
    SPRITES['icon_' + key] = (c, ICON_PPU)


badge('step_forward', lambda: [(p, INK) for p in foot(-0.28, -0.3, 0.9, 0)] + [(arrow(-0.05, 0.1, 0.62, 0.1), RED)])
badge('step_back', lambda: [(p, INK) for p in foot(0.28, -0.3, 0.9, 0)] + [(arrow(0.05, 0.1, -0.62, 0.1), RED)])
badge('jump', lambda: [
    (rect(0, -0.48, 1.2, 0.08), INK),
    (sl.arc_pts(0, -0.45, 0.42, 0.56, 170, 25, 24), INK),
    (arrow(0.36, 0.0, 0.5, -0.38, 0.12, 0.3), RED),
])
badge('charge', lambda: [
    (arrow(-0.55, 0.0, 0.62, 0.0, 0.22, 0.46), RED),
    (rect(-0.42, 0.32, 0.4, 0.07), INK), (rect(-0.3, -0.32, 0.5, 0.07), INK), (rect(-0.56, 0.16, 0.22, 0.06), INK),
])
badge('quick', lambda: [(p, m) for p, m in zip(sword_parts(0.05, 0.0, 1.0, math.radians(35)), (STEEL, GOLD, INK, GOLD))]
      + [(rect(-0.1, -0.42, 0.5, 0.06, math.radians(35)), INK), (rect(-0.3, -0.25, 0.32, 0.05, math.radians(35)), INK)])
badge('normal', lambda: [(p, m) for p, m in zip(sword_parts(0.05, 0.0, 1.25, math.radians(45)), (STEEL, GOLD, INK, GOLD))])
badge('power', lambda: [(star_pts(0.22, 0.42, 7), RED), (star_pts(0.12, 0.24, 7, 0.3), GOLD)]
      + [(p, m) for p, m in zip(sword_parts(-0.05, -0.05, 1.3, math.radians(-50)), (STEEL, GOLD, INK, GOLD))])
badge('block', lambda: [
    ([(-0.48, 0.5), (0.48, 0.5), (0.48, -0.05), (0, -0.6), (-0.48, -0.05)], INK),
    ([(-0.38, 0.4), (0.38, 0.4), (0.38, -0.02), (0, -0.48), (-0.38, -0.02)], STEEL),
    (rect(0, -0.02, 0.1, 0.8), RED), (rect(0, 0.12, 0.6, 0.1), RED),
])


def moon():
    out = []
    pts = []
    for i in range(33):     # crescent: outer arc and an inner arc offset to the right
        a = math.radians(70 + i * 220 / 32)
        pts.append((0.5 * math.cos(a), 0.5 * math.sin(a)))
    for i in range(33):
        a = math.radians(290 - i * 220 / 32)
        pts.append((0.18 + 0.4 * math.cos(a), 0.06 + 0.4 * math.sin(a)))
    out.append((pc.xf(pts, -0.08, 0), GOLD))
    for x, y, r in ((0.35, 0.4, 0.13), (0.5, 0.05, 0.08), (0.25, -0.45, 0.07)):
        out.append((pc.xf(star_pts(r * 0.4, r, 4), x, y), INK))
    return out


badge('rest', moon)
badge('taunt', lambda: [
    (pc.xf(pc.blob_pts(0.58, 0.44, 0.03, 2, n=48), 0, 0.12), INK),
    ([(-0.22, -0.22), (-0.42, -0.6), (0.02, -0.28)], INK),
    (pc.xf(pc.blob_pts(0.5, 0.36, 0.03, 2, n=48), 0, 0.12), CREAM),
    (rect(0, 0.22, 0.12, 0.38), RED), (pc.xf(pc.ellipse_pts(0.075, 0.075, 16), 0, -0.08), RED),
])


def mini_flask():
    body = pc.xf(pc.ellipse_pts(0.42, 0.42, 40), 0, -0.18)
    neck = rect(0, 0.36, 0.26, 0.42)
    return [(body, INK), (neck, INK), (pc.xf(pc.ellipse_pts(0.33, 0.33, 40), 0, -0.18), CREAM),
            (pc.xf(sl.clip_y(pc.ellipse_pts(0.33, 0.33, 40), -0.33, 0.02), 0, -0.18), RED),
            (rect(0, 0.6, 0.3, 0.18), CORK)]


badge('item', mini_flask)


def badge_net():
    """the trident's net (#258): a flung rope mesh - big diamond gaps, thin brown ropes, lead weights on the hem"""
    c = sl.new_coll('net')
    lay(c, pc.ellipse_pts(1.0, 1.0, 72), KRAFT_DK, 0.0, h=0.05)
    lay(c, sl.torn(pc.ellipse_pts(0.93, 0.93, 48), amp=0.015, seed=3, step=0.06), KRAFT, 0.06, h=0.04)
    lay(c, sl.torn(pc.ellipse_pts(0.8, 0.8, 48), amp=0.012, seed=6, step=0.06), CREAM, 0.12, h=0.04)
    outline = pc.xf(pc.blob_pts(0.6, 0.52, 0.08, 5, n=48), -0.04, -0.06, math.radians(-20))
    holes = []
    step, r = 0.2, 0.086
    for i in range(-5, 6):
        for j in range(-6, 7):
            cx, cy = i * step + (j % 2) * step / 2, j * step / 2
            if math.hypot((cx + 0.04) / 0.5, (cy + 0.06) / 0.42) < 1.0:
                holes.append(list(reversed([(cx + r, cy), (cx, cy + r), (cx - r, cy), (cx, cy - r)])))
    lay(c, outline, WOOD_DK, 0.2, h=0.04, holes=holes)
    for i, d in enumerate((195, 235, 275, 315, 150)):
        a = math.radians(d)
        lay(c, pc.xf(pc.ellipse_pts(0.075, 0.075, 16), -0.04 + 0.6 * math.cos(a), -0.06 + 0.5 * math.sin(a)), INK, 0.3 + i * 0.05, h=0.04)
    SPRITES['icon_net'] = (c, ICON_PPU)


badge_net()

# ---------------------------------------------------------------- flasks (four sprites with one frame)
FLASK_PPU = 64.0
FX0, FY0, FX1, FY1 = -1.05, -1.25, 1.05, 1.75     # shared frame
BODY_R = 0.95
INNER_R = 0.82
LIQ_TOP = 0.5            # world y where a full flask's liquid ends (shoulder of the body)
LIQ_BOT = -INNER_R       # bottom of the inside


def flask_body(r):
    """round body + neck as one outline (circle with the neck rising from its top)"""
    pts = []
    n = 72
    nw = 0.3 * r / BODY_R
    a0 = math.asin(nw / r)
    for i in range(n + 1):
        a = math.pi / 2 + a0 + i * (2 * math.pi - 2 * a0) / n
        pts.append((r * math.cos(a), r * math.sin(a)))
    top = 1.35 - (BODY_R - r) * 0.5
    pts += [(nw, r * math.cos(a0) + 0.02), (nw, top), (-nw, top)]
    return pts


c = sl.new_coll('flask_back')
frame_marks(c, FX0, FY0, FX1, FY1)
lay(c, flask_body(INNER_R), GLASS_BACK, 0.0, h=0.03)
SPRITES['flask_back'] = (c, FLASK_PPU)

for key, mat, hi in (('hp', HP, HP_HI), ('en', EN, EN_HI)):
    c = sl.new_coll('flask_liquid_' + key)
    frame_marks(c, FX0, FY0, FX1, FY1)
    inner = pc.ellipse_pts(INNER_R, INNER_R, 72)
    lay(c, sl.clip_y(inner, LIQ_BOT - 0.01, LIQ_TOP), mat, 0.05, h=0.03)
    # a paler wave cut at the surface and a glint low on the body
    lay(c, sl.clip_y(pc.ellipse_pts(INNER_R * 0.97, INNER_R * 0.97, 72), LIQ_TOP - 0.09, LIQ_TOP), hi, 0.09, h=0.02)
    lay(c, pc.xf(pc.blob_pts(0.12, 0.3, 0.05, 6, n=24), 0.42, -0.2, -0.3), hi, 0.09, h=0.02)
    SPRITES['flask_liquid_' + key] = (c, FLASK_PPU)

c = sl.new_coll('flask_front')
frame_marks(c, FX0, FY0, FX1, FY1)
lay(c, flask_body(BODY_R), GLASS_RIM, 0.15, h=0.02, holes=[list(reversed(flask_body(INNER_R + 0.04)))])
lay(c, flask_body(INNER_R + 0.04), GLASS, 0.17, h=0.01)
lay(c, pc.xf(pc.blob_pts(0.08, 0.42, 0.04, 9, n=24), -0.52, 0.15, 0.35), CREAM, 0.22, h=0.02)   # highlight strip
lay(c, rect(0, 1.38, 0.78, 0.16), KRAFT_DK, 0.2, h=0.04)                                      # lip
lay(c, rect(0, 1.53, 0.5, 0.36), CORK, 0.24, h=0.05)                                           # cork
lay(c, rect(0, 1.1, 0.68, 0.08, 0.06), KRAFT, 0.26, h=0.02)                                    # twine
SPRITES['flask_front'] = (c, FLASK_PPU)

# ---------------------------------------------------------------- wooden name plate
c = sl.new_coll('plate')
lay(c, pc.rrect(6.2, 1.5, 0.14), WOOD_DK, 0.0, h=0.06)
lay(c, rect(0, 0.33, 6.0, 0.62), WOOD, 0.08, h=0.05)
lay(c, rect(0, -0.33, 6.0, 0.62), WOOD, 0.08, h=0.05)
lay(c, sl.torn(rect(0, 0, 5.4, 0.9), amp=0.02, seed=5, step=0.1), PARCH, 0.16, h=0.03)     # paper label for the name
for x in (-2.75, 2.75):
    lay(c, pc.xf(pc.ellipse_pts(0.12, 0.12, 20), x, 0), INK, 0.2, h=0.03)
    lay(c, pc.xf(pc.ellipse_pts(0.07, 0.07, 16), x - 0.02, 0.02), STEEL, 0.24, h=0.02)
SPRITES['plate'] = (c, 64.0)

# ---------------------------------------------------------------- yellow note (tooltip)
c = sl.new_coll('note')
note = sl.torn([(-2.2, -1.3), (2.2, -1.3), (2.2, 1.15), (-2.2, 1.15)], amp=0.025, seed=11, step=0.12)
lay(c, pc.xf(note, 0.05, -0.06), YELLOW_DK, 0.0, h=0.03)
lay(c, note, YELLOW, 0.05, h=0.03)
lay(c, rect(0, 1.18, 1.2, 0.34, 0.04), pc.paper_mat('tape', '#efe6cf', grain=0.2, grit=0.3, mottle=0.1), 0.1, h=0.02)
SPRITES['note'] = (c, 64.0)

# ---------------------------------------------------------------- scroll panel, 3-sliced (same width for all three)
SW = 6.4
SX0, SX1 = -SW / 2 - 0.2, SW / 2 + 0.2      # the rod ends reach SW/2 + 0.16


def rod(coll, y, flip):
    lay(coll, pc.rrect(SW + 0.1, 0.62, 0.3), PARCH_DK, 0.1, h=0.06)
    lay(coll, pc.xf(pc.rrect(SW - 0.1, 0.3, 0.15), 0, 0.08 * flip), PARCH, 0.18, h=0.03)
    for x in (-SW / 2 - 0.02, SW / 2 + 0.02):
        lay(coll, pc.xf(pc.ellipse_pts(0.14, 0.3, 24), x, 0), WOOD_DK, 0.22, h=0.04)


c = sl.new_coll('scroll_top')
frame_marks(c, SX0, -0.45, SX1, 0.4)
rod(c, 0, 1)
lay(c, rect(0, -0.4, SW - 0.3, 0.1), PARCH, 0.0, h=0.03)
SPRITES['scroll_top'] = (c, 64.0)

c = sl.new_coll('scroll_body')
frame_marks(c, SX0, -1.0, SX1, 1.0)
lay(c, rect(0, 0, SW - 0.3, 2.0), PARCH, 0.0, h=0.03)
for x in (-(SW - 0.3) / 2 + 0.06, (SW - 0.3) / 2 - 0.06):
    lay(c, rect(x, 0, 0.12, 2.0), PARCH_DK, 0.04, h=0.01)
SPRITES['scroll_body'] = (c, 64.0)

c = sl.new_coll('scroll_bottom')
frame_marks(c, SX0, -0.4, SX1, 0.45)
rod(c, 0, -1)
lay(c, rect(0, 0.4, SW - 0.3, 0.1), PARCH, 0.0, h=0.03)
SPRITES['scroll_bottom'] = (c, 64.0)

# ---------------------------------------------------------------- render each, pack into one sheet
renders = {}
for key, (coll, ppu) in SPRITES.items():
    path = os.path.join(TMP, key + '.png')
    renders[key] = sl.render_coll(coll, path, pad=0.04, ppu=ppu)
    renders[key]['path'] = path

GUT = 2
SHEET_W = 1024
order = sorted(SPRITES, key=lambda k: -renders[k]['h'])
x = y = row_h = 0
frames = {}
for key in order:
    r = renders[key]
    if x + r['w'] > SHEET_W:
        x, y, row_h = 0, y + row_h + GUT, 0
    frames[key] = {'x': x, 'y': y, 'w': r['w'], 'h': r['h']}
    x += r['w'] + GUT
    row_h = max(row_h, r['h'])
SHEET_H = y + row_h

sheet = np.zeros((SHEET_H, SHEET_W, 4), dtype=np.float32)
for key, f in frames.items():
    im = bpy.data.images.load(renders[key]['path'])
    px = np.array(im.pixels[:], dtype=np.float32).reshape(im.size[1], im.size[0], 4)[::-1]
    sheet[f['y']:f['y'] + f['h'], f['x']:f['x'] + f['w']] = px
    bpy.data.images.remove(im)

img = bpy.data.images.new('ui_kit', SHEET_W, SHEET_H, alpha=True)
img.pixels[:] = sheet[::-1].ravel()
img.filepath_raw = os.path.join(OUT, 'ui.png')
img.file_format = 'PNG'
img.save()

# liquid rows inside the flask frame (render_coll pads the frame by 0.04)
pad = 0.04
to_row = lambda wy: round((FY1 + pad - wy) * FLASK_PPU)   # noqa: E731
fill = {k: {'top': to_row(LIQ_TOP), 'bottom': to_row(LIQ_BOT)} for k in ('flask_liquid_hp', 'flask_liquid_en')}
with open(os.path.join(OUT, 'ui.json'), 'w', newline='\n') as fh:
    json.dump({'frames': {k: frames[k] for k in SPRITES}, 'fill': fill}, fh, indent=1)
print('UI_KIT', SHEET_W, SHEET_H, len(frames))
