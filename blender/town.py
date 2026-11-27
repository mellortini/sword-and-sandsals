"""Pulpport town (#29) as a layered paper diorama in a warm Roman / Greek style: an opaque background (warm sky,
hills with cypresses and umbrella pines, an aqueduct, terraced lawns, a fountain, the paved forum) and one
transparent layer per building, so the town scene (#30) can light up the building under the pointer.

  python -I tools/blender.py blender/town.py -- [samples] [only,...]

`only` renders some of: bg, trophies, leagues, temple, enchanter, skills, weaponsmith, forge, armourer, trainer,
tavern (town.json is always rewritten in full from the geometry). Output: assets/bg/town_<id>.png + town.json.

Three rows, back to front: the arena between the triumphal arch and the temple (baseline y = 560), the tholos and the
academy on the middle terrace (y = 725), the shops on the forum (y = 995). The road from the arena gate down the
middle stays free for the player's puppet.

The sky, the sun, the clouds, the lit windows (`lights`) and the flames are separate so the game can run a day and
night cycle: clouds drift, the sun crosses the sky on an arc, lamps, torches and braziers light up at dusk.

Everything is designed in screen pixels of the 1920x1080 frame (x right, y DOWN); P() maps them to the paper plane.
The camera is orthographic, so every layer lands exactly where it was designed and the layers stack without parallax.
"""
import bpy, sys, os, math, random, json
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import sprite_lib as sl  # noqa: E402
pc = sl.pc

argv = sys.argv[sys.argv.index('--') + 1:] if '--' in sys.argv else []
SAMPLES = int(argv[0]) if argv else 96
ONLY = [p for p in (argv[1].split(',') if len(argv) > 1 else []) if p]
OUT = os.path.join(sl.GAME, 'assets', 'bg')
W, H, K = 1920, 1080, 50.0                       # K = pixels per paper unit
os.makedirs(OUT, exist_ok=True)

sc = sl.setup(samples=SAMPLES, world='#fff0d8', world_strength=0.62, sun_strength=3.0)
rnd = random.Random(29)
coll = None                                      # collection the next layers go into


def P(px, py):
    return ((px - W / 2) / K, (H / 2 - py) / K)


# ------------------------------------------------------------------ materials (warm Mediterranean palette)
def paper(name, color, fiber='washi', scale=0.18):
    return sl.tex_paper(name, color, fiber, 0.85, scale=scale)


def board(name, color, kind='craft', scale=0.14):
    return sl.tex_board(name, kind, tint=color, tint_k=0.9, scale=scale, nrm=0.5)


def glow(name, color, k=1.6):
    m = bpy.data.materials.get(name)
    return m or pc.glow_mat(name, color, k)


SKY = paper('sky', '#ffffff', 'water', 0.07)          # neutral paper; the game colours it by the time of day
CLOUD, SUN, HALO = paper('cloud', '#fff7e8', 'white'), paper('sun', '#fff1bd', 'white'), paper('halo', '#fae0a4', 'water')
FAR, FAR_D, FAR_W, FAR_R = (paper('far', '#d3c79a', 'water'), paper('far_d', '#bfb585', 'water'),
                            paper('far_w', '#efe1c3', 'water'), paper('far_r', '#d8a07c', 'water'))
FAR_T = paper('far_t', '#9c9c6c', 'water')
HILL, HILL_D = paper('hill', '#adb36d', 'water'), paper('hill_d', '#98a25d', 'water')
AQUA = paper('aqueduct', '#ead6ae')
GRASS, GRASS_D, GRASS_L = paper('grass', '#97b85b', 'washi', 0.3), paper('grass_d', '#82a54d', 'washi', 0.3), paper('grass_l', '#b2ca74', 'washi', 0.3)
HEDGE, HEDGE_D = paper('hedge', '#5f8b3d', 'washi', 0.3), paper('hedge_d', '#4b7330', 'washi', 0.3)
CYP, CYP_D, CYP_L = paper('cyp', '#4f7036', 'washi', 0.3), paper('cyp_d', '#3d5a2a', 'washi', 0.3), paper('cyp_l', '#6a8f45', 'washi', 0.3)
PINE, PINE_D = paper('pine', '#6f8c45', 'washi', 0.3), paper('pine_d', '#587638', 'washi', 0.3)
OLIVE, OLIVE_D, OLIVE_L = paper('olive', '#93a465', 'washi', 0.3), paper('olive_d', '#7c8f52', 'washi', 0.3), paper('olive_l', '#b0bd84', 'washi', 0.3)
BARK = board('bark', '#7d5a3a', 'brown', 0.2)
FLOWERS = [paper(f'flower{i}', c, 'white', 0.4) for i, c in enumerate(('#d9573f', '#f2a7a0', '#f5cf58', '#fbf6ec', '#a98bd0'))]
WATER, WATER_L = paper('water', '#79bcc4', 'water', 0.1), paper('water_l', '#c3e6e6', 'white', 0.1)

TRAV, TRAV_D, TRAV_L = paper('trav', '#efdcb9'), paper('trav_d', '#d6ba8b'), paper('trav_l', '#f7ecd4')
MARBLE, MARBLE_D = paper('marble', '#fbf6ec', 'white'), paper('marble_d', '#e7dcc6', 'white')
PLAZA = paper('plaza', '#d8bb8a')
FLAGS = [paper(f'flag{i}', c, scale=0.3) for i, c in enumerate(('#ecd3a6', '#e3c493', '#f1dcb3', '#e7cb9c'))]
ROAD = [paper(f'road{i}', c, scale=0.3) for i, c in enumerate(('#f5e3bf', '#efd8ad', '#f8e9cb'))]
OCHRE, OCHRE_D, PLASTER = paper('ochre', '#e8b66f'), paper('ochre_d', '#c99450'), paper('plaster', '#f4e3c5')
POMP, POMP_D = paper('pomp', '#b2452f'), paper('pomp_d', '#8b3324')
TERRA, TERRA_D, TERRA_L = paper('terra', '#c8673c'), paper('terra_d', '#a24d2c'), paper('terra_l', '#dc8552')
BRICK, BRICK_D = paper('brick', '#b8673f'), paper('brick_d', '#93492d')
WOOD, WOOD_D, WOOD_L = board('wood', '#8a5a34', 'brown', 0.2), board('wood_d', '#5c3a24', 'brown', 0.2), board('wood_l', '#b98350', 'brown', 0.2)
SAND = paper('sand', '#ecd09a', 'washi', 0.35)
RED, CREAM, WHITE = paper('red', '#a7281f'), paper('cream', '#f3e3c2'), paper('white', '#f6f1e6', 'white')
PURPLE, TEAL, BLUE = paper('purple', '#6d3f8f'), paper('teal', '#2f8f86'), paper('blue', '#2f5f93')
GREEN, YELLOW, INK = paper('green', '#4f7a42'), paper('yellow', '#e3b23c'), paper('ink', '#1f1a2e', 'water')
DARK, SHADE, SHADE_L = paper('dark', '#3a2320'), paper('shade', '#6e3f2a'), paper('shade_l', '#8f5638')
GOLD = sl.foil('gold', '#e2b64a', metal=0.65, rough=0.3, emit=0.3)
STEEL = sl.foil('steel', '#c3c9d1', metal=0.7, rough=0.35, emit=0.18)
BRONZE = sl.foil('bronze', '#b9783e', metal=0.65, rough=0.38, emit=0.2)
FIRE, FIRE_HOT = glow('fire', '#ff7a1a', 1.5), glow('fire_hot', '#ffd25a', 1.7)
LAMP, MAGIC = glow('lamp', '#ffbe55', 1.15), glow('magic', '#69e6d2', 1.15)
# by day the lamps and the magic are off: building layers use these, the night `lights` layer the glowing ones
# shop interiors: shaded by day, a warm lamplit glow in the evening (until the shutters close)
SHOP = glow('shop', '#e09a52', 0.75)
LIGHT_OFF = {LAMP.name: paper('lamp_off', '#7a5034'), MAGIC.name: paper('magic_off', '#4d8a84'), SHOP.name: SHADE}
SHUTTERS = []                                    # shop windows the game closes at night: [layer, x, y, w, h]
SMOKE = paper('smoke', '#cfc5bd', 'water')


# ------------------------------------------------------------------ shapes (all in screen px)
def poly(pts, mat, z=0.0, h=0.12, holes=()):
    return pc.layer([P(*p) for p in pts], mat, h=h, z=z, holes=[[P(*p) for p in q] for q in holes],
                    name='l', bevel=0.012, coll=coll)


def box(x0, y0, x1, y1, r=0.0):
    r = min(r, (x1 - x0) / 2, (y1 - y0) / 2)
    if r <= 0:
        return [(x0, y0), (x1, y0), (x1, y1), (x0, y1)]
    pts = []
    for cx, cy, a0 in ((x1 - r, y1 - r, 0), (x0 + r, y1 - r, 90), (x0 + r, y0 + r, 180), (x1 - r, y0 + r, 270)):
        pts += [(cx + r * math.cos(math.radians(a0 + i * 15)), cy + r * math.sin(math.radians(a0 + i * 15))) for i in range(7)]
    return pts


def B(x0, y0, x1, y1, mat, z=0.0, h=0.12, r=0.0, holes=()):
    return poly(box(x0, y0, x1, y1, r), mat, z, h, holes)


