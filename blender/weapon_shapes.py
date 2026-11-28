"""Shapes of the weapon pictures for the shop boards: 5 families x 10 tiers, layered cut paper (plain Python, no bpy).

Drawn upright: x centred on the weapon, y up (0 .. about 1000). weapon_icons.py renders them. These are pictures only:
the puppet's own sprites are built by weapons.py. Each tier keeps the materials of its armour set (armor.py):
1 scrapwood and rags, 2 pressed pulp, 3 layered card, 4 riveted card, 5 bronze, 6 iron, 7 steel and chain,
8 legion (brass, red), 9 champion (bronze, gold, dark red), 10 gilded legend (gold, purple, laurel).

Parts, back to front:
  ('rod',   mat, x, y0, y1, r, grain)       round haft or grip; grain = material of the shaded strip, or None
  ('wraps', mat, x, y0, y1, r, turns, lean) bands wound on a rod; lean -1 crosses them the other way
  ('blade', style, x, [(y, halfwidth)...])  double edged blade in three layers, last halfwidth 0 = the point
  ('poly',  mat, [(x, y)...])               one flat piece
  ('dots',  mat, [(x, y, r)...])            discs on one layer (rivets, gems, pommels)
"""
import math
import random

FAMILIES = ('sword', 'axe', 'spear', 'hammer', 'trident')

# blade style -> (outline layer, face layer, ridge layer)
BLADES = {
    'wood': ('scrap_s', 'scrap', 'scrap_s'),
    'pulp': ('pulp_s', 'pulp', 'pulp_hi'),
    'card': ('card_s', 'card', 'white'),
    'hide': ('leather_d', 'hide', 'hide_hi'),
    'bronze': ('bronze_s', 'bronze', 'bronze_hi'),
    'iron': ('iron_d', 'iron', 'iron_s'),
    'steel': ('steel_s', 'steel', 'steel_hi'),
    'gilded': ('gold', 'steel', 'gold_s'),
}

# per tier: haft, haft grain, wrapping, head, head shadow, head edge, fittings, blade style
TIER = {
    1: ('scrap', 'scrap_s', 'rag', 'scrap', 'scrap_s', 'scrap_hi', 'rag_d', 'wood'),
    2: ('wood', 'wood_s', 'leather_d', 'pulp', 'pulp_s', 'pulp_hi', 'leather_d', 'pulp'),
    3: ('hide', 'hide_s', 'linen_d', 'card', 'card_s', 'white', 'linen_d', 'card'),
    4: ('wood', 'wood_s', 'leather', 'hide', 'leather_d', 'hide_hi', 'bronze_s', 'hide'),
    5: ('wood', 'wood_s', 'leather', 'bronze', 'bronze_s', 'bronze_hi', 'bronze_s', 'bronze'),
    6: ('wood_d', 'wood_dd', 'leather_d', 'iron', 'iron_d', 'iron_hi', 'iron_s', 'iron'),
    7: ('wood_d', 'wood_dd', 'chain', 'steel_s', 'iron', 'steel_hi', 'iron_s', 'steel'),
    8: ('wood_d', 'wood_dd', 'red', 'steel_s', 'iron', 'steel_hi', 'brass', 'steel'),
    9: ('wood_dd', 'iron_d', 'red_d', 'steel_s', 'iron', 'steel_hi', 'gold', 'steel'),
    10: ('purple', 'purple_d', 'gold', 'steel', 'steel_s', 'gold_s', 'gold', 'gilded'),
}


def smooth(pts, n=8):
    """Catmull-Rom through (y, w) control points."""
    out = []
    for i in range(len(pts) - 1):
        p0, p1, p2, p3 = pts[max(i - 1, 0)], pts[i], pts[i + 1], pts[min(i + 2, len(pts) - 1)]
        for k in range(n):
            t = k / n
            out.append(tuple(0.5 * (2 * b + (c - a) * t + (2 * a - 5 * b + 4 * c - d) * t * t + (3 * b - 3 * c + d - a) * t ** 3)
                             for a, b, c, d in zip(p0, p1, p2, p3)))
    out.append(pts[-1])
    return out


