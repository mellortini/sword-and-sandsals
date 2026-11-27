"""Pulpport town street (#29) as a layered paper diorama: an opaque background (sky, harbour, cobbled street) and
one transparent layer per building, so the town scene (#30) can light up the building under the pointer.

  python -I tools/blender.py blender/town.py -- [samples] [only,...]

`only` renders some of: bg, leagues, enchanter, temple, weaponsmith, armourer, trainer, tavern (town.json is
always rewritten in full from the geometry). Output: assets/bg/town_<id>.png + assets/bg/town.json.

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

sc = sl.setup(samples=SAMPLES, world='#eef3f8', world_strength=0.6, sun_strength=3.0)
rnd = random.Random(29)
coll = None                                      # collection the next layers go into


def P(px, py):
    return ((px - W / 2) / K, (H / 2 - py) / K)


# ------------------------------------------------------------------ materials
def paper(name, color, fiber='washi', scale=0.18):
    return sl.tex_paper(name, color, fiber, 0.85, scale=scale)


def board(name, color, kind='craft', scale=0.14):
    return sl.tex_board(name, kind, tint=color, tint_k=0.9, scale=scale, nrm=0.5)


def glow(name, color, k=1.6):
    m = bpy.data.materials.get(name)
    return m or pc.glow_mat(name, color, k)


SKY, SKY_LO, CLOUD = paper('sky', '#7db3e2', 'water', 0.07), paper('sky_lo', '#a9cdec', 'water', 0.07), paper('cloud', '#fbfaf6', 'white')
SEA, SEA_D, FOAM = paper('sea', '#3f86a8', 'water', 0.1), paper('sea_d', '#2f6d92', 'water', 0.1), paper('foam', '#cfe6ea', 'white')
STONE, STONE_D, STONE_P = paper('stone', '#ecd6b4'), paper('stone_d', '#c9a87c'), paper('stone_p', '#e7b9a0')
FAR, FAR_D = paper('far', '#c9bfc4', 'water'), paper('far_d', '#b3a6b0', 'water')
STREET, STREET_D = board('street', '#d2ad80'), board('street_d', '#b98f64')
COBBLE = [paper(f'cob{i}', c, scale=0.4) for i, c in enumerate(('#c39d74', '#d9b78c', '#b8916c', '#ccaa86'))]
WOOD, WOOD_D, WOOD_L = board('wood', '#8a5a34', 'brown', 0.2), board('wood_d', '#5c3a24', 'brown', 0.2), board('wood_l', '#b98350', 'brown', 0.2)
KRAFT, BRICK, BRICK_D = board('kraft', '#c58f5c', 'kraft'), paper('brick', '#a95a3c'), paper('brick_d', '#8a452f')
RED, CREAM, WHITE = paper('red', '#a7281f'), paper('cream', '#f3e3c2'), paper('white', '#f6f1e6', 'white')
PURPLE, PURPLE_D, TEAL = paper('purple', '#6d3f8f'), paper('purple_d', '#4a2a68'), paper('teal', '#2f8f86')
GREEN, BLUE, YELLOW = paper('green', '#4f7a42'), paper('blue', '#2f5f93'), paper('yellow', '#e3b23c')
INK, DARK, ROOF = paper('ink', '#1f1a2e', 'water'), paper('dark', '#3a2320'), paper('roof', '#7d3b2c')
GOLD = sl.foil('gold', '#e2b64a', metal=0.65, rough=0.3, emit=0.3)
STEEL = sl.foil('steel', '#c3c9d1', metal=0.7, rough=0.35, emit=0.18)
BRONZE = sl.foil('bronze', '#b9783e', metal=0.65, rough=0.38, emit=0.2)
FIRE, FIRE_HOT = glow('fire', '#ff7a1a', 1.5), glow('fire_hot', '#ffd25a', 1.7)
LAMP, MAGIC = glow('lamp', '#ffbe55', 1.15), glow('magic', '#69e6d2', 1.15)


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


def E(cx, cy, rx, ry, mat, z=0.0, h=0.1, n=40):
    return poly([(cx + rx * math.cos(i / n * math.tau), cy + ry * math.sin(i / n * math.tau)) for i in range(n)], mat, z, h)


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


def window(cx, top, bottom, w, frame, light, z, cross=True):
    A(cx, top - 7, bottom + 6, w + 14, frame, z, 0.1)
    A(cx, top, bottom, w, light, z + 0.12, 0.04)
    if cross:
        B(cx - 2.5, top, cx + 2.5, bottom, frame, z + 0.18, 0.04)
        B(cx - w / 2, (top + bottom) / 2, cx + w / 2, (top + bottom) / 2 + 5, frame, z + 0.18, 0.04)


def door(cx, top, bottom, w, z, leaf=None):
    A(cx, top - 9, bottom, w + 18, STONE_D, z, 0.1)
    A(cx, top, bottom, w, leaf or WOOD_D, z + 0.12, 0.06)
    for k in (-0.22, 0.0, 0.22):
        B(cx + k * w - 1.5, top + 14, cx + k * w + 1.5, bottom - 4, WOOD, z + 0.2, 0.03)
    E(cx + w * 0.3, (top + bottom) / 2 + 10, 5, 5, GOLD, z + 0.24, 0.05, 16)


def bricks(x0, y0, x1, y1, mat, z, step=(46, 22), keep=0.35):
    for j in range(int((y1 - y0) / step[1])):
        for i in range(int((x1 - x0) / step[0])):
            if rnd.random() < keep:
                x = x0 + i * step[0] + (step[0] / 2 if j % 2 else 0)
                y = y0 + j * step[1]
                if x + step[0] - 5 <= x1:
                    B(x, y, x + step[0] - 5, y + step[1] - 5, mat, z, 0.03, 3)


def shingles(apex, left, right, base, mat, z, rows=5):
    """a gable roof: one dark triangle with scalloped rows on top"""
    poly([(left, base), (apex[0], apex[1]), (right, base)], mat, z, 0.16)
    for j in range(rows):
        y = apex[1] + (base - apex[1]) * (j + 1) / rows
        k = (j + 1) / rows
        xa, xb = apex[0] + (left - apex[0]) * k, apex[0] + (right - apex[0]) * k
        n = max(1, int((xb - xa) / 28))
        for i in range(n):
            cx = xa + (i + 0.5) * (xb - xa) / n
            E(cx, y - 5, (xb - xa) / n / 2 - 1, 9, mat, z + 0.14 + j * 0.012, 0.04, 20)


def sign(cx, cy, z, ground=WOOD_L):
    """hanging round sign board; the emblem goes on top at z + 0.25"""
    for dx in (-24, 24):
        B(cx + dx - 2, cy - 62, cx + dx + 2, cy - 30, DARK, z, 0.05)
    B(cx - 44, cy - 68, cx + 44, cy - 60, DARK, z + 0.02, 0.08, 3)
    E(cx, cy, 42, 42, DARK, z + 0.08, 0.08)
    E(cx, cy, 35, 35, ground, z + 0.17, 0.05)


def curb(x0, x1, y, mat=STONE_D):
    """the step a building stands on; it grounds the cut-out on the street"""
    B(x0, y - 6, x1, y + 16, mat, 2.4, 0.2, 6)
    B(x0 + 8, y + 12, x1 - 8, y + 24, STREET_D, 2.3, 0.08, 5)


# ------------------------------------------------------------------ background
def background():
    B(-30, -30, 1950, 470, SKY, 0.0, 0.1)
    B(-30, 150, 1950, 470, SKY_LO, 0.12, 0.05)
    for i in range(10):
        cx, cy = 60 + i * 205 + rnd.uniform(-50, 50), rnd.uniform(55, 175)
        for j in range(3):
            E(cx + (j - 1) * 52, cy - (16 if j == 1 else 0), rnd.uniform(48, 78), rnd.uniform(26, 38), CLOUD, 0.25 + j * 0.05, 0.07)
    # far port town and cranes on the horizon (pale = distance)
    x = -20
    while x < 1940:
        bw, bh = rnd.uniform(60, 120), rnd.uniform(40, 105)
        mat = FAR if rnd.random() < 0.6 else FAR_D
        B(x, 372 - bh, x + bw, 400, mat, 0.45, 0.06)
        poly([(x - 6, 372 - bh), (x + bw / 2, 372 - bh - rnd.uniform(18, 36)), (x + bw + 6, 372 - bh)], FAR_D, 0.52, 0.05)
        x += bw + rnd.uniform(-8, 14)
    # sea with ships on both sides of the arena
    B(-30, 390, 1950, 520, SEA, 0.7, 0.1)
    for i, y in enumerate((412, 438, 468, 496)):
        for x in range(-20 + (i % 2) * 45, 1940, 92):
            poly([(x, y), (x + 23, y - 7), (x + 46, y), (x + 23, y - 2)], FOAM if i % 2 else SEA_D, 0.85 + i * 0.01, 0.03)
    for bx, s in ((95, 1.0), (520, 0.7), (1395, 0.75), (1830, 1.05)):
        B(bx - 3, 430 - 170 * s, bx + 3, 430, WOOD_D, 0.95, 0.05)
        poly([(bx + 5, 430 - 162 * s), (bx + 68 * s, 430 - 60 * s), (bx + 5, 430 - 48 * s)], CREAM, 1.0, 0.05)
        poly([(bx - 5, 430 - 150 * s), (bx - 52 * s, 430 - 56 * s), (bx - 5, 430 - 48 * s)], WHITE, 1.0, 0.05)
        poly([(bx + 3, 430 - 170 * s), (bx + 34 * s, 430 - 162 * s), (bx + 3, 430 - 152 * s)], RED, 1.02, 0.04)
        poly([(bx - 70 * s, 428), (bx + 80 * s, 428), (bx + 52 * s, 462), (bx - 46 * s, 462)], WOOD, 1.1, 0.12)
    # quay wall, then the upper terrace the back row stands on
    B(-30, 505, 1950, 580, STONE_D, 1.3, 0.16)
    bricks(-30, 512, 1950, 578, STONE, 1.48, (74, 22), 0.55)
    B(-30, 562, 1950, 700, STREET_D, 1.55, 0.14)
    # steps down to the lower street
    for i in range(3):
        B(-30, 628 + i * 24, 1950, 655 + i * 24, (STONE, STONE_D, STONE_P)[i], 1.72 + i * 0.04, 0.08)
    # lower street and cobbles, growing towards the viewer
    B(-30, 700, 1950, 1110, STREET, 1.9, 0.14)
    y, row = 716.0, 0
    while y < 1100:
        s = 0.65 + (y - 700) / 560
        x = -30 + (row % 2) * 26 * s
        while x < 1950:
            w = rnd.uniform(40, 62) * s
            E(x + w / 2, y + rnd.uniform(-3, 3), w / 2 - 2, 9.5 * s, rnd.choice(COBBLE), 2.06, 0.04, 14)
            x += w + 5 * s
        y += 24 * s
        row += 1
    # the road up to the arena
    poly([(865, 566), (1055, 566), (1180, 1110), (740, 1110)], paper('road', '#e6c998'), 2.14, 0.04)
    flag = [paper(f'flag{i}', c, scale=0.3) for i, c in enumerate(('#efd6a8', '#dcbd8c', '#e2c597'))]
    y, row = 578.0, 0
    while y < 1085:                                         # its flagstones
        k = (y - 566) / 544
        left, right, tall = 865 - 125 * k + 9, 1055 + 125 * k - 9, 13 + 34 * k
        n = 3 + row % 2
        cuts = [left] + [left + (right - left) * (i + rnd.uniform(-0.18, 0.18)) / n for i in range(1, n)] + [right]
        for a, b in zip(cuts, cuts[1:]):
            B(a + 3, y, b - 3, y + tall - 5, rnd.choice(flag), 2.2, 0.03, 5)
        y += tall
        row += 1
    for x in (760, 1165):                                   # lamp posts beside the road
        B(x - 5, 640, x + 5, 872, DARK, 2.3, 0.12)
        B(x - 18, 868, x + 18, 882, STONE_D, 2.34, 0.14, 5)
        poly([(x - 20, 612), (x + 20, 612), (x + 13, 646), (x - 13, 646)], DARK, 2.36, 0.12)
        poly([(x - 14, 616), (x + 14, 616), (x + 9, 642), (x - 9, 642)], LAMP, 2.52, 0.04)
        poly([(x - 24, 614), (x, 594), (x + 24, 614)], DARK, 2.55, 0.08)


# ------------------------------------------------------------------ back row (baseline y = 590)
def leagues():
    """the arena: three storeys of arches, banners and flags"""
    base = 590
    for i, (x, top) in enumerate(((690, 150), (960, 112), (1230, 150))):
        B(x - 3, top - 62, x + 3, top + 40, WOOD_D, 0.1, 0.06)
        poly([(x + 3, top - 62), (x + 62, top - 49), (x + 3, top - 34)], (RED, PURPLE, RED)[i], 0.14, 0.05)
    for j, (half, top, bottom, mat, n) in enumerate(((270, 175, 300, STONE_P, 11), (315, 288, 425, STONE, 11), (355, 410, base, STONE, 11))):
        z = 0.3 + j * 0.45
        pts = [(960 - half, bottom)]
        pts += [(960 - half + 2 * half * i / 20, top - 22 * math.sin(math.pi * i / 20)) for i in range(21)]
        pts += [(960 + half, bottom)]
        poly(pts, mat, z, 0.2)
        step = 2 * half / n
        for i in range(n):
            cx = 960 - half + (i + 0.5) * step
            if j == 2 and i == n // 2:
                continue
            lift = 22 * math.sin(math.pi * (i + 0.5) / n)
            A(cx, top + 34 - lift * 0.55, bottom - 18, step * 0.58, DARK, z + 0.22, 0.05)
            A(cx, top + 44 - lift * 0.55, bottom - 18, step * 0.40, BRICK_D, z + 0.28, 0.03)
        B(960 - half - 8, bottom - 18, 960 + half + 8, bottom - 4, STONE_D, z + 0.32, 0.1, 3)
    # main gate with a laurel crest
    A(960, 452, base, 124, STONE_P, 1.55, 0.14)
    A(960, 468, base, 96, DARK, 1.75, 0.06)
    for x in range(922, 1000, 19):
        B(x - 2.5, 482, x + 2.5, base, BRONZE, 1.84, 0.04)
    B(914, 530, 1006, 537, BRONZE, 1.9, 0.04)
    E(960, 438, 34, 34, GOLD, 1.86, 0.08)
    E(960, 438, 24, 24, RED, 1.96, 0.05)
    for side in (-1, 1):
        for i in range(5):
            a = math.radians(115 - i * 27)
            E(960 + side * 46 * math.sin(a), 438 - 46 * math.cos(a), 7, 12, GREEN, 2.0, 0.04, 14)
    for i, x in enumerate((710, 810, 1110, 1210)):
        poly([(x - 28, 428), (x + 28, 428), (x + 28, 512), (x, 536), (x - 28, 512)], (RED, PURPLE)[i % 2], 1.7, 0.07)
        E(x, 470, 12, 12, GOLD, 1.8, 0.05, 20)
    curb(598, 1322, base)


def enchanter():
    """Mirra Inkwell: a crooked purple tower, ink drips and cold light"""
    base = 590
    poly([(205, base), (222, 360), (248, 262), (408, 252), (425, 420), (440, base)], PURPLE, 0.3, 0.3)
    poly([(190, 280), (268, 190), (300, 86), (352, 128), (330, 134), (366, 196), (466, 272), (412, 262), (326, 292), (246, 270)], INK, 0.75, 0.22)
    poly([(318, 282), (352, 214), (344, 148), (370, 200), (440, 268)], PURPLE_D, 1.0, 0.07)
    for x, d in ((222, 32), (262, 18), (300, 44), (352, 22), (398, 36)):      # ink dripping off the eaves
        B(x - 6, 268, x + 6, 272 + d, INK, 1.05, 0.05, 6)
        drop(x, 276 + d, 8, INK, 1.1, 0.05)
    E(320, 332, 46, 46, GOLD, 1.0, 0.08)
    E(320, 332, 37, 37, MAGIC, 1.1, 0.04)
    B(317, 295, 323, 369, PURPLE_D, 1.16, 0.04)
    B(283, 329, 357, 335, PURPLE_D, 1.16, 0.04)
    door(286, 470, base, 78, 1.0, PURPLE_D)
    window(386, 452, 522, 40, PURPLE_D, MAGIC, 1.0)
    sign(470, 424, 1.25, CREAM)
    B(405, 358, 470, 364, DARK, 1.2, 0.06)
    B(458, 398, 482, 414, TEAL, 1.5, 0.05, 3)
    E(470, 434, 25, 21, INK, 1.52, 0.06)
    drop(470, 436, 9, MAGIC, 1.62, 0.04)
    for x, y, r, m in ((190, 570, 22, TEAL), (160, 576, 15, PURPLE_D), (430, 574, 18, INK)):
        E(x, y, r, r, m, 2.0, 0.12)
        B(x - r * 0.35, y - r - 13, x + r * 0.35, y - r + 3, WOOD_L, 2.06, 0.08, 3)
    for x, y in ((205, 190), (432, 150), (472, 226), (176, 330)):
        poly([(x, y - 13), (x + 4, y - 4), (x + 13, y), (x + 4, y + 4), (x, y + 13), (x - 4, y + 4), (x - 13, y), (x - 4, y - 4)], GOLD, 1.3, 0.05)
    curb(150, 452, base, PURPLE_D)


def temple():
    """Brother Tape's Glue Temple: columns, pediment, a golden drop of glue, tape patches"""
    base = 590
    B(1478, 322, 1782, base, STONE, 0.3, 0.2)
    poly([(1448, 322), (1630, 206), (1812, 322)], CREAM, 0.8, 0.22)
    poly([(1484, 312), (1630, 220), (1776, 312)], STONE_P, 1.04, 0.05)
    B(1456, 318, 1804, 346, CREAM, 1.15, 0.14, 4)
    drop(1630, 284, 21, GOLD, 1.2, 0.08)
    drop(1630, 190, 14, GOLD, 1.0, 0.1)
    A(1630, 400, base, 108, GOLD, 0.62, 0.08)
    A(1630, 412, base, 88, DARK, 0.74, 0.04)
    A(1630, 452, base, 52, LAMP, 0.8, 0.03)
    for x in (1498, 1550, 1710, 1762):
        B(x - 15, 350, x + 15, 558, WHITE, 1.3, 0.2, 7)
        for dx in (-5, 5):
            B(x + dx - 1.5, 366, x + dx + 1.5, 548, STONE_D, 1.52, 0.02)
        B(x - 23, 346, x + 23, 366, CREAM, 1.54, 0.1, 5)
        B(x - 22, 550, x + 22, 570, CREAM, 1.54, 0.1, 5)
    tape = paper('tape', '#d9c58a', 'white')
    for x, y, a in ((1540, 276, -24), (1716, 300, 30), (1704, 486, -12), (1552, 520, 18)):
        c, s = math.cos(math.radians(a)), math.sin(math.radians(a))
        poly([(x + u * c - v * s, y + u * s + v * c) for u, v in ((-34, -10), (34, -10), (31, -3), (35, 3), (31, 10), (-34, 10), (-30, 3), (-35, -3))], tape, 1.7, 0.03)
    for i in range(3):
        B(1478 - i * 16, 556 + i * 12, 1782 + i * 16, 570 + i * 12, (CREAM, WHITE, CREAM)[i], 1.8 + i * 0.12, 0.1, 3)
    for x in (1424, 1836):                                  # glue pots with candles
        poly([(x - 23, 548), (x + 23, 548), (x + 15, 590), (x - 15, 590)], BRONZE, 2.0, 0.14)
        drop(x, 536, 11, FIRE, 2.1, 0.04)
        drop(x, 540, 5, FIRE_HOT, 2.16, 0.03)
    curb(1404, 1856, base)