def ell(cx, cy, rx, ry, n=40):
    return [(cx + rx * math.cos(i / n * math.tau), cy + ry * math.sin(i / n * math.tau)) for i in range(n)]


def E(cx, cy, rx, ry, mat, z=0.0, h=0.1, n=40):
    return poly(ell(cx, cy, rx, ry, n), mat, z, h)


def arch(cx, top, bottom, w, n=16):
    """doorway / window outline: straight sides, round top; `top` is the crown"""
    r = w / 2
    return [(cx - r, bottom), *[(cx - r * math.cos(math.pi * i / n), top + r - r * math.sin(math.pi * i / n)) for i in range(n + 1)],
            (cx + r, bottom)]


def A(cx, top, bottom, w, mat, z=0.0, h=0.1):
    return poly(arch(cx, top, bottom, w), mat, z, h)


def drop(cx, cy, s, mat, z=0.0, h=0.1):
    """glue / ink drop, tip up"""
    pts = [(cx, cy - 1.5 * s)]
    pts += [(cx + s * math.cos(a), cy + s * math.sin(a)) for a in [math.radians(-35 + i * 250 / 24) for i in range(25)]]
    return poly(pts, mat, z, h)


def star(x, y, r, mat, z):
    poly([(x, y - r), (x + r * .3, y - r * .3), (x + r, y), (x + r * .3, y + r * .3), (x, y + r), (x - r * .3, y + r * .3),
          (x - r, y), (x - r * .3, y - r * .3)], mat, z, 0.05)


def door(cx, top, bottom, w, z, leaf=None, frame=None):
    A(cx, top - 9, bottom, w + 18, frame or TRAV_D, z, 0.1)
    A(cx, top, bottom, w, leaf or WOOD_D, z + 0.12, 0.06)
    for k in (-0.22, 0.0, 0.22):
        B(cx + k * w - 1.5, top + 14, cx + k * w + 1.5, bottom - 4, WOOD, z + 0.2, 0.03)
    E(cx + w * 0.3, (top + bottom) / 2 + 10, 4.5, 4.5, BRONZE, z + 0.24, 0.05, 16)


def window(x0, y0, x1, y1, z, light=LAMP, frame=None):
    """small square Roman window with a stone sill and a wooden grille"""
    B(x0 - 6, y0 - 6, x1 + 6, y1 + 4, frame or TRAV_D, z, 0.08, 2)
    B(x0, y0, x1, y1, light, z + 0.1, 0.04)
    B((x0 + x1) / 2 - 2, y0, (x0 + x1) / 2 + 2, y1, WOOD_D, z + 0.16, 0.03)
    B(x0 - 9, y1 + 2, x1 + 9, y1 + 9, TRAV, z + 0.18, 0.06, 2)


def column(x, top, bottom, w, z, mat=None, flutes=True):
    """Doric-ish column: shaft, echinus capital, abacus, base"""
    mat = mat or MARBLE
    poly([(x - w / 2, bottom - 8), (x - w * 0.42, top + 12), (x + w * 0.42, top + 12), (x + w / 2, bottom - 8)], mat, z, 0.16)
    if flutes:
        for dx in (-0.22, 0.0, 0.22):
            B(x + dx * w - 1.2, top + 18, x + dx * w + 1.2, bottom - 12, MARBLE_D, z + 0.17, 0.02)
    poly([(x - w * 0.46, top + 13), (x - w * 0.62, top + 5), (x + w * 0.62, top + 5), (x + w * 0.46, top + 13)], mat, z + 0.18, 0.08)
    B(x - w * 0.68, top - 2, x + w * 0.68, top + 6, mat, z + 0.2, 0.08, 1.5)
    B(x - w * 0.62, bottom - 9, x + w * 0.62, bottom, mat, z + 0.2, 0.08, 2)


def tiles(x0, x1, top, bottom, z, over=14, mat=None):
    """Roman tiled roof seen from the street: a sloping band of tegulae with imbrex ribs and antefixes on the eave"""
    mat = mat or TERRA
    poly([(x0 - over, bottom), (x0 + 6, top), (x1 - 6, top), (x1 + over, bottom)], mat, z, 0.16)
    n = max(3, int((x1 - x0 + 2 * over) / 22))
    for i in range(n + 1):
        k = i / n
        xb = x0 - over + (x1 - x0 + 2 * over) * k
        xt = x0 + 6 + (x1 - x0 - 12) * k
        poly([(xb - 4, bottom - 2), (xt - 3, top + 2), (xt + 3, top + 2), (xb + 4, bottom - 2)], TERRA_D if i % 2 else TERRA_L, z + 0.17, 0.04)
        E(xb, bottom + 1, 5, 5, TERRA_D, z + 0.22, 0.05, 12)
    B(x0 + 2, top - 5, x1 - 2, top + 3, TERRA_D, z + 0.24, 0.07, 3)


def pediment(cx, base, half, rise, z, mat=None, inner=None):
    poly([(cx - half, base), (cx, base - rise), (cx + half, base)], mat or MARBLE, z, 0.18)
    poly([(cx - half + 22, base - 6), (cx, base - rise + 14), (cx + half - 22, base - 6)], inner or MARBLE_D, z + 0.19, 0.04)


def sign(cx, cy, z, ground=None, arm=-1):
    """round sign board hanging from a bracket; the emblem goes on top at z + 0.25"""
    B(cx + arm * 6 - 30, cy - 64, cx + arm * 6 + 30, cy - 58, WOOD_D, z, 0.06, 2)
    for dx in (-16, 16):
        B(cx + dx - 1.5, cy - 60, cx + dx + 1.5, cy - 36, DARK, z + 0.01, 0.04)
    E(cx, cy, 38, 38, BRONZE, z + 0.08, 0.08)
    E(cx, cy, 31, 31, ground or CREAM, z + 0.17, 0.05)


def curb(x0, x1, y, mat=None):
    """the travertine step a building stands on; it grounds the cut-out on the paving"""
    B(x0, y - 6, x1, y + 14, mat or TRAV_D, 2.4, 0.2, 5)
    B(x0 + 8, y + 10, x1 - 8, y + 20, PLAZA, 2.3, 0.08, 4)


FLAMES = []                                      # animated in the game: [layer, x, y (flame base), size, always]
layer_key = 'bg'


def flame(x, y, s=1.0, always=False):
    """a flame the game animates; `always` burns day and night (the forge), others light up at dusk"""
    FLAMES.append(dict(layer=layer_key, x=round(x, 1), y=round(y, 1), s=s, always=always))


def torch(x, top, bottom, z, s=0.75):
    """a wooden torch post with a bronze cup; the flame comes from the game"""
    B(x - 3.5, top + 10, x + 3.5, bottom, WOOD_D, z, 0.08)
    for y in (top + 26, top + 40):
        B(x - 5, y, x + 5, y + 4, BRONZE, z + 0.1, 0.03)
    poly([(x - 13, top - 2), (x + 13, top - 2), (x + 7, top + 14), (x - 7, top + 14)], BRONZE, z + 0.12, 0.1)
    B(x - 9, top - 4, x + 9, top + 2, DARK, z + 0.24, 0.03, 2)
    flame(x, top + 1, s)


def shutter(x0, y0, x1, y1):
    """a shop window the game closes at night with two plank leaves hinged at its sides"""
    SHUTTERS.append(dict(layer=layer_key, x=x0, y=y0, w=x1 - x0, h=y1 - y0))


def oil_lamp(x, y, z, chain=18):
    """a small bronze oil lamp hanging inside a shop; it glows at night"""
    B(x - 1, y - chain, x + 1, y, DARK, z, 0.02)
    poly([(x - 11, y), (x + 11, y), (x + 7, y + 7), (x - 7, y + 7)], BRONZE, z + 0.02, 0.05)
    E(x + 9, y - 3, 4, 6, LAMP, z + 0.08, 0.03, 12)


# ------------------------------------------------------------------ greenery
def cypress(x, base, h, w, z, far=False):
    if far:
        poly([(x - w / 2, base), (x - w * 0.42, base - h * 0.55), (x, base - h), (x + w * 0.42, base - h * 0.55), (x + w / 2, base)], FAR_T, z, 0.05)
        return
    pts = [(x, base - h)]
    for i in range(1, 13):
        t = i / 12
        pts.append((x + w / 2 * math.sin(math.pi * min(1, t * 1.15)) ** 0.8, base - h + h * t))
    pts += [(x - px + x, py) for px, py in reversed(pts[1:])]
    poly(pts, CYP, z, 0.14)
    poly([(x + 1, base - h + 12), (x + w * 0.32, base - h * 0.55), (x + w * 0.22, base - 12), (x + 3, base - h * 0.3)], CYP_L, z + 0.15, 0.04)
    poly([(x - 2, base - h * 0.75), (x - w * 0.35, base - h * 0.45), (x - w * 0.3, base - 10), (x - 4, base - h * 0.2)], CYP_D, z + 0.15, 0.04)
    B(x - 3, base - 4, x + 3, base + 6, BARK, z - 0.02, 0.05)