def arc(cx, cy, rx, ry, a0, a1, n=28):
    return [(cx + rx * math.cos(math.radians(a0 + (a1 - a0) * i / n)), cy + ry * math.sin(math.radians(a0 + (a1 - a0) * i / n)))
            for i in range(n + 1)]


def box(x0, y0, x1, y1, c=0.0):
    """rectangle with cut corners"""
    return [(x0 + c, y0), (x1 - c, y0), (x1, y0 + c), (x1, y1 - c), (x1 - c, y1), (x0 + c, y1), (x0, y1 - c), (x0, y0 + c)]


def oval(cx, cy, rx, ry, turn=0.0, n=28):
    ca, sa = math.cos(turn), math.sin(turn)
    return [(cx + rx * math.cos(a) * ca - ry * math.sin(a) * sa, cy + rx * math.cos(a) * sa + ry * math.sin(a) * ca)
            for a in (2 * math.pi * i / n for i in range(n))]


def torn(pts, amp, seed, step=26):
    """a hand-torn outline: the edges are split into short pieces and nudged"""
    rnd = random.Random(seed)
    out = []
    for i, (x0, y0) in enumerate(pts):
        x1, y1 = pts[(i + 1) % len(pts)]
        k = max(1, int(math.hypot(x1 - x0, y1 - y0) / step))
        for j in range(k):
            t = j / k
            out.append((x0 + (x1 - x0) * t + rnd.uniform(-amp, amp), y0 + (y1 - y0) * t + rnd.uniform(-amp, amp)))
    return out


def mirror(pts, x):
    return [(2 * x - px, py) for px, py in reversed(pts)]


def laurel(x, y, n=3, gap=34, reach=24):
    """sprigs of leaves climbing from (x, y)"""
    return [('poly', 'laurel', oval(x + s * reach, y + i * gap, 25, 10, s * 0.75)) for i in range(n) for s in (1, -1)]


def tassel(x, y, mat, length=150):
    return [('poly', mat, [(x - 8, y), (x - 40, y - length * 0.55), (x - 34, y - length), (x - 20, y - length * 0.6), (x, y - 10)]),
            ('poly', mat, [(x + 8, y), (x + 40, y - length * 0.5), (x + 30, y - length * 0.86), (x + 18, y - length * 0.55), (x, y - 10)])]


# ------------------------------------------------------------------ the haft shared by the long weapons
def haft(t, x, y0, y1, r, grip=(100, 300)):
    mat, grain, wrap = TIER[t][:3]
    fit = TIER[t][6]
    g0, g1 = grip
    turns = {1: 5, 3: 11}.get(t, 9)
    parts = []
    if t == 1:
        parts.append(('poly', mat, torn(box(x - r, y0, x + r, y1, 5), 3.2, 11)))
        parts.append(('poly', grain, [(x + 4, y0 + 40), (x + 11, y0 + 44), (x + 7, y1 - 60), (x + 2, y1 - 80)]))
    else:
        parts.append(('rod', mat, x, y0, y1, r, grain))
    if t == 10:
        parts.append(('wraps', 'gold', x, g1 + 40, y1 - 90, r - 3, max(3, int((y1 - g1 - 130) / 70)), 1))
        parts[-1] = ('dots', 'gold', [(x, y, 7) for y in range(int(g1 + 60), int(y1 - 120), 62)])
    parts.append(('wraps', wrap, x, g0, g1, r + 1, turns, 1))
    if t == 7:
        parts.append(('wraps', 'steel_s', x, g0, g1, r + 1, turns, -1))
    if t == 4:
        parts.append(('dots', 'bronze', [(x, g1 + 22, 8), (x, g0 - 18, 8)]))
    if t == 1:
        parts.append(('poly', 'rag', torn([(x - 6, y0 + 52), (x - 62, y0 + 6), (x - 48, y0 - 12), (x + 4, y0 + 30)], 3, 12)))
    elif t in (2, 3):
        parts.append(('poly', fit, box(x - r - 3, y0 - 4, x + r + 3, y0 + 24, 7)))
    else:
        parts.append(('poly', fit, box(x - r - 6, y0 - 8, x + r + 6, y0 + 34, 9)))
        if t >= 9:
            parts.append(('dots', 'gold' if t == 9 else 'purple', [(x, y0 + 13, 11)]))
    return parts