# ------------------------------------------------------------------ front row (baseline y = 890)
def weaponsmith():
    """Old Crease's forge: brick, chimney, open fire, anvil and blades on the wall"""
    base = 890
    B(86, 628, 142, 700, BRICK_D, 0.2, 0.2)
    B(78, 620, 150, 636, STONE_D, 0.45, 0.12, 3)
    for x, y, r in ((106, 608, 13), (85, 598, 16), (62, 592, 11)):      # smoke drifts away from the enchantress
        E(x, y, r, r * 0.85, paper('smoke', '#b9b2b4', 'water'), 0.5, 0.06)
    B(52, 692, 388, base, BRICK, 0.6, 0.22)
    bricks(60, 700, 382, 880, BRICK_D, 0.84)
    poly([(28, 704), (92, 622), (360, 622), (414, 704)], KRAFT, 1.0, 0.18)
    for x in range(106, 360, 31):                          # corrugated ribs
        poly([(x, 630), (x + 11, 630), (x + 11 + (x - 220) * 0.19, 696), (x + (x - 220) * 0.19, 696)], WOOD_L, 1.2, 0.05)
    B(28, 696, 414, 712, WOOD_D, 1.3, 0.1, 3)
    A(152, 748, base, 146, STONE_D, 1.0, 0.14)
    A(152, 764, base, 116, DARK, 1.2, 0.05)
    poly([(104, 866), (112, 826), (128, 842), (140, 794), (158, 830), (178, 806), (200, 866)], FIRE, 1.3, 0.04)
    poly([(124, 866), (134, 840), (146, 850), (155, 822), (170, 866)], FIRE_HOT, 1.38, 0.04)
    B(96, 862, 208, 880, DARK, 1.44, 0.08, 4)
    for x, tip in ((262, 748), (292, 734), (322, 752)):    # swords on a rack
        poly([(x - 7, 828), (x - 7, tip + 16), (x, tip), (x + 7, tip + 16), (x + 7, 828)], STEEL, 1.0, 0.06)
        B(x - 18, 826, x + 18, 836, BRONZE, 1.1, 0.06, 3)
        B(x - 5, 836, x + 5, 862, WOOD_D, 1.08, 0.06, 3)
    B(242, 790, 344, 800, WOOD, 1.2, 0.06)
    sign(362, 756, 1.5)
    B(357, 746, 367, 786, WOOD_D, 1.8, 0.06, 3)
    B(338, 732, 386, 754, STEEL, 1.88, 0.08, 4)
    poly([(236, 868), (330, 868), (352, 878), (322, 884), (318, 892), (258, 892), (254, 884), (236, 878)], DARK, 2.0, 0.16)
    B(264, 890, 312, 904, DARK, 2.02, 0.14)
    B(236, 863, 330, 870, STEEL, 2.2, 0.05, 2)
    curb(30, 412, 892)