def umbrella_pine(x, base, h, w, z, lean=0.0):
    tx = x + lean * h
    poly([(x - 5, base), (tx - 4, base - h + 14), (tx + 4, base - h + 14), (x + 5, base)], BARK, z, 0.08)
    poly([(tx, base - h * 0.55), (tx - w * 0.22, base - h + 18), (tx - w * 0.2, base - h + 24)], BARK, z + 0.01, 0.05)
    for i in range(7):
        k = (i + 0.5) / 7
        E(tx - w / 2 + w * k, base - h + 6 - 14 * math.sin(math.pi * k), w / 7 + 8, 17, PINE_D if i % 2 else PINE, z + 0.1 + i * 0.065, 0.06, 20)
    E(tx, base - h - 4, w * 0.36, 16, PINE, z + 0.6, 0.05, 24)


def olive(x, base, s, z):
    poly([(x - 9 * s, base), (x - 4 * s, base - 40 * s), (x - 14 * s, base - 72 * s), (x - 6 * s, base - 76 * s),
          (x + 2 * s, base - 50 * s), (x + 10 * s, base - 80 * s), (x + 17 * s, base - 76 * s), (x + 8 * s, base - 40 * s), (x + 10 * s, base)],
         BARK, z, 0.1)
    for i, (dx, dy, rx, ry) in enumerate(((-46, -88, 36, 24), (0, -108, 44, 28), (44, -90, 38, 24), (-22, -120, 32, 20),
                                         (24, -124, 34, 20), (-58, -70, 22, 15), (60, -72, 22, 15))):
        E(x + dx * s, base + dy * s, rx * s, ry * s, (OLIVE, OLIVE_D, OLIVE_L)[i % 3], z + 0.12 + i * 0.055, 0.05, 22)


def bush(x, y, r, z, flowers=0):
    for i, (dx, dy, k) in enumerate(((-0.6, 0.05, 0.7), (0.6, 0.05, 0.75), (0, -0.25, 0.95))):
        E(x + dx * r, y + dy * r, r * k, r * k * 0.82, (HEDGE, HEDGE_D, HEDGE)[i], z + i * 0.085, 0.08, 22)
    for _ in range(flowers):
        a, d = rnd.uniform(0, math.tau), rnd.uniform(0.1, 0.8) * r
        E(x + math.cos(a) * d * 1.2, y - r * 0.25 + math.sin(a) * d * 0.6, 3.8, 3.8, rnd.choice(FLOWERS[:4]), z + 0.26, 0.03, 10)


def flower_bed(x0, x1, y, z, depth=18):
    B(x0, y - depth / 2, x1, y + depth / 2, GRASS_D, z, 0.05, depth / 2)
    x = x0 + 8
    while x < x1 - 8:
        E(x, y + rnd.uniform(-depth / 4, depth / 4), 6, 6, rnd.choice(FLOWERS), z + 0.06, 0.03, 12)
        x += rnd.uniform(11, 17)


def pot(x, base, z, s=1.0, plant='ball'):
    """terracotta planter with a clipped topiary"""
    if plant == 'ball':
        B(x - 2.5 * s, base - 60 * s, x + 2.5 * s, base - 30 * s, BARK, z, 0.05)
        E(x, base - 64 * s, 24 * s, 22 * s, HEDGE, z + 0.04, 0.1, 24)
        E(x - 6 * s, base - 70 * s, 11 * s, 9 * s, CYP_L, z + 0.08, 0.03, 16)
    else:
        cypress(x, base - 30 * s, 110 * s, 26 * s, z)
    poly([(x - 20 * s, base - 34 * s), (x + 20 * s, base - 34 * s), (x + 14 * s, base), (x - 14 * s, base)], TERRA, z + 0.12, 0.12)
    B(x - 23 * s, base - 38 * s, x + 23 * s, base - 30 * s, TERRA_D, z + 0.2, 0.08, 2)


def amphora(x, base, s, z, mat=None):
    mat = mat or TERRA
    poly([(x - 4 * s, base), (x - 14 * s, base - 18 * s), (x - 16 * s, base - 38 * s), (x - 10 * s, base - 50 * s), (x - 5 * s, base - 54 * s),
          (x - 5 * s, base - 64 * s), (x + 5 * s, base - 64 * s), (x + 5 * s, base - 54 * s), (x + 10 * s, base - 50 * s),
          (x + 16 * s, base - 38 * s), (x + 14 * s, base - 18 * s), (x + 4 * s, base)], mat, z, 0.12)
    for side in (-1, 1):
        poly([(x + side * 5 * s, base - 60 * s), (x + side * 12 * s, base - 58 * s), (x + side * 12 * s, base - 48 * s),
              (x + side * 9 * s, base - 48 * s), (x + side * 9 * s, base - 55 * s), (x + side * 5 * s, base - 56 * s)], TERRA_D, z + 0.13, 0.04)
    B(x - 15 * s, base - 34 * s, x + 15 * s, base - 30 * s, TERRA_D, z + 0.13, 0.03)


def shield_round(cx, cy, r, face, rim, z, boss=GOLD):
    E(cx, cy, r, r, rim, z, 0.1)
    E(cx, cy, r * 0.78, r * 0.78, face, z + 0.12, 0.05)
    E(cx, cy, r * 0.24, r * 0.24, boss, z + 0.2, 0.07)


def scutum(cx, cy, w, h, z, face=RED):
    B(cx - w / 2, cy - h / 2, cx + w / 2, cy + h / 2, GOLD, z, 0.1, 6)
    B(cx - w / 2 + 4, cy - h / 2 + 4, cx + w / 2 - 4, cy + h / 2 - 4, face, z + 0.11, 0.05, 4)
    B(cx - 2, cy - h / 2 + 6, cx + 2, cy + h / 2 - 6, GOLD, z + 0.17, 0.03)
    E(cx, cy, w * 0.2, w * 0.2, GOLD, z + 0.2, 0.06, 18)


def helmet(cx, cy, z, crest=RED, s=1.0):
    poly([(cx - 8 * s, cy - 28 * s), (cx - 20 * s, cy - 50 * s), (cx + 10 * s, cy - 52 * s), (cx + 30 * s, cy - 34 * s), (cx + 10 * s, cy - 26 * s)], crest, z, 0.06)
    A(cx, cy - 32 * s, cy + 16 * s, 56 * s, BRONZE, z + 0.08, 0.1)
    B(cx - 34 * s, cy + 4 * s, cx + 34 * s, cy + 14 * s, GOLD, z + 0.2, 0.06, 4)
    B(cx - 16 * s, cy + 14 * s, cx + 16 * s, cy + 30 * s, DARK, z + 0.1, 0.05, 3)
    B(cx - 3 * s, cy + 8 * s, cx + 3 * s, cy + 30 * s, BRONZE, z + 0.24, 0.05)


def gladius(x, top, z, s=1.0, mat=None):
    poly([(x - 6 * s, top + 70 * s), (x - 6 * s, top + 12 * s), (x, top), (x + 6 * s, top + 12 * s), (x + 6 * s, top + 70 * s)], mat or STEEL, z, 0.06)
    B(x - 15 * s, top + 68 * s, x + 15 * s, top + 76 * s, BRONZE, z + 0.08, 0.06, 3)
    B(x - 4 * s, top + 76 * s, x + 4 * s, top + 96 * s, WOOD_D, z + 0.06, 0.06, 2)
    E(x, top + 100 * s, 6 * s, 6 * s, BRONZE, z + 0.08, 0.05, 14)


def laurel(cx, cy, r, z, mat=None):
    """two laurel branches curving up both sides of a circle, open at the top"""
    for side in (-1, 1):
        for i in range(6):
            a = math.radians(-70 + i * 26)                 # from below the centre up the side
            E(cx + side * r * math.cos(a), cy - r * math.sin(a), 6 * r / 40, 10 * r / 40, mat or GREEN, z, 0.04, 14)


# ------------------------------------------------------------------ background
def road_x(y):
    """left and right edge of the road from the arena gate (y = 560) to the bottom of the frame"""
    k = (y - 560) / 520
    return 900 - 160 * k, 1020 + 160 * k