def collars(t, x, y, r, n=1):
    fit = TIER[t][6]
    return [('poly', fit, box(x - r - 9, y - i * 34, x + r + 9, y - i * 34 + 20, 5)) for i in range(n)]


# ------------------------------------------------------------------ SWORD
def sword(t):
    if t == 1:
        blade = [(-34, 350), (32, 348), (40, 520), (30, 600), (42, 640), (36, 850), (4, 962), (-30, 880), (-40, 700), (-30, 660), (-42, 600)]
        return [
            ('poly', 'scrap', torn(blade, 3.5, 31)),
            ('poly', 'scrap_s', torn([(-6, 380), (6, 380), (9, 760), (1, 850), (-4, 700)], 2, 32)),
            ('poly', 'scrap_hi', torn([(-26, 420), (-19, 424), (-22, 590), (-29, 570)], 1.5, 33)),
            ('poly', 'scrap_s', torn([(-96, 318), (94, 340), (98, 370), (-92, 352)], 3, 34)),
            ('rod', 'scrap', 0, 170, 340, 22, None),
            ('wraps', 'rag', 0, 186, 316, 24, 5, 1),
            ('dots', 'iron_s', [(-6, 344, 9), (24, 347, 7)]),
            ('poly', 'rag', torn([(-8, 190), (-64, 120), (-46, 104), (6, 170)], 3, 35)),
            ('poly', 'scrap_s', torn(box(-28, 140, 28, 178, 8), 2.5, 36)),
        ]
    if t == 2:
        return [
            ('blade', 'pulp', 0, [(352, 42), (820, 38), (880, 28), (950, 0)]),
            ('rod', 'leather', 0, 170, 340, 24, None),
            ('wraps', 'leather_d', 0, 184, 318, 25, 6, 1),
            ('poly', 'leather_d', box(-86, 320, 86, 360, 12)),
            ('poly', 'pulp_s', box(-74, 334, 74, 346)),
            ('dots', 'linen', [(0, 135, 40)]),
            ('dots', 'linen_d', [(-2, 137, 15)]),
        ]
    if t == 3:
        return [
            ('blade', 'card', 0, [(352, 50), (790, 45), (872, 33), (965, 0)]),
            ('blade', 'card', 0, [(372, 22), (780, 19), (840, 13), (900, 0)]),
            ('rod', 'linen', 0, 170, 340, 25, None),
            ('wraps', 'linen_d', 0, 182, 318, 26, 7, 1),
            ('poly', 'card_s', box(-94, 316, 94, 366, 16)),
            ('poly', 'linen_d', [(-60, 341), (-40, 356), (-20, 341), (-40, 326)]),
            ('poly', 'linen_d', [(20, 341), (40, 356), (60, 341), (40, 326)]),
            ('dots', 'linen_d', [(0, 130, 44)]),
            ('dots', 'linen', [(0, 130, 22)]),
        ]
    if t == 4:
        return [
            ('blade', 'hide', 0, [(352, 52), (800, 46), (880, 34), (975, 0)]),
            ('dots', 'bronze', [(0, y, 9) for y in range(420, 860, 74)]),
            ('rod', 'leather', 0, 170, 340, 25, None),
            ('wraps', 'leather_d', 0, 182, 318, 26, 7, 1),
            ('poly', 'leather_d', box(-96, 316, 96, 366, 12)),
            ('dots', 'bronze', [(-68, 341, 10), (0, 341, 10), (68, 341, 10)]),
            ('dots', 'bronze_s', [(0, 128, 44)]),
            ('dots', 'bronze', [(0, 128, 18)]),
        ]
    if t == 5:
        return [
            ('blade', 'bronze', 0, smooth([(352, 34), (480, 32), (640, 58), (760, 62), (860, 40), (920, 18)]) + [(978, 0)]),
            ('rod', 'leather', 0, 170, 340, 24, None),
            ('wraps', 'leather_d', 0, 182, 318, 25, 6, 1),
            ('poly', 'bronze_s', oval(0, 340, 90, 30)),
            ('poly', 'bronze', oval(0, 340, 66, 18)),
            ('dots', 'bronze_s', [(0, 128, 46)]),
            ('dots', 'bronze', [(0, 128, 31)]),
            ('dots', 'bronze_hi', [(0, 128, 11)]),
        ]
    if t == 6:
        return [
            ('blade', 'iron', 0, [(352, 52), (820, 49), (885, 36), (985, 0)]),
            ('poly', 'iron_hi', [(-5, 380), (5, 380), (3, 890), (-3, 890)]),
            ('rod', 'leather_d', 0, 165, 340, 25, None),
            ('wraps', 'leather', 0, 178, 316, 26, 8, 1),
            ('poly', 'iron_s', box(-116, 320, 116, 366, 10)),
            ('poly', 'iron_d', box(-102, 337, 102, 349)),
            ('poly', 'iron_s', box(-42, 100, 42, 172, 20)),
            ('dots', 'iron_d', [(0, 136, 16)]),
        ]
    if t == 7:
        return [
            ('blade', 'steel', 0, [(352, 47), (830, 43), (900, 30), (1000, 0)]),
            ('poly', 'steel_s', box(-8, 390, 8, 830, 7)),
            ('rod', 'chain', 0, 160, 330, 24, None),
            ('wraps', 'steel_s', 0, 170, 312, 25, 8, 1),
            ('wraps', 'iron_s', 0, 170, 312, 25, 8, -1),
            ('poly', 'iron_s', box(-132, 324, 132, 354, 8)),
            ('poly', 'iron_d', box(-30, 316, 30, 372, 9)),
            ('dots', 'iron', [(-134, 339, 22), (134, 339, 22)]),
            ('dots', 'iron_s', [(0, 118, 48)]),
            ('dots', 'iron_d', [(0, 118, 26)]),
            ('dots', 'steel_s', [(0, 118, 10)]),
        ]
    if t == 8:
        return [
            ('blade', 'steel', 0, smooth([(352, 54), (460, 42), (640, 50), (790, 58), (868, 47), (930, 23)]) + [(990, 0)]),
            ('rod', 'red', 0, 170, 340, 26, 'red_d'),
            ('wraps', 'red_d', 0, 190, 316, 27, 5, 1),
            ('poly', 'brass', [(-108, 338), (-96, 322), (-32, 312), (32, 312), (96, 322), (108, 338), (96, 360), (32, 370), (-32, 370), (-96, 360)]),
            ('dots', 'brass_s', [(0, 341, 15)]),
            ('poly', 'brass', box(-36, 158, 36, 182, 7)),
            ('dots', 'brass', [(0, 122, 47)]),
            ('dots', 'brass_s', [(0, 122, 19)]),
        ]
    if t == 9:
        return [
            ('blade', 'steel', 0, smooth([(352, 56), (520, 46), (720, 50), (860, 44), (930, 22)]) + [(1010, 0)]),
            ('poly', 'steel_s', box(-7, 520, 7, 860, 6)),
            ('poly', 'gold', [(-44, 360), (44, 360), (20, 440), (0, 520), (-20, 440)]),
            ('poly', 'gold_s', [(-20, 362), (20, 362), (0, 470)]),
            ('rod', 'red_d', 0, 165, 340, 25, None),
            ('wraps', 'gold', 0, 186, 314, 26, 4, 1),
            ('poly', 'bronze_s', [(-132, 366), (-104, 322), (-30, 314), (30, 314), (104, 322), (132, 366), (92, 352), (30, 368), (-30, 368), (-92, 352)]),
            ('poly', 'gold', box(-96, 333, 96, 343, 4)),
            ('dots', 'gold', [(-128, 362, 19), (128, 362, 19), (0, 340, 17)]),
            ('dots', 'bronze', [(0, 118, 50)]),
            ('dots', 'gold', [(0, 118, 27)]),
        ]
    parts = [
        ('blade', 'gilded', 0, smooth([(358, 60), (480, 48), (660, 56), (810, 66), (884, 52), (945, 26)]) + [(1015, 0)]),
        ('poly', 'gold_s', box(-7, 390, 7, 890, 6)),
    ]
    parts += laurel(0, 392, n=3, gap=34, reach=24)
    right = [(14, 316), (60, 328), (112, 352), (150, 402), (104, 384), (122, 428), (70, 376), (14, 372)]
    parts += [
        ('rod', 'purple', 0, 170, 340, 26, 'purple_d'),
        ('wraps', 'gold', 0, 188, 312, 27, 4, 1),
        ('poly', 'gold', right), ('poly', 'gold', mirror(right, 0)),
        ('poly', 'gold_s', box(-40, 310, 40, 376, 16)),
        ('dots', 'purple', [(0, 343, 21)]),
        ('poly', 'gold', box(-34, 152, 34, 180, 8)),
        ('dots', 'gold', [(0, 112, 52)]),
        ('dots', 'purple', [(0, 112, 23)]),
    ]
    return parts