def shield_shape(cx, cy, r, face, rim, z, boss=GOLD):
    E(cx, cy, r, r, rim, z, 0.1)
    E(cx, cy, r * 0.78, r * 0.78, face, z + 0.12, 0.05)
    E(cx, cy, r * 0.24, r * 0.24, boss, z + 0.2, 0.07)


def helmet(cx, cy, z, crest=RED):
    poly([(cx - 8, cy - 28), (cx - 20, cy - 50), (cx + 10, cy - 52), (cx + 30, cy - 34), (cx + 10, cy - 26)], crest, z, 0.06)
    A(cx, cy - 32, cy + 16, 56, STEEL, z + 0.08, 0.1)
    B(cx - 34, cy + 4, cx + 34, cy + 14, BRONZE, z + 0.2, 0.06, 4)
    B(cx - 16, cy + 14, cx + 16, cy + 30, DARK, z + 0.1, 0.05, 3)
    B(cx - 3, cy + 8, cx + 3, cy + 30, STEEL, z + 0.24, 0.05)


def armourer():
    """the armoury: pale stone, striped awning, shields and helmets in the window"""
    base = 890
    B(448, 640, 720, base, STONE, 0.5, 0.22)
    bricks(454, 648, 714, 880, STONE_D, 0.74, (52, 24), 0.22)
    for x in range(448, 700, 54):                          # crenellated parapet
        B(x, 612, x + 34, 646, STONE, 0.5, 0.2, 3)
    B(440, 640, 728, 656, STONE_P, 0.9, 0.1, 3)
    B(466, 752, 620, 862, WOOD_D, 0.9, 0.1, 5)
    B(476, 762, 610, 852, DARK, 1.02, 0.04, 3)
    shield_shape(512, 808, 31, RED, BRONZE, 1.1)
    helmet(574, 822, 1.1)
    B(466, 858, 620, 874, WOOD_L, 1.5, 0.12, 3)
    for i in range(8):                                      # awning
        x = 456 + i * 22
        poly([(x + 6, 706), (x + 28, 706), (x + 22, 746), (x, 746)], RED if i % 2 == 0 else CREAM, 1.5, 0.1)
        E(x + 11, 746, 11, 9, RED if i % 2 == 0 else CREAM, 1.56, 0.05, 18)
    B(458, 698, 634, 712, WOOD_D, 1.65, 0.08, 3)
    door(668, 758, base, 62, 1.0)
    sign(668, 696, 1.7, CREAM)
    shield_shape(668, 696, 25, BLUE, STEEL, 1.98)
    curb(436, 732, 892)