def background():
    # (the sky, the sun and the clouds are separate layers the game moves: sky(), sun(), cloud())
    # far hills: pale olive, little white villas with red roofs, rows of far cypresses
    for layer, (mat, y0, amp, z) in enumerate(((FAR, 360, 40, 0.5), (FAR_D, 405, 34, 0.75))):
        pts = [(-40, 540)]
        for i in range(41):
            x = -40 + i * 50
            pts.append((x, y0 - amp * math.sin(i * 0.37 + layer * 2.1) - 18 * math.sin(i * 0.93 + layer)))
        pts.append((1960, 540))
        poly(pts, mat, z, 0.06)
        for _ in range(9):
            x = rnd.uniform(0, 1920)
            y = y0 - amp * math.sin((x + 40) / 50 * 0.37 + layer * 2.1) - 18 * math.sin((x + 40) / 50 * 0.93 + layer) + 16
            if rnd.random() < 0.5:
                bw = rnd.uniform(26, 44)
                B(x, y - 18, x + bw, y + 4, FAR_W, z + 0.08, 0.03)
                poly([(x - 4, y - 18), (x + bw / 2, y - 28), (x + bw + 4, y - 18)], FAR_R, z + 0.1, 0.03)
                for wx in range(int(bw // 12)):
                    if rnd.random() < 0.7:
                        B(x + 5 + wx * 12, y - 12, x + 10 + wx * 12, y - 5, LAMP, z + 0.1, 0.02)
            for k in range(rnd.randint(2, 4)):
                cypress(x + 48 + k * 13, y + 6, rnd.uniform(34, 52), 10, z + 0.1, far=True)
    # the aqueduct striding over the hills (left and right of the arena)
    for x0, x1 in ((-40, 640), (1280, 1960)):
        holes = []
        for i in range(int((x1 - x0) / 64)):
            cx = x0 + 32 + i * 64
            holes.append(arch(cx, 368, 432, 40))
            holes.append(arch(cx, 318, 342, 16))
        B(x0, 306, x1, 432, AQUA, 0.9, 0.08, holes=holes)
        B(x0, 300, x1, 310, TRAV_D, 1.0, 0.05)
        B(x0, 350, x1, 356, TRAV_D, 1.0, 0.04)
    # nearer green hills with umbrella pines and cypresses
    pts = [(-40, 560)] + [(-40 + i * 60, 452 - 22 * math.sin(i * 0.45 + 1) - 10 * math.sin(i * 1.3)) for i in range(34)] + [(1960, 560)]
    poly(pts, HILL, 1.1, 0.08)
    pts = [(-40, 560)] + [(-40 + i * 60, 482 - 14 * math.sin(i * 0.6 + 2.5) - 8 * math.sin(i * 1.7)) for i in range(34)] + [(1960, 560)]
    poly(pts, HILL_D, 1.2, 0.08)
    for x, h, w, lean in ((70, 120, 170, -0.08), (470, 104, 150, 0.06), (1420, 112, 160, -0.05), (1880, 124, 180, 0.07)):
        umbrella_pine(x, 470, h, w, 1.3, lean)
    # back terrace: lawn, the travertine walk the back row stands on, rows of tall cypresses
    B(-30, 500, 1950, 600, GRASS, 1.5, 0.1)
    for x in range(-20, 1950, 34):
        E(x, 502, 22, 9, GRASS_L, 1.52 + (x // 34 % 2) * 0.035, 0.03, 16)
    B(-30, 540, 1950, 578, TRAV, 1.6, 0.06)
    B(-30, 574, 1950, 582, TRAV_D, 1.62, 0.04)
    for x, h in ((462, 250), (500, 290), (540, 262), (1356, 262), (1396, 296), (1434, 250)):
        cypress(x, 556, h, 34, 1.7)
    # retaining wall with a balustrade and steps in the middle
    B(-30, 580, 1950, 650, TRAV_D, 1.9, 0.14)
    x, row = -30.0, 0
    for y in range(604, 650, 22):
        x = -30 - (row % 2) * 38
        while x < 1950:
            bw = rnd.uniform(64, 86)
            B(x + 3, y + 2, x + bw - 3, y + 20, rnd.choice((TRAV, TRAV_L, TRAV)), 2.04, 0.03, 2)
            x += bw
        row += 1
    B(-30, 578, 1950, 588, TRAV_L, 2.1, 0.06)
    for x in range(-10, 1950, 26):                           # balusters
        if not 840 < x < 1080:
            poly([(x - 5, 600), (x - 7, 592), (x + 7, 592), (x + 5, 600), (x + 7, 606), (x - 7, 606)], TRAV_L, 2.12, 0.05)
    for x, y in ((80, 610), (330, 622), (1610, 612), (1830, 620), (700, 640)):   # ivy over the wall
        for k in range(6):
            E(x + rnd.uniform(-30, 30), y + rnd.uniform(-12, 22), rnd.uniform(9, 14), rnd.uniform(7, 10), (HEDGE, HEDGE_D, GRASS_D)[k % 3], 2.2 + k * 0.035, 0.03, 14)
    # middle terrace: lawn with paths, hedges at its front edge
    B(-30, 648, 1950, 780, GRASS, 2.3, 0.1)
    for x in range(-20, 1950, 30):
        E(x + rnd.uniform(-6, 6), 650, 20, 8, GRASS_L, 2.32 + (x // 30 % 2) * 0.035, 0.03, 14)
    B(-30, 718, 1950, 740, TRAV, 2.34, 0.05, 6)                         # path the middle row stands on
    # steps from the forum up to the arena, then the road itself
    for i in range(5):
        y = 582 + i * 14
        l, r = road_x(y)
        B(l - 30, y, r + 30, y + 15, (TRAV_L, TRAV, TRAV_L, TRAV, TRAV_L)[i], 2.4 + i * 0.02, 0.06, 3)
    # hedges and planting on the middle terrace
    # kept low: the crowns stay under the balustrade, never under the back-row buildings
    olive(150, 736, 0.86, 2.5)
    olive(1790, 736, 0.9, 2.5)
    cypress(1636, 722, 118, 30, 2.45)
    cypress(1672, 722, 96, 26, 2.47)
    cypress(282, 722, 112, 28, 2.45)
    for x, r, fl in ((40, 26, 5), (250, 22, 4), (1600, 22, 4), (1900, 28, 5), (1080, 20, 3), (840, 20, 3)):
        bush(x, 712, r, 2.6, fl)
    # fountain on the left of the road, a marble gladiator on the right
    fx, fy = 690, 742
    E(fx, fy, 110, 22, TRAV_D, 2.65, 0.14)
    E(fx, fy - 4, 96, 16, WATER, 2.8, 0.04)
    for i in range(10):
        E(fx - 70 + i * 16 + rnd.uniform(-4, 4), fy - 4 + rnd.uniform(-5, 5), 6, 1.8, WATER_L, 2.85, 0.02, 10)
    B(fx - 10, fy - 70, fx + 10, fy - 6, TRAV, 2.88, 0.1)
    poly([(fx - 46, fy - 74), (fx + 46, fy - 74), (fx + 30, fy - 60), (fx - 30, fy - 60)], TRAV, 2.92, 0.1)
    E(fx, fy - 76, 44, 6, WATER, 2.98, 0.04, 30)
    B(fx - 4, fy - 112, fx + 4, fy - 76, TRAV_L, 3.0, 0.06)
    E(fx, fy - 116, 10, 7, TRAV_L, 3.02, 0.06, 18)
    for side in (-1, 1):                                     # water arcs
        pts = [(fx + side * (6 + 40 * t), fy - 118 - 30 * math.sin(math.pi * t * 0.7) + 50 * t * t) for t in [i / 12 for i in range(13)]]
        poly(pts + [(x + side * 3, y + 4) for x, y in reversed(pts)], WATER_L, 3.04, 0.02)
        pts = [(fx + side * (40 + 34 * t), fy - 66 + 60 * t * t) for t in [i / 8 for i in range(9)]]
        poly(pts + [(x + side * 3, y + 3) for x, y in reversed(pts)], WATER_L, 3.04, 0.02)
    sx, sy = 1225, 742                                       # statue on a plinth
    B(sx - 34, sy - 58, sx + 34, sy, TRAV, 2.7, 0.16, 3)
    B(sx - 40, sy - 64, sx + 40, sy - 54, TRAV_L, 2.86, 0.08, 2)
    B(sx - 40, sy - 6, sx + 40, sy + 4, TRAV_D, 2.86, 0.08, 2)
    poly([(sx - 14, sy - 64), (sx - 10, sy - 110), (sx - 18, sy - 150), (sx + 16, sy - 152), (sx + 12, sy - 110), (sx + 16, sy - 64)], MARBLE, 2.9, 0.12)
    E(sx, sy - 166, 12, 13, MARBLE, 2.92, 0.1, 20)
    poly([(sx + 14, sy - 148), (sx + 40, sy - 186), (sx + 46, sy - 182), (sx + 22, sy - 140)], MARBLE, 2.94, 0.08)   # raised sword arm
    poly([(sx + 40, sy - 186), (sx + 50, sy - 228), (sx + 55, sy - 226), (sx + 47, sy - 184)], MARBLE_D, 2.96, 0.05)
    E(sx - 22, sy - 120, 14, 22, MARBLE_D, 2.96, 0.08, 20)                   # shield
    # hedge line between the terrace and the forum
    for x0, x1 in ((-30, road_x(770)[0] - 20), (road_x(770)[1] + 20, 1950)):
        B(x0, 752, x1, 784, HEDGE_D, 3.1, 0.12, 12)
        x = x0 + 10
        while x < x1 - 10:
            E(x, 754, 15, 9, HEDGE, 3.22 + (round(x) // 24 % 2) * 0.045, 0.04, 16)
            x += 24
    # the forum: travertine flagstones that grow towards the viewer
    B(-30, 776, 1950, 1110, PLAZA, 3.3, 0.12)
    y, row = 782.0, 0
    while y < 1085:
        s = 0.8 + (y - 776) / 360
        tall = 30 * s
        x = -30 - (row % 2) * 40 * s
        while x < 1950:
            w = rnd.uniform(80, 130) * s
            B(x + 3, y, x + w - 3, y + tall - 4, rnd.choice(FLAGS), 3.42, 0.03, 3)
            x += w
        y += tall
        row += 1
    # the road: long pale slabs between kerbs
    l0, r0 = road_x(650)
    l1, r1 = road_x(1110)
    poly([(l0 - 6, 650), (r0 + 6, 650), (r1 + 12, 1110), (l1 - 12, 1110)], TRAV_D, 3.5, 0.05)
    y, row = 652.0, 0
    while y < 1090:
        k = (y - 650) / 460
        l, r = road_x(y)
        tall = 14 + 32 * k
        n = 2 + row % 2
        cuts = [l + 6] + [l + (r - l) * (i + rnd.uniform(-0.15, 0.15)) / n for i in range(1, n)] + [r - 6]
        for a, b in zip(cuts, cuts[1:]):
            B(a + 3, y, b - 3, y + tall - 4, rnd.choice(ROAD), 3.56, 0.03, 4)
        y += tall
        row += 1
    for x in (road_x(745)[0] - 26, road_x(745)[1] + 26):        # torches at the foot of the steps
        torch(x, 664, 748, 3.2, 0.8)
    # tall pots with cypresses flanking the road, flower verge at the bottom of the frame
    for side in (-1, 1):
        l, r = road_x(830)
        x = l - 34 if side < 0 else r + 34
        pot(x, 838, 3.7, 1.0, 'cypress')
    for x0, x1 in ((-30, road_x(1050)[0] - 24), (road_x(1050)[1] + 24, 1950)):
        B(x0, 1048, x1, 1110, GRASS, 3.8, 0.1, 10)
        xx = x0 + 6
        while xx < x1:
            E(xx, 1050, 13, 7, GRASS_L, 3.9 + (round(xx) // 20 % 2) * 0.035, 0.03, 12)
            xx += 20
        flower_bed(x0 + 10, x1 - 10, 1068, 3.95, 20)


# ------------------------------------------------------------------ back row (baseline y = 560)
def trophies():
    """Hall of Fame: a triumphal arch with a gilded victor on top and trophies of captured arms"""
    base, cx = 560, 255
    B(cx - 165, 296, cx + 165, base - 10, TRAV, 0.3, 0.22, holes=[arch(cx, 380, base - 10, 104), arch(cx - 112, 430, base - 10, 50), arch(cx + 112, 430, base - 10, 50)])
    A(cx, 380, base - 10, 104, SHADE, 0.2, 0.05)
    A(cx - 112, 430, base - 10, 50, SHADE, 0.2, 0.05)
    A(cx + 112, 430, base - 10, 50, SHADE, 0.2, 0.05)
    A(cx, 396, base - 10, 76, SHADE_L, 0.24, 0.03)
    E(cx, 380 + 6, 14, 11, TRAV_L, 0.6, 0.06, 16)                         # keystone
    for x in (cx - 150, cx - 74, cx + 74, cx + 150):
        column(x, 318, base - 12, 24, 0.6)
    B(cx - 178, 290, cx + 178, 312, TRAV_L, 0.9, 0.12, 3)                  # cornice
    B(cx - 160, 226, cx + 160, 292, TRAV, 0.8, 0.18)                        # attic with the inscription
    B(cx - 112, 238, cx + 112, 280, TRAV_D, 1.0, 0.04, 3)
    x = cx - 100
    for wdt in (12, 8, 14, 10, 6, 12, 14, 8, 10, 12, 6, 12, 10):           # bronze "letters"
        B(x, 248, x + wdt, 270, BRONZE, 1.06, 0.03, 1.5)
        x += wdt + 5
    B(cx - 170, 220, cx + 170, 232, TRAV_L, 1.1, 0.1, 3)
    for x in (cx - 112, cx + 112):                                          # medallions above the side passages
        E(x, 368, 22, 22, TRAV_L, 1.0, 0.08, 30)
        laurel(x, 368, 20, 1.08, GREEN)
        E(x, 368, 10, 10, GOLD, 1.1, 0.05, 20)
    # gilded victor raising a wreath
    B(cx - 34, 196, cx + 34, 222, TRAV_L, 1.2, 0.12, 3)
    poly([(cx - 14, 196), (cx - 18, 160), (cx - 12, 122), (cx + 12, 122), (cx + 18, 160), (cx + 14, 196)], GOLD, 1.3, 0.1)
    E(cx, 108, 11, 12, GOLD, 1.32, 0.08, 20)
    poly([(cx + 10, 128), (cx + 30, 92), (cx + 36, 96), (cx + 18, 132)], GOLD, 1.34, 0.06)
    poly([(cx - 10, 128), (cx - 30, 150), (cx - 26, 156), (cx - 8, 138)], GOLD, 1.34, 0.06)
    for i in range(12):
        a = i / 12 * math.tau
        E(cx + 36 + 12 * math.cos(a), 82 + 10 * math.sin(a), 4, 6, GREEN, 1.4, 0.03, 10)
    poly([(cx - 14, 150), (cx - 34, 196), (cx + 34, 196), (cx + 14, 150)], RED, 1.28, 0.06)   # cloak
    # trophies of arms on both sides: a post, a helmet, a shield, crossed spears
    for x in (cx - 196, cx + 196):
        B(x - 4, 380, x + 4, base - 8, WOOD_D, 1.4, 0.06)
        for d in (-1, 1):
            poly([(x - d * 30, 400), (x - d * 26, 396), (x + d * 34, base - 30), (x + d * 30, base - 26)], WOOD, 1.38, 0.04)
        shield_round(x, 458, 26, POMP, GOLD, 1.5)
        helmet(x, 404, 1.5, PURPLE, 0.6)
    curb(cx - 220, cx + 220, base)
    for x in (cx - 238, cx + 238):
        pot(x, base - 6, 2.6, 0.7)


def leagues():
    """the arena: three storeys of travertine arches, velarium masts, banners and a laurel gate"""
    base = 560
    for i, (x, top) in enumerate(((680, 168), (820, 132), (960, 120), (1100, 132), (1240, 168))):
        B(x - 3, top - 58, x + 3, top + 40, WOOD_D, 0.1, 0.06)
        poly([(x + 3, top - 58), (x + 54, top - 46), (x + 3, top - 32)], (POMP, PURPLE, POMP, PURPLE, POMP)[i], 0.14, 0.05)
    for j, (half, top, bottom, mat, n) in enumerate(((300, 166, 290, TRAV_L, 11), (338, 276, 414, TRAV, 11), (370, 398, base, TRAV, 11))):
        z = 0.3 + j * 0.45
        pts = [(960 - half, bottom)]
        pts += [(960 - half + 2 * half * i / 20, top - 22 * math.sin(math.pi * i / 20)) for i in range(21)]
        pts += [(960 + half, bottom)]
        poly(pts, mat, z, 0.2)
        step = 2 * half / n
        for i in range(n):
            cx = 960 - half + (i + 0.5) * step
            lift = 22 * math.sin(math.pi * (i + 0.5) / n)
            if i:
                x = 960 - half + i * step
                B(x - 5, top + 14 - lift * 0.55, x + 5, bottom - 14, TRAV_L if j else TRAV, z + 0.24, 0.05)   # pilasters
            if j == 2 and i == n // 2:
                continue
            A(cx, top + 34 - lift * 0.55, bottom - 18, step * 0.58, SHADE, z + 0.22, 0.05)
            lit = (j == 2 and i % 3 == 1) or (j == 1 and i % 4 == 2)
            A(cx, top + 44 - lift * 0.55, bottom - 18, step * 0.40, LAMP if lit else SHADE_L, z + 0.28, 0.03)
        B(960 - half - 8, bottom - 18, 960 + half + 8, bottom - 4, TRAV_D, z + 0.32, 0.1, 3)
        pts = [(960 - half - 6, top - 6)] + [(960 - half + 2 * half * i / 20, top - 22 * math.sin(math.pi * i / 20) - 6) for i in range(21)] + [(960 + half + 6, top - 6)]
        poly(pts + [(x, y + 10) for x, y in reversed(pts)], TRAV_D, z + 0.3, 0.06)    # cornice line
    # main gate with a laurel crest
    A(960, 422, base, 124, TRAV_L, 1.55, 0.14)
    A(960, 438, base, 96, SHADE, 1.75, 0.06)
    for x in range(922, 1000, 19):
        B(x - 2.5, 452, x + 2.5, base, BRONZE, 1.84, 0.04)
    B(914, 500, 1006, 507, BRONZE, 1.9, 0.04)
    E(960, 408, 34, 34, GOLD, 1.86, 0.08)
    E(960, 408, 24, 24, POMP, 1.96, 0.05)
    laurel(960, 408, 46, 2.0)
    for i, x in enumerate((704, 804, 1116, 1216)):
        poly([(x - 28, 412), (x + 28, 412), (x + 28, 496), (x, 520), (x - 28, 496)], (POMP, PURPLE)[i % 2], 1.7, 0.07)
        B(x - 32, 406, x + 32, 414, GOLD, 1.74, 0.05, 2)
        E(x, 454, 12, 12, GOLD, 1.8, 0.05, 20)
    for x in (874, 1046):
        torch(x, 456, 540, 1.6, 0.7)
    curb(598, 1322, base)
    for x in (630, 1290):
        pot(x, base - 6, 2.6, 0.8, 'cypress')


def temple():
    """Brother Tape's Glue Temple: a Greek temple, a golden glue drop on the pediment, braziers and tape patches"""
    base, cx = 560, 1665
    B(cx - 150, 318, cx + 150, base - 40, PLASTER, 0.2, 0.15)                # cella wall behind the columns
    A(cx, 380, base - 40, 92, GOLD, 0.4, 0.06)
    A(cx, 392, base - 40, 74, SHADE, 0.5, 0.04)
    A(cx, 430, base - 40, 46, LAMP, 0.56, 0.03)
    for i in range(6):
        column(cx - 150 + i * 60, 318, base - 40, 30, 0.8)
    B(cx - 176, 290, cx + 176, 322, MARBLE, 1.1, 0.14, 2)                  # entablature with triglyphs
    for i in range(12):
        x = cx - 160 + i * 29
        B(x, 296, x + 12, 314, MARBLE_D, 1.26, 0.03)
    B(cx - 184, 282, cx + 184, 292, MARBLE, 1.3, 0.1, 2)
    pediment(cx, 284, 190, 92, 1.32)
    drop(cx, 250, 20, GOLD, 1.6, 0.08)
    drop(cx, 176, 13, GOLD, 1.4, 0.1)
    for side in (-1, 1):
        E(cx + side * 186, 280, 9, 9, GOLD, 1.6, 0.06, 16)
    for i in range(3):
        B(cx - 170 - i * 12, base - 42 + i * 13, cx + 170 + i * 12, base - 28 + i * 13, (MARBLE, MARBLE_D, MARBLE)[i], 1.8 + i * 0.1, 0.1, 2)
    for x in (cx - 196, cx + 196):                                           # bronze braziers
        for d in (-1, 1):
            poly([(x + d * 3, base - 50), (x + d * 7, base - 50), (x + d * 18, base - 4), (x + d * 14, base - 4)], BRONZE, 2.0, 0.06)
        poly([(x - 22, base - 66), (x + 22, base - 66), (x + 14, base - 48), (x - 14, base - 48)], BRONZE, 2.06, 0.1)
        B(x - 16, base - 70, x + 16, base - 64, DARK, 2.18, 0.03, 2)
        flame(x, base - 66, 0.85)
    curb(cx - 216, cx + 216, base)
    for x in (cx - 150, cx + 150):
        bush(x, base - 16, 16, 2.5, 3)


# ------------------------------------------------------------------ middle row (baseline y = 725)
def enchanter():
    """Mirra Inkwell's tholos: a round temple with a tiled cone, teal light inside and ink drops in the air"""
    base, cx = 725, 445
    B(cx - 78, 512, cx + 78, base - 34, PLASTER, 0.2, 0.16)
    A(cx, 560, base - 34, 56, GOLD, 0.4, 0.05)
    A(cx, 570, base - 34, 42, MAGIC, 0.46, 0.04)
    drop(cx, 618, 9, INK, 0.52, 0.04)
    for i in range(7):
        x = cx - 102 + i * 34
        column(x, 516, base - 34, 17, 0.7 + (0.05 if i in (0, 6) else 0.12), MARBLE)
    B(cx - 118, 494, cx + 118, 518, MARBLE, 1.0, 0.12, 3)
    B(cx - 112, 500, cx + 112, 512, MARBLE_D, 1.1, 0.03)
    for i in range(9):
        E(cx - 104 + i * 26, 506, 4, 4, TEAL, 1.14, 0.03, 10)
    pts = [(cx - 126, 496)] + [(cx - 126 * math.cos(math.pi * i / 24), 496 - 96 * math.sin(math.pi * i / 24) ** 1.3) for i in range(1, 24)] + [(cx + 126, 496)]
    poly(pts, TERRA, 1.2, 0.16)                                             # the conical tiled roof
    for k in range(-5, 6):
        x = cx + k * 22
        poly([(x - 3, 494), (cx + k * 4 - 1.5, 410), (cx + k * 4 + 1.5, 410), (x + 3, 494)], TERRA_D if k % 2 else TERRA_L, 1.36, 0.03)
    for i in range(11):
        E(cx - 120 + i * 24, 497, 5, 5, TERRA_D, 1.4, 0.05, 12)
    B(cx - 5, 380, cx + 5, 404, BRONZE, 1.42, 0.06)
    drop(cx, 380, 13, INK, 1.46, 0.08)
    for i in range(3):
        B(cx - 112 - i * 10, base - 36 + i * 12, cx + 112 + i * 10, base - 23 + i * 12, (MARBLE, MARBLE_D, MARBLE)[i], 1.6 + i * 0.1, 0.1, 2)
    for x, y, r in ((cx - 102, 430, 12), (cx + 108, 450, 10), (cx - 128, 556, 9), (cx + 126, 560, 11)):
        star(x, y, r, GOLD, 1.7)
    for x, m in ((cx - 132, TEAL), (cx + 132, PURPLE)):                     # potion amphorae
        amphora(x, base - 2, 0.7, 2.0, m)


def skills():
    """the Academy: a stoa with scroll shelves, an owl on the gable and a bronze sundial"""
    base, cx = 725, 1475
    B(cx - 120, 552, cx + 120, base - 30, PLASTER, 0.2, 0.15)
    for row in range(3):                                                    # scroll shelves on the back wall
        for i in range(4):
            x0, y0 = cx - 104 + i * 54, 578 + row * 34
            B(x0, y0, x0 + 46, y0 + 28, LAMP if (i + row) % 3 == 1 else SHADE, 0.4, 0.04, 2)
            for k in range(3):
                E(x0 + 9 + k * 14, y0 + 16, 6, 6, (CREAM, PLASTER, YELLOW)[(i + k + row) % 3], 0.46, 0.04, 14)
    tiles(cx - 130, cx + 130, 516, 552, 0.8)
    pediment(cx, 518, 78, 52, 1.1, TRAV_L, TRAV)
    E(cx, 492, 14, 17, WOOD, 1.2, 0.06, 20)                                 # the owl
    E(cx, 474, 11, 10, WOOD, 1.22, 0.06, 18)
    for d in (-1, 1):
        E(cx + d * 5, 474, 4.5, 4.5, CREAM, 1.3, 0.03, 12)
        E(cx + d * 5, 474, 2, 2, INK, 1.34, 0.02, 8)
        poly([(cx + d * 6, 466), (cx + d * 12, 458), (cx + d * 10, 468)], WOOD_D, 1.24, 0.03)
    poly([(cx - 2.5, 478), (cx + 2.5, 478), (cx, 484)], YELLOW, 1.34, 0.02)
    for i in range(5):
        column(cx - 112 + i * 56, 556, base - 30, 22, 1.4, TRAV_L)
    for i in range(3):
        B(cx - 130 - i * 10, base - 32 + i * 10, cx + 130 + i * 10, base - 21 + i * 10, (TRAV_L, TRAV, TRAV_L)[i], 1.8 + i * 0.1, 0.1, 2)
    B(cx + 152, base - 60, cx + 170, base - 6, TRAV, 2.0, 0.1, 2)          # sundial
    poly([(cx + 136, base - 62), (cx + 186, base - 62), (cx + 178, base - 72), (cx + 144, base - 72)], BRONZE, 2.12, 0.06)
    poly([(cx + 160, base - 72), (cx + 162, base - 96), (cx + 172, base - 72)], BRONZE, 2.16, 0.04)
    amphora(cx - 150, base - 4, 0.6, 2.0, TERRA)


# ------------------------------------------------------------------ front row (baseline y = 995)
def weaponsmith():
    """the weapon shop: an ochre taberna, swords on the back wall, spears in a rack, a sword on the marble counter"""
    base = 995
    B(28, 820, 262, base, OCHRE, 0.4, 0.2)
    B(28, 940, 262, base, OCHRE_D, 0.5, 0.05)                               # dado
    tiles(24, 266, 768, 822, 0.8)
    B(46, 852, 210, 950, SHOP, 0.7, 0.04)                                    # open shop front
    shutter(46, 852, 210, 942)
    for i, x in enumerate((70, 104, 138, 172)):
        gladius(x, 868, 0.8, 0.62, (STEEL, STEEL, BRONZE, STEEL)[i])
    B(52, 848, 204, 856, WOOD_D, 0.9, 0.06)
    oil_lamp(190, 874, 0.92)
    B(40, 942, 216, 958, MARBLE, 1.1, 0.12, 2)                               # counter
    B(46, 958, 210, base - 2, TRAV_D, 1.0, 0.12)
    poly([(70, 936), (180, 936), (196, 940), (180, 944), (70, 944)], STEEL, 1.3, 0.04)
    B(56, 934, 74, 946, BRONZE, 1.34, 0.05, 2)
    for x in (226, 240, 254):                                                # spears leaning on the wall
        poly([(x - 2, 990), (x + 6, 840), (x + 9, 840), (x + 1, 990)], WOOD, 1.2, 0.04)
        poly([(x + 3, 842), (x + 7.5, 812), (x + 12, 842)], STEEL, 1.26, 0.04)
    sign(134, 790, 1.5, CREAM)
    for d in (-1, 1):                                                        # crossed swords
        poly([(134 - d * 20, 812), (134 - d * 17, 815), (134 + d * 17, 776), (134 + d * 14, 772)], STEEL, 1.75, 0.04)
        B(134 - d * 18 - 5, 806, 134 - d * 18 + 5, 818, BRONZE, 1.8, 0.04, 2)
    curb(18, 272, base)
    pot(16, base - 4, 2.5, 0.8)


def forge():
    """Old Crease's forge: brick walls, a chimney, the open furnace, an anvil, bellows and a crate of scraps"""
    base = 995
    B(452, 744, 486, 820, BRICK_D, 0.2, 0.18)
    B(446, 738, 492, 750, TRAV_D, 0.4, 0.1, 2)
    for x, y, r in ((470, 724, 12), (458, 708, 15), (474, 690, 13), (462, 674, 10)):
        E(x, y, r, r * 0.85, SMOKE, 0.5, 0.05)
    B(292, 822, 512, base, BRICK, 0.4, 0.2)
    for j in range(8):                                                       # brick courses
        for i in range(9):
            if rnd.random() < 0.4:
                x = 296 + i * 26 + (13 if j % 2 else 0)
                if x + 22 < 510:
                    B(x, 830 + j * 20, x + 22, 846 + j * 20, BRICK_D, 0.6, 0.03, 2)
    tiles(288, 516, 776, 824, 0.8)
    A(372, 852, base - 6, 116, TRAV_D, 0.9, 0.12)
    A(372, 866, base - 6, 90, SHADE, 1.0, 0.05)
    E(372, 976, 30, 7, FIRE, 1.05, 0.03, 24)                              # embers; the flames come from the game
    for x, s in ((356, 0.62), (390, 0.66), (373, 0.85)):
        flame(x, 982, s, always=True)
    B(326, 978, 418, 990, DARK, 1.2, 0.06, 3)
    for x in (434, 454, 474):                                                # tongs and hammers on the wall
        B(x - 2, 852, x + 2, 912, WOOD_D, 0.9, 0.04)
        B(x - 9, 846, x + 9, 858, DARK, 0.94, 0.05, 2)
    # anvil on a stump, a hammer on top
    B(426, 952, 470, base - 2, WOOD, 1.6, 0.12, 3)
    poly([(410, 930), (480, 930), (498, 936), (482, 944), (478, 952), (418, 952), (414, 944), (404, 938)], DARK, 1.76, 0.14)
    B(414, 926, 480, 932, STEEL, 1.9, 0.04, 2)
    poly([(436, 922), (470, 908), (472, 912), (440, 926)], WOOD_L, 1.96, 0.04)
    B(462, 900, 478, 916, DARK, 1.98, 0.05, 2)
    # bellows and a crate of scraps by the door
    poly([(300, 952), (330, 940), (330, 976), (300, 966)], WOOD_L, 1.6, 0.1)
    B(296, 938, 302, 978, WOOD_D, 1.7, 0.05)
    B(486, 960, 520, base - 2, WOOD_L, 1.6, 0.1, 2)
    for x, y, m in ((492, 956, STEEL), (504, 950, BRONZE), (514, 958, STEEL)):
        poly([(x - 6, y + 4), (x, y - 6), (x + 8, y), (x + 4, y + 6)], m, 1.72, 0.03)
    poly([(300, 994), (314, 976), (334, 976), (346, 994)], TERRA, 1.62, 0.1)   # glue pot
    drop(323, 974, 6, GOLD, 1.74, 0.04)
    sign(512, 860, 1.5, CREAM, 1)
    B(508, 852, 516, 882, WOOD_D, 1.75, 0.05, 2)                             # hammer emblem
    B(496, 840, 528, 856, DARK, 1.8, 0.06, 3)
    curb(282, 522, base)


def armourer():
    """the armoury: Pompeian red and plaster, a striped awning, scuta, round shields and crested helmets"""
    base = 995
    B(540, 830, 752, base, PLASTER, 0.4, 0.2)
    B(540, 930, 752, base, POMP, 0.5, 0.05)
    B(540, 926, 752, 932, POMP_D, 0.55, 0.03)
    tiles(536, 756, 790, 832, 0.8)
    B(556, 862, 676, 952, SHOP, 0.7, 0.04)                                   # shop window
    shutter(556, 878, 676, 950)
    scutum(586, 904, 34, 64, 0.8)
    helmet(636, 906, 0.8, POMP, 0.62)
    B(552, 950, 680, 964, MARBLE, 1.1, 0.1, 2)
    oil_lamp(662, 880, 0.9)
    for i in range(6):                                                       # awning
        x = 548 + i * 23
        poly([(x + 4, 846), (x + 27, 846), (x + 23, 878), (x, 878)], POMP if i % 2 == 0 else CREAM, 1.3, 0.08)
        E(x + 11.5, 878, 11.5, 8, POMP if i % 2 == 0 else CREAM, 1.36, 0.04, 18)
    B(546, 840, 694, 850, WOOD_D, 1.42, 0.06, 3)
    door(718, 892, base, 46, 1.0)
    sign(718, 860, 1.5, CREAM, 1)
    shield_round(718, 860, 22, BLUE, BRONZE, 1.75)
    scutum(570, 980, 24, 40, 1.6, PURPLE)                                    # display leaning by the wall
    shield_round(606, 982, 15, POMP, BRONZE, 1.62)
    curb(532, 760, base)


def trainer():
    """the training yard: a small portico, sand, the palus post, a straw dummy, wooden swords and the magpie sign"""
    base = 995
    B(1172, 852, 1322, base - 10, PLASTER, 0.3, 0.15)
    B(1186, 876, 1238, 966, SHADE, 0.4, 0.04)
    window(1196, 892, 1228, 928, 0.45)
    door(1286, 900, base - 10, 40, 0.45)
    tiles(1166, 1328, 812, 852, 0.8)
    for x in (1182, 1232, 1282):
        column(x, 856, base - 12, 16, 1.0, TRAV_L, flutes=False)
    poly([(1300, 990), (1340, 950), (1476, 950), (1476, 990)], SAND, 0.2, 0.06)   # sand yard
    B(1336, 912, 1476, 954, TRAV, 0.4, 0.1, 3)                              # low yard wall
    for x in range(1344, 1470, 34):
        B(x, 904, x + 26, 914, TRAV_L, 0.52, 0.05, 2)
    straw = paper('straw', '#d9b25a', 'washi', 0.35)
    B(1442, 832, 1462, 990, WOOD, 1.0, 0.12, 3)                              # the palus
    for y in (860, 900, 940):
        B(1440, y, 1464, y + 4, WOOD_D, 1.12, 0.03)
    B(1378, 852, 1386, 990, WOOD_D, 1.2, 0.08)                               # straw dummy
    B(1352, 874, 1412, 884, WOOD, 1.3, 0.08, 3)
    E(1382, 910, 24, 36, straw, 1.4, 0.14)
    E(1382, 856, 17, 18, straw, 1.42, 0.12)
    E(1382, 910, 12, 12, POMP, 1.56, 0.04)
    E(1382, 910, 5, 5, CREAM, 1.62, 0.03)
    for dx in (-6, 6):
        for a in (-1, 1):
            poly([(1382 + dx - 4, 853 - a * 4), (1382 + dx - 1.5, 853 - a * 4), (1382 + dx + 4, 857 + a * 4), (1382 + dx + 1.5, 857 + a * 4)], DARK, 1.58, 0.03)
    B(1404, 934, 1440, 942, WOOD_D, 1.5, 0.06, 2)                            # rudis rack
    for x in (1412, 1426):
        gladius(x, 900, 1.56, 0.62, WOOD_L)
    B(1468, 800, 1474, 990, WOOD_D, 0.9, 0.06)                               # pennant
    poly([(1474, 804), (1474, 838), (1438, 821)], POMP, 0.94, 0.05)
    sign(1196, 840, 1.6, CREAM)
    E(1193, 844, 16, 10, INK, 1.85, 0.06)                                    # a magpie
    E(1206, 834, 8, 8, INK, 1.9, 0.05)
    E(1191, 848, 9, 5, WHITE, 1.94, 0.03)
    poly([(1213, 833), (1223, 836), (1213, 838)], YELLOW, 1.94, 0.04)
    poly([(1178, 840), (1162, 826), (1180, 850)], INK, 1.86, 0.05)
    curb(1162, 1482, base)


def tavern():
    """the tavern: a two-storey popina with a marble counter full of dolia, a vine pergola and amphorae"""
    base = 995
    B(1528, 770, 1868, base, OCHRE, 0.3, 0.2)
    B(1528, 868, 1868, 876, OCHRE_D, 0.4, 0.04)
    tiles(1522, 1874, 738, 776, 0.8)
    for x in (1566, 1636, 1760, 1830):                                       # upper windows
        window(x - 16, 798, x + 16, 834, 0.6)
    B(1546, 896, 1700, 962, SHOP, 0.6, 0.04)                                 # inside the popina
    shutter(1546, 900, 1700, 950)
    for x in (1568, 1600, 1632):
        amphora(x, 958, 0.55, 0.7)
    B(1590, 904, 1660, 912, WOOD_D, 0.7, 0.04)
    door(1786, 902, base, 52, 0.6, WOOD)
    # the marble counter with three dolia
    B(1536, 950, 1712, 966, MARBLE, 1.0, 0.12, 3)
    B(1542, 966, 1706, base - 2, POMP, 0.9, 0.12)
    for x in (1572, 1624, 1676):
        E(x, 958, 15, 4.5, SHADE, 1.14, 0.03, 20)
    for i, x in enumerate((1556, 1600, 1648, 1690)):
        E(x, 980, 10, 7, (YELLOW, GREEN, CREAM, YELLOW)[i], 1.0, 0.04, 14)
    # vine pergola over the front
    B(1524, 874, 1872, 884, WOOD, 1.2, 0.08, 2)
    for x in (1530, 1722, 1864):
        B(x - 4, 878, x + 4, base - 2, WOOD_D, 1.15, 0.08)
    for i in range(26):
        x = 1528 + i * 13.5 + rnd.uniform(-4, 4)
        E(x, 872 + rnd.uniform(-8, 8), rnd.uniform(10, 15), rnd.uniform(8, 11), (HEDGE, GRASS_D, CYP_L)[i % 3], 1.3 + (i % 3) * 0.05, 0.04, 14)
    for x in (1574, 1668, 1812):                                             # grapes
        for k, (dx, dy) in enumerate(((0, 0), (-5, 6), (5, 6), (0, 12), (-3, 18), (3, 18), (0, 24))):
            E(x + dx, 888 + dy, 4, 4, PURPLE, 1.36, 0.03, 10)
    for x, s in ((1858, 0.8), (1838, 0.65)):
        amphora(x, base - 2, s, 1.5 + (0.8 - s))
    torch(1741, 898, 990, 1.45, 0.6)
    sign(1528, 830, 1.6, CREAM)
    amphora(1528, 858, 0.48, 1.85, TERRA)
    curb(1516, 1890, base)
    pot(1900, base - 4, 2.5, 0.8)


# ------------------------------------------------------------------ sky layers the game animates
def sky():
    """neutral paper for the whole sky; the game multiplies it over a gradient that follows the time of day"""
    B(-30, -30, 1950, 560, SKY, 0.0, 0.1)


def sun():
    E(960, 540, 84, 84, HALO, 0.0, 0.04, 48)
    E(960, 540, 56, 56, SUN, 0.06, 0.05, 48)


def cloud(seed):
    r = random.Random(seed)
    n = 3 + seed % 2
    for j in range(n):
        E(960 + (j - (n - 1) / 2) * 50, 540 - (14 if j in (1, 2) and n == 4 or j == 1 else 0),
          r.uniform(44, 70), r.uniform(20, 30), CLOUD, 0.05 * j, 0.06)


def leaf_sprite():
    """one shutter leaf, 80x100 px around (960, 540): vertical planks, a Z brace and iron hinges on the left"""
    x0, y0, x1, y1 = 920, 490, 1000, 590
    B(x0, y0, x1, y1, WOOD_D, 0.0, 0.1, 2)
    for i in range(4):
        B(x0 + 2 + i * 19.5, y0 + 2, x0 + 19 + i * 19.5, y1 - 2, (WOOD, WOOD_L, WOOD, WOOD_L)[i], 0.12, 0.05, 2)
    for y in (y0 + 12, y1 - 20):
        B(x0 + 4, y, x1 - 4, y + 9, WOOD_D, 0.2, 0.06, 2)
    poly([(x0 + 8, y1 - 22), (x1 - 14, y0 + 22), (x1 - 6, y0 + 24), (x0 + 16, y1 - 20)], WOOD_D, 0.2, 0.05)
    for y in (y0 + 16, y1 - 16):
        B(x0, y - 3, x0 + 26, y + 3, DARK, 0.3, 0.04, 2)
        E(x0 + 22, y, 3, 3, DARK, 0.34, 0.03, 10)


def flame_sprite():
    """one paper flame, base at (960, 540); the game sways, stretches and flickers copies of it"""
    drop(960, 522, 18, FIRE, 0.0, 0.05)
    drop(960, 530, 9, FIRE_HOT, 0.08, 0.04)


# ------------------------------------------------------------------ build, manifest, render
# draw order = list order (back row first); `name` is what the town scene shows on hover. `id` matches BUILDINGS in
# src/ui/town.ts (`gear` is the player's own pack and has no building)
BUILDINGS = [
    ('trophies', 'Hall of Fame', trophies), ('leagues', 'Arena', leagues), ('temple', 'Glue Temple', temple),
    ('enchanter', 'Enchantress', enchanter), ('skills', 'Academy', skills),
    ('weaponsmith', 'Weaponsmith', weaponsmith), ('forge', 'Forge', forge), ('armourer', 'Armourer', armourer),
    ('trainer', 'Trainer', trainer), ('tavern', 'Tavern', tavern),
]
CLOUDS = 4
EXTRA = [('sky', sky), ('sun', sun), ('flame', flame_sprite), ('leaf', leaf_sprite)] + [(f'cloud{i}', (lambda i=i: cloud(i))) for i in range(CLOUDS)]
colls = {}
for key, build in [('bg', background)] + [(k, f) for k, _, f in BUILDINGS] + EXTRA:
    coll = sl.new_coll(key)
    colls[key] = coll
    layer_key = key
    build()


def pixel_box(c, pad=4):
    """integer screen rectangle around everything in a collection"""
    x0, y0, x1, y1 = sl.bbox_xy(c.all_objects)
    left, right = max(0, math.floor(W / 2 + x0 * K) - pad), min(W, math.ceil(W / 2 + x1 * K) + pad)
    top, bottom = max(0, math.floor(H / 2 - y1 * K) - pad), min(H, math.ceil(H / 2 - y0 * K) + pad)
    return left, top, right - left, bottom - top


bpy.context.view_layer.update()
boxes = {k: pixel_box(colls[k]) for k in colls if k != 'bg'}
WORLD = ['bg'] + [k for k, _, _ in BUILDINGS]
lit = {o.name: o.data.materials[0] for k in WORLD for o in colls[k].all_objects
       if o.data.materials and o.data.materials[0] in (LAMP, MAGIC, SHOP)}   # object -> its glowing material


def sprite(k):
    x, y, w, h = boxes[k]
    return dict(image=f'town_{k}.png', x=x, y=y, w=w, h=h)


fx, fy, fw, fh = boxes['flame']
manifest = {
    'size': [W, H],
    # everything below the sky is transparent where the sky shows; the game draws the sky behind it
    'background': 'town_bg.png',
    'sky': sprite('sky'),
    # sprites positioned around their centre at (960, 540) in the render; the game places and moves them
    'sun': dict(image='town_sun.png', w=boxes['sun'][2], h=boxes['sun'][3]),
    'clouds': [dict(image=f'town_cloud{i}.png', w=boxes[f'cloud{i}'][2], h=boxes[f'cloud{i}'][3]) for i in range(CLOUDS)],
    # lit windows and magic, full frame, already cut by whatever stands in front of them: fade in at dusk
    'lights': 'town_lights.png',
    # flame sprite: anchor = where its base sits (fraction of the sprite)
    'flame': dict(image='town_flame.png', w=fw, h=fh, ax=round((960 - fx) / fw, 3), ay=round((540 - fy) / fh, 3)),
    # flames to animate; `layer` = the building they belong to (draw them just above it), `always` = burns by day too
    'flames': FLAMES,
    # shop windows that close at night: two `leaf` sprites hinged at the window's left and right edges
    # `frame` = the leaf itself inside the sprite's padding: [x, y, w, h]
    'leaf': dict(image='town_leaf.png', w=boxes['leaf'][2], h=boxes['leaf'][3],
                 frame=[920 - boxes['leaf'][0], 490 - boxes['leaf'][1], 80, 100]),
    'shutters': SHUTTERS,
    # draw in this order at (x, y). The rectangle is the click area; where two overlap, the later one is on top, so
    # hit-test from the end of the list
    'buildings': [dict(id=k, name=n, **sprite(k)) for k, n, _ in BUILDINGS],
}
with open(os.path.join(OUT, 'town.json'), 'w', encoding='utf-8', newline='\n') as f:
    json.dump(manifest, f, indent=2)
    f.write('\n')

cam = sc.camera
cam.data.type = 'ORTHO'
cam.data.ortho_scale = W / K
cam.data.sensor_fit = 'HORIZONTAL'
cam.location = (0, 0, 60)
cam.rotation_euler = (0, 0, 0)
sc.render.resolution_x, sc.render.resolution_y = W, H
sc.render.film_transparent = True
sc.render.image_settings.color_mode = 'RGBA'


def lamps(on):
    for name, mat in lit.items():
        bpy.data.objects[name].data.materials[0] = mat if on else LIGHT_OFF[mat.name]


lamps(False)
for key in list(colls) + ['lights']:
    if ONLY and key not in ONLY:
        continue
    if key == 'lights':
        # every world layer visible, all but the lamps held out: the lamps come out cut by what stands in front
        lamps(True)
        for k, c in colls.items():
            c.hide_render = k not in WORLD
        # the layers were built each on its own, so stack them in draw order before they can hide one another
        cam.location.z, cam.data.clip_end = 400, 1000
        for i, k in enumerate(WORLD):
            for o in colls[k].all_objects:
                o.is_holdout = o.name not in lit
                o.location.z += 12 * i
    else:
        for k, c in colls.items():
            c.hide_render = k != key
    sc.render.use_border = sc.render.use_crop_to_border = key in boxes
    if key in boxes:
        x, y, w, h = boxes[key]
        # Blender's border is a fraction of the frame measured from the bottom left
        sc.render.border_min_x, sc.render.border_max_x = x / W, (x + w) / W
        sc.render.border_min_y, sc.render.border_max_y = 1 - (y + h) / H, 1 - y / H
    sc.render.filepath = os.path.join(OUT, f'town_{key}.png')
    bpy.ops.render.render(write_still=True)
    print('TOWN', key, boxes.get(key, (0, 0, W, H)), flush=True)