# ------------------------------------------------------------------ AXE: the head looks to +x
def axe(t):
    _, _, wrap, head, dark, edge, fit, _ = TIER[t]
    x, r = 0, 22
    k = 0.8 + 0.026 * t
    cy = 815                                   # middle of the eye
    P = lambda pts: [(x + px * k, cy + py * k) for px, py in pts]
    parts = haft(t, x, 60, 930, r)

    def bearded(reach=1.0):
        outline = ([(14, 62), (62, 72), (108, 102), (150 * reach, 148)] + arc(94 * reach, -2, 106 * reach, 158, 60, -68)
                   + [(126 * reach, -92), (96, -64), (56, -38), (14, -30)])
        lip = arc(94 * reach, -2, 106 * reach, 158, 60, -68) + list(reversed(arc(80 * reach, 0, 90 * reach, 140, 57, -63)))
        return [('poly', head, P(outline)), ('poly', edge, P(lip))]

    if t == 1:                                 # a chunk of plank lashed to the pole
        parts += [
            ('poly', 'scrap_s', torn(P([(-52, 42), (60, 70), (136, 40), (120, -70), (30, -44), (-48, -50)]), 4, 41)),
            ('poly', 'scrap_hi', torn(P([(96, 48), (136, 40), (120, -70), (92, -54)]), 3, 42)),
            ('poly', 'rag', P([(-34, 62), (-14, 68), (40, -54), (20, -62)])),
            ('poly', 'rag', P([(20, 68), (40, 62), (-14, -62), (-34, -54)])),
            ('poly', 'rag_d', torn(P(box(-34, -78, 34, -56, 4)), 2, 43)),
        ]
        return parts
    if t == 2:                                 # a plain wedge
        parts += [
            ('poly', head, P([(10, 48), (100, 74), (150, 86), (160, 0), (150, -86), (100, -66), (10, -44)])),
            ('poly', edge, P([(132, 82), (150, 86), (160, 0), (150, -86), (132, -80), (141, 0)])),
        ]
    elif t == 5:                               # bronze fan
        fan = [(12, 40), (70, 52)] + arc(48, 0, 112, 132, 74, -74) + [(70, -52), (12, -40)]
        parts += [('poly', head, P(fan)),
                  ('poly', edge, P(arc(48, 0, 112, 132, 74, -74) + list(reversed(arc(38, 0, 98, 117, 70, -70)))))]
    else:
        reach = 0.9 if t == 3 else 1.0
        parts += bearded(reach)
        if t == 3:
            parts.append(('poly', 'card_s', P([(24, 24), (78, 40), (104, 6), (78, -30), (24, -14)])))
    if t >= 6:                                 # the back: a spike, from tier 9 a second blade
        if t < 9:
            parts.append(('poly', head, P([(-14, -34), (-62, -22), (-98, 8), (-62, 38), (-14, 48)])))
            parts.append(('poly', edge, P([(-62, -22), (-98, 8), (-62, 38), (-72, 8)])))
        else:
            blade = [(-14, 46), (-54, 62), (-90, 112)] + arc(-52, 4, 78, 122, 118, 238) + [(-54, -40), (-14, -34)]
            parts.append(('poly', head, P(blade)))
            parts.append(('poly', edge, P(arc(-52, 4, 78, 122, 118, 238) + list(reversed(arc(-42, 4, 72, 106, 118, 236))))))
    if t >= 7:
        parts.append(('poly', dark, P([(-16, 76), (16, 76), (0, 152)])))
    eye = {9: 'bronze_s', 10: 'gold'}.get(t, dark)
    parts.append(('poly', eye, P(box(-36, -52, 36, 82, 14))))
    if t == 4:
        parts.append(('dots', 'bronze', [(x + 62 * k, cy + 30 * k, 10), (x + 62 * k, cy - 4 * k, 10), (x + 100 * k, cy + 14 * k, 10)]))
    stud = {2: 'leather', 3: 'linen_d', 4: 'bronze', 5: 'bronze_hi', 8: 'brass', 9: 'gold', 10: 'purple'}.get(t, 'steel_s')
    parts.append(('dots', stud, [(x, cy + 48 * k, 11), (x, cy - 20 * k, 11)]))
    if t == 5:
        parts.append(('dots', 'bronze_s', [(x + 78 * k, cy, 24)]))
    if t >= 8:
        parts += collars(t, x, cy - 94 * k, r, 2 if t >= 9 else 1)
    if t == 10:
        parts += laurel(x + 80 * k, cy - 34, n=3, gap=30, reach=17)
    return parts