def trainer():
    """Magpie's yard: a fence, a straw dummy, practice swords and a hut patched with old newspapers"""
    base = 890
    news = pc.pattern_mat('news', 'hstripes', '#e8dfc8', '#8d857a', freq=7.0, ratio=0.68, wobble=0.02)
    B(1306, 690, 1452, base, KRAFT, 0.4, 0.2)
    poly([(1290, 700), (1379, 618), (1468, 700)], WOOD_D, 0.7, 0.18)
    poly([(1316, 690), (1379, 634), (1442, 690)], news, 0.92, 0.05)
    door(1376, 762, base, 66, 0.7)
    B(1320, 720, 1360, 752, news, 0.9, 0.05)
    B(1405, 726, 1440, 766, news, 0.96, 0.05)
    B(1548, 580, 1556, base, WOOD_D, 0.5, 0.1)             # pennant pole
    poly([(1556, 584), (1642, 604), (1556, 628)], INK, 0.7, 0.06)
    poly([(1556, 596), (1604, 605), (1556, 616)], WHITE, 0.8, 0.04)
    for x in range(1466, 1624, 26):                        # fence
        poly([(x, 790), (x + 9, 776), (x + 18, 790), (x + 18, base), (x, base)], WOOD_L, 0.9, 0.1)
    for y in (806, 850):
        B(1456, y, 1628, y + 11, WOOD, 1.1, 0.07)
    straw = paper('straw', '#d9b25a', 'washi', 0.35)       # training dummy
    B(1503, 742, 1513, base, WOOD_D, 1.4, 0.1)
    B(1466, 768, 1550, 779, WOOD, 1.5, 0.1, 3)
    E(1508, 802, 29, 42, straw, 1.62, 0.16)
    E(1508, 736, 21, 22, straw, 1.64, 0.14)
    for dx in (-8, 8):
        for a in (-1, 1):
            poly([(1508 + dx - 5, 733 - a * 5), (1508 + dx - 2, 733 - a * 5), (1508 + dx + 5, 733 + a * 5), (1508 + dx + 2, 733 + a * 5)], DARK, 1.82, 0.03)
    E(1508, 806, 15, 15, RED, 1.82, 0.05)
    E(1508, 806, 6, 6, CREAM, 1.9, 0.03)
    B(1560, 812, 1636, 822, WOOD_D, 1.8, 0.08, 3)          # rack of wooden swords
    for x in (1574, 1598, 1622):
        poly([(x - 5, 866), (x - 5, 770), (x, 758), (x + 5, 770), (x + 5, 866)], WOOD_L, 1.9, 0.07)
        B(x - 12, 826, x + 12, 834, WOOD_D, 2.0, 0.05, 2)
    sign(1288, 746, 1.5, CREAM)
    E(1285, 750, 20, 12, INK, 1.8, 0.06)                   # a magpie
    E(1300, 738, 10, 10, INK, 1.86, 0.05)
    E(1283, 755, 11, 6, WHITE, 1.9, 0.03)
    poly([(1308, 737), (1320, 741), (1308, 743)], YELLOW, 1.9, 0.04)
    poly([(1270, 746), (1250, 728), (1272, 757)], INK, 1.82, 0.05)
    curb(1262, 1640, 892, WOOD_D)


def tavern():
    """the tavern: timber frame, steep tiled roof, warm windows, barrels and a mug"""
    base = 890
    B(1812, 596, 1846, 668, BRICK, 0.2, 0.18)
    B(1692, 696, 1882, base, CREAM, 0.5, 0.2)
    shingles((1788, 590), 1656, 1914, 704, ROOF, 0.9)
    B(1678, 698, 1894, 714, WOOD_D, 1.3, 0.12, 3)
    for x in (1694, 1760, 1816, 1870):
        B(x, 708, x + 12, base, WOOD_D, 0.75, 0.08)
    B(1692, 788, 1882, 799, WOOD_D, 0.85, 0.08)
    for x0, x1 in ((1706, 1760), (1828, 1870)):
        poly([(x0, 788), (x0 + 8, 788), (x1, 714), (x1 - 8, 714)], WOOD_D, 0.8, 0.05)
    window(1788, 622, 668, 34, WOOD_D, LAMP, 1.4)
    window(1733, 726, 772, 36, WOOD_D, LAMP, 1.0)
    window(1844, 726, 772, 36, WOOD_D, LAMP, 1.0)
    door(1788, 808, base, 54, 1.0, WOOD)
    window(1844, 820, 856, 34, WOOD_D, LAMP, 1.0, cross=False)
    sign(1668, 760, 1.5)
    B(1648, 746, 1680, 784, YELLOW, 1.82, 0.08, 5)         # mug with foam
    B(1676, 752, 1694, 776, YELLOW, 1.8, 0.05, 8, holes=[box(1677, 758, 1688, 770, 5)])
    for x, y, r in ((1654, 744, 10), (1668, 741, 11), (1679, 746, 8)):
        E(x, y, r, r * 0.8, WHITE, 1.94, 0.05)
    for cx, cy, s in ((1698, 862, 1.0), (1888, 866, 0.9), (1724, 876, 0.75)):
        z = 2.0 + (1 - s) * 0.8
        poly([(cx - 20 * s, cy - 32 * s), (cx + 20 * s, cy - 32 * s), (cx + 27 * s, cy), (cx + 20 * s, cy + 32 * s),
              (cx - 20 * s, cy + 32 * s), (cx - 27 * s, cy)], WOOD, z, 0.14)
        for dy in (-18, 18):
            B(cx - 25 * s, cy + dy * s - 3, cx + 25 * s, cy + dy * s + 3, DARK, z + 0.16, 0.04)
    curb(1642, 1912, 892)