# ------------------------------------------------------------------ SPEAR
def spear(t):
    _, _, wrap, head, dark, edge, fit, style = TIER[t]
    r = 18
    parts = haft(t, 0, 20, 722 if t > 1 else 780, r, grip=(250, 440))
    if t == 1:                                 # a sharpened, fire-hardened pole
        parts += [
            ('poly', 'wood_dd', torn([(-18, 772), (18, 772), (9, 880), (0, 975), (-10, 880)], 2.5, 51)),
            ('poly', 'wood_d', [(-9, 780), (0, 780), (-2, 920)]),
            ('poly', 'rag', torn(box(-28, 724, 28, 772, 8), 3, 52)),
            ('wraps', 'rag_d', 0, 728, 766, 27, 2, -1),
        ]
        return parts
    shapes = {
        2: [(748, 15), (800, 40), (968, 0)],
        3: smooth([(748, 16), (800, 52), (880, 34), (935, 15)]) + [(985, 0)],
        4: [(748, 16), (808, 50), (840, 38), (985, 0)],
        5: smooth([(748, 14), (792, 56), (850, 70), (915, 46), (955, 20)]) + [(992, 0)],
        6: [(748, 17), (790, 30), (905, 30), (1005, 0)],
        7: smooth([(748, 15), (795, 44), (860, 40), (940, 18)]) + [(1015, 0)],
        8: smooth([(748, 14), (790, 50), (835, 60), (905, 35), (955, 15)]) + [(1010, 0)],
        9: smooth([(748, 16), (788, 58), (830, 52), (870, 40), (945, 28)]) + [(1020, 0)],
        10: smooth([(748, 18), (800, 62), (850, 72), (920, 40), (965, 18)]) + [(1025, 0)],
    }
    if t in (6, 9):                            # lugs under the point
        wing = [(12, 726), (74, 752), (92, 800), (62, 778), (12, 758)]
        parts += [('poly', 'iron_s' if t == 6 else 'gold', wing), ('poly', 'iron_s' if t == 6 else 'gold', mirror(wing, 0))]
    parts += [
        ('poly', dark if t != 10 else 'gold', [(-27, 668), (27, 668), (15, 768), (-15, 768)]),
        ('blade', style, 0, shapes[t]),
    ]
    ring = {2: 'leather_d', 3: 'linen_d', 4: 'bronze', 5: 'bronze_s', 6: 'iron_s', 7: 'iron_s'}.get(t, fit)
    parts.append(('poly', ring, box(-31, 656, 31, 682, 6)))
    if t >= 3:
        parts.append(('dots', {3: 'linen_d', 8: 'brass', 9: 'gold', 10: 'purple'}.get(t, 'bronze'), [(0, 714, 9)]))
    if t == 4:
        parts.append(('dots', 'bronze', [(0, 742, 7)]))
    if t >= 7:
        parts += collars(t, 0, 612, r)
    if t >= 8:
        parts += tassel(0, 640 if t == 8 else 612, {8: 'red', 9: 'red_d', 10: 'purple'}[t], 130 + 22 * (t - 8))
    if t == 10:
        parts += laurel(0, 774, n=2, gap=32, reach=23)
    return parts


# ------------------------------------------------------------------ HAMMER
def hammer(t):
    _, _, wrap, head, dark, edge, fit, _ = TIER[t]
    r = 23
    k = 0.8 + 0.022 * t
    cy = 828
    P = lambda pts: [(px * k, cy + py * k) for px, py in pts]
    parts = haft(t, 0, 60, 880, r, grip=(100, 330))
    if t == 1:                                 # a log lashed to a pole
        parts += [
            ('poly', 'wood', torn(P(box(-130, -78, 130, 78, 22)), 3.5, 61)),
            ('poly', 'scrap_hi', torn(P(oval(-114, 0, 30, 70)), 2, 62)),
            ('poly', 'scrap', P(oval(-114, 0, 19, 48))),
            ('poly', 'scrap_hi', P(oval(-114, 0, 7, 21))),
            ('poly', 'wood_s', torn(P(box(-70, 20, 118, 33, 4)), 2, 63)),
            ('poly', 'wood_s', torn(P(box(-60, -48, 100, -38, 4)), 2, 64)),
            ('poly', 'rag', P([(-46, 88), (-18, 92), (46, -86), (18, -90)])),
            ('poly', 'rag', P([(18, 92), (46, 88), (-18, -90), (-46, -86)])),
            ('poly', 'rag_d', torn(P(box(-34, -112, 34, -86, 5)), 2, 65)),
        ]
        return parts
    body = {2: 14, 3: 6, 4: 10, 5: 34}.get(t, 8)
    parts.append(('poly', head if t < 7 else 'iron_s', P(box(-96, -66, 96, 66, body))))
    if t == 3:                                 # glued layers
        parts += [('poly', 'card_s', P(box(-92, y, 92, y + 9))) for y in (-44, -12, 20)]
    if t == 6:
        parts += [('poly', 'iron_d', P(box(-92, y, 92, y + 12))) for y in (-34, 22)]
    face = {2: 'pulp_s', 3: 'card_s', 4: 'leather_d', 5: 'bronze_s', 6: 'iron_s', 10: 'gold'}.get(t, 'steel')
    lip = {5: 'bronze_hi', 6: 'iron_hi', 10: 'gold_s'}.get(t, edge)
    if t == 9:                                 # a flat face and a beak
        parts += [('poly', 'steel', P([(-90, -62), (-132, -30), (-182, 4), (-132, 18), (-90, 62)])),
                  ('poly', 'steel_hi', P([(-132, 18), (-182, 4), (-132, -2), (-96, 20)])),
                  ('poly', face, P(box(86, -90, 140, 90, 18))), ('poly', lip, P(box(122, -78, 136, 78, 5)))]
    else:
        for s in (-1, 1):
            parts.append(('poly', face, P(box(min(s * 86, s * 138), -84, max(s * 86, s * 138), 84, 18))))
            parts.append(('poly', lip, P(box(min(s * 120, s * 134), -70, max(s * 120, s * 134), 70, 5))))
    if t >= 7:
        parts.append(('blade', 'gilded' if t == 10 else 'steel', 0, [(cy + 70 * k, 24 * k), (cy + 100 * k, 15 * k), (cy + 168 * k, 0)]))
    band = {2: 'leather_d', 3: 'linen_d', 4: 'leather_d', 5: 'bronze_s', 9: 'bronze_s', 10: 'gold'}.get(t, 'iron_d')
    parts.append(('poly', band, P(box(-36, -90, 36, 82, 10))))
    if t == 4:
        parts.append(('dots', 'bronze', [(x * k, cy + y * k, 10) for x in (-68, 68) for y in (-34, 34)]))
    stud = {2: 'pulp', 3: 'linen', 4: 'bronze', 5: 'bronze_hi', 6: 'steel_s', 7: 'brass', 8: 'brass', 9: 'gold', 10: 'purple'}[t]
    if t == 5 or t >= 9:
        parts += [('dots', 'bronze_s' if t == 5 else 'gold', [(0, cy, 31)]), ('dots', stud, [(0, cy, 17)])]
    else:
        parts.append(('dots', stud, [(0, cy + 40 * k, 12), (0, cy - 44 * k, 12)]))
    if t >= 8:
        parts += collars(t, 0, cy - 128 * k, r, 2 if t >= 9 else 1)
    if t == 10:
        parts += laurel(-66 * k, cy - 36, n=3, gap=29, reach=15) + laurel(66 * k, cy - 36, n=3, gap=29, reach=15)
    return parts