# ------------------------------------------------------------------ build, manifest, render
# draw order = list order (the back row first); `name` is what the town scene shows on hover
BUILDINGS = [
    ('leagues', 'Arena', leagues), ('enchanter', 'Enchantress', enchanter), ('temple', 'Glue Temple', temple),
    ('weaponsmith', 'Weaponsmith', weaponsmith), ('armourer', 'Armourer', armourer),
    ('trainer', 'Trainer', trainer), ('tavern', 'Tavern', tavern),
]
colls = {}
for key, build in [('bg', background)] + [(k, f) for k, _, f in BUILDINGS]:
    coll = sl.new_coll(key)
    colls[key] = coll
    build()


def pixel_box(c, pad=4):
    """integer screen rectangle around everything in a collection"""
    x0, y0, x1, y1 = sl.bbox_xy(c.all_objects)
    left, right = max(0, math.floor(W / 2 + x0 * K) - pad), min(W, math.ceil(W / 2 + x1 * K) + pad)
    top, bottom = max(0, math.floor(H / 2 - y1 * K) - pad), min(H, math.ceil(H / 2 - y0 * K) + pad)
    return left, top, right - left, bottom - top


bpy.context.view_layer.update()
boxes = {k: pixel_box(colls[k]) for k, _, _ in BUILDINGS}
manifest = {
    'size': [W, H],
    'background': 'town_bg.png',
    # draw in this order at (x, y). The rectangle is the click area; where two overlap, the later one is on top, so
    # hit-test from the end of the list
    'buildings': [dict(id=k, name=n, image=f'town_{k}.png', x=boxes[k][0], y=boxes[k][1], w=boxes[k][2], h=boxes[k][3])
                  for k, n, _ in BUILDINGS],
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

for key in colls:
    if ONLY and key not in ONLY:
        continue
    for k, c in colls.items():
        c.hide_render = k != key
    sc.render.film_transparent = key != 'bg'
    sc.render.image_settings.color_mode = 'RGB' if key == 'bg' else 'RGBA'
    sc.render.use_border = sc.render.use_crop_to_border = key != 'bg'
    if key != 'bg':
        x, y, w, h = boxes[key]
        # Blender's border is a fraction of the frame measured from the bottom left
        sc.render.border_min_x, sc.render.border_max_x = x / W, (x + w) / W
        sc.render.border_min_y, sc.render.border_max_y = 1 - (y + h) / H, 1 - y / H
    sc.render.filepath = os.path.join(OUT, f'town_{key}.png')
    bpy.ops.render.render(write_still=True)
    print('TOWN', key, boxes.get(key, (0, 0, W, H)), flush=True)