# ------------------------------------------------------------------ TRIDENT
def trident(t):
    _, _, wrap, head, dark, edge, fit, style = TIER[t]
    r = 18
    parts = haft(t, 0, 20, 660 if t > 1 else 720, r, grip=(230, 420))
    if t == 1:                                 # a fishing fork: whittled prongs lashed on
        for i, (x, top) in enumerate(((-76, 915), (0, 975), (76, 905))):
            parts.append(('poly', 'wood', torn([(x - 13, 722), (x + 13, 722), (x + 8, top - 60), (x, top), (x - 9, top - 56)], 2, 71 + i)))
            parts.append(('poly', 'wood_s', [(x + 1, 750), (x + 7, 750), (x + 3, top - 70)]))
        parts += [
            ('poly', 'scrap_s', torn(box(-104, 700, 104, 742, 10), 3, 74)),
            ('poly', 'rag', torn(box(-34, 668, 34, 752, 8), 3, 75)),
            ('wraps', 'rag_d', 0, 674, 744, 33, 3, -1),
        ]
        return parts
    wide = 82 + 2 * t
    if t >= 9:                                 # horns curling up from the bar
        bar = [(-wide - 24, 786), (-wide - 12, 716), (-52, 688), (52, 688), (wide + 12, 716), (wide + 24, 786), (wide - 2, 740),
               (40, 728), (-40, 728), (-wide + 2, 740)]
    elif t >= 6:
        bar = [(-wide - 18, 738), (-wide + 4, 702), (-42, 690), (42, 690), (wide - 4, 702), (wide + 18, 738), (wide - 4, 752),
               (wide - 26, 734), (30, 726), (-30, 726), (-wide + 26, 734), (-wide + 4, 752)]
    else:
        bar = box(-wide - 16, 694, wide + 16, 736, 8 if t < 5 else 20)
    barfill = {5: 'bronze_s', 10: 'gold'}.get(t, dark if t != 7 else 'iron_s')
    parts.append(('poly', barfill, bar))
    parts.append(('poly', dark if t != 10 else 'gold_s', [(-27, 628), (27, 628), (18, 736), (-18, 736)]))
    ring = {2: 'leather_d', 3: 'linen_d', 4: 'bronze', 5: 'bronze', 6: 'iron_s', 7: 'iron_s'}.get(t, fit)
    parts.append(('poly', ring, box(-31, 620, 31, 646, 6)))
    top = 935 + 7 * t
    for x, high, base in ((-wide, top - 60, 730), (wide, top - 60, 730), (0, top, 716)):
        if t == 2:
            prof = [(base, 17), (high - 70, 14), (high, 0)]
        elif t in (3, 5):
            prof = [(base, 14), (high - 120, 14), (high - 76, 28), (high, 0)]
        else:
            prof = [(base, 14), (high - 110, 14), (high - 76, 24), (high, 0)]
        parts.append(('blade', style, x, prof))
        if x and t >= 4:                       # barbs on the outer prongs, pointing back
            s = 1 if x > 0 else -1
            parts.append(('poly', edge, [(x + s * 8, high - 56), (x + s * 40, high - 122), (x + s * 12, high - 96)]))
    if t == 4:
        parts.append(('dots', 'bronze', [(-wide * 0.55, 715, 9), (wide * 0.55, 715, 9)]))
    if t >= 3:
        parts.append(('dots', {3: 'linen_d', 7: 'brass', 8: 'brass', 9: 'gold', 10: 'purple'}.get(t, 'bronze'), [(0, 706, 11)]))
    if t >= 7:
        parts += collars(t, 0, 576, r)
    if t >= 8:
        parts += tassel(0, 604 if t == 8 else 576, {8: 'red', 9: 'red_d', 10: 'purple'}[t], 130 + 22 * (t - 8))
    if t == 10:
        parts += laurel(0, 750, n=3, gap=32, reach=24)
    return parts


BUILDERS = {'sword': sword, 'axe': axe, 'spear': spear, 'hammer': hammer, 'trident': trident}


def weapon(family, tier):
    return BUILDERS[family](tier)
