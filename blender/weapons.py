"""Weapon sprites: swords tier 1-10 (#184), matching the armour sets in armor.py (1 = scrapwood and rags ... 10 = gold).

Every builder works in weapon-bone space like the gladius in build_kit.py: the grip is centred on the origin
(x -0.39 .. 0.39, under the hand), the pommel sits at x < -0.39, the blade points to +x. The pivot is the origin,
so the hand holds every sword at the same point as the gladius. Axes, spears and hammers (#36) are at the bottom.
"""
import math
import sprite_lib as sl
import kit
import armor

pc = sl.pc
L, E, R = kit.L, kit.E, kit.R
M = armor.M


def blade_pts(x0, x1, w0, w1, tip=0.5, leaf=0.0, waist=0.0, n=14):
    """Closed blade outline from the guard (x0, half-width w0) to the point (x1).
    w1 = half-width where the point starts, leaf = bulge at 2/3 of the length, waist = narrowing at 1/3 (gladius)."""
    xs = x1 - tip
    top = []
    for i in range(n + 1):
        t = i / n
        w = w0 + (w1 - w0) * t + leaf * math.sin(math.pi * min(1.0, t * 1.3)) - waist * math.sin(math.pi * t)
        top.append((x0 + (xs - x0) * t, w))
    top.append((x1, 0.0))
    return top + [(x, -y) for x, y in reversed(top)]


def inset(pts, k):
    """thinner copy of a blade outline (fuller / core / edge layering): scale y about the axis, keep x"""
    return [(x, y * k) for x, y in pts]


def rivets(c, xs, mat, z, r=0.045, y=0.0):
    for x in xs:
        L(c, E(r, r, x, y, 16), mat, z, 0.03, 'rivet')


def wraps(c, mat, z, n=5, x0=-0.36, x1=0.36, w=0.06, h=0.3, ang=0.35):
    for i in range(n):
        x = x0 + (x1 - x0) * i / max(1, n - 1)
        L(c, R(w, h, 0.02, x, 0.0, ang), mat, z, 0.03, 'wrap')


# ------------------------------------------------------------------ tier 1: Scrapwood (Beggar's Rags)
def sword1(c):
    wood = sl.tex_board('scrapwood', 'brown', tint='#9c7a52', scale=0.3, rot=0.05)
    L(c, sl.torn(blade_pts(0.42, 2.75, 0.17, 0.15, tip=0.32), 0.03, 31), wood, 0.0, 0.08, 'plank')
    L(c, sl.torn(R(1.5, 0.05, 0.02, 1.35, 0.04), 0.012, 32), M('leather_d'), 0.08, 0.02, 'grain')
    L(c, sl.torn(R(0.12, 0.52, 0.03, 0.43, 0.0, 0.08), 0.02, 33), sl.tex_board('scrapwood_d', 'brown', tint='#6e5236', scale=0.3), 0.08, 0.06, 'crossbar')
    L(c, sl.torn(R(0.82, 0.24, 0.06, 0.0, 0.0), 0.02, 34), wood, 0.0, 0.08, 'grip')
    L(c, sl.torn(R(0.64, 0.3, 0.08, 0.02, 0.0), 0.035, 35), M('rag'), 0.08, 0.05, 'rag')
    wraps(c, M('rag_d'), 0.13, n=3, x0=-0.22, x1=0.26, w=0.05, h=0.32)
    L(c, sl.torn([(-0.36, 0.06), (-0.62, -0.22), (-0.55, -0.3), (-0.33, -0.06)], 0.02, 36), M('rag'), 0.06, 0.04, 'rag_end')


# ------------------------------------------------------------------ tier 2: Pressed Pulp (Scrap Leather)
def sword2(c):
    pulp = sl.tex_board('pulp', 'craft', tint='#aaa294', scale=0.3)
    b = blade_pts(0.46, 2.85, 0.17, 0.15, tip=0.45)
    L(c, b, pulp, 0.0, 0.08, 'blade')
    L(c, sl.torn(R(1.9, 0.07, 0.02, 1.5, 0.0), 0.01, 41), sl.tex_board('pulp_d', 'craft', tint='#857d70', scale=0.3), 0.08, 0.02, 'seam')
    L(c, R(0.78, 0.26, 0.1, 0.0, 0.0), M('leather'), 0.0, 0.1, 'grip')
    wraps(c, M('leather_d'), 0.1, n=4, w=0.05)
    L(c, R(0.16, 0.56, 0.05, 0.44, 0.0), M('leather_d'), 0.08, 0.08, 'guard')
    L(c, E(0.16, 0.15, -0.45, 0.0, 28), M('linen'), 0.02, 0.1, 'pommel')   # a knuckle of bone
    L(c, E(0.07, 0.06, -0.47, 0.03, 16), M('linen_d'), 0.12, 0.02, 'knot')


# ------------------------------------------------------------------ tier 3: Layered Card (Padded Linen)
def sword3(c):
    b = blade_pts(0.48, 2.95, 0.19, 0.17, tip=0.5)
    L(c, b, M('linen_d'), 0.0, 0.05, 'card_a')
    L(c, pc.xf(inset(blade_pts(0.48, 2.86, 0.19, 0.17, tip=0.47), 0.78), 0.0, 0.0), M('linen'), 0.05, 0.05, 'card_b')
    L(c, pc.xf(inset(blade_pts(0.48, 2.72, 0.19, 0.17, tip=0.42), 0.48), 0.0, 0.0), M('white'), 0.1, 0.04, 'card_c')
    L(c, R(0.8, 0.27, 0.1, 0.0, 0.0), M('linen'), 0.0, 0.1, 'grip')
    wraps(c, M('linen_d'), 0.1, n=5)
    L(c, R(0.18, 0.62, 0.06, 0.44, 0.0), M('quilt'), 0.08, 0.08, 'guard')
    L(c, E(0.17, 0.17, -0.46, 0.0, 28), M('linen_d'), 0.02, 0.1, 'pommel')


# ------------------------------------------------------------------ tier 4: Riveted Card (Studded Hide)
def sword4(c):
    b = blade_pts(0.48, 3.0, 0.2, 0.17, tip=0.5)
    L(c, b, M('leather_d'), 0.0, 0.06, 'backing')
    L(c, inset(blade_pts(0.48, 2.9, 0.2, 0.17, tip=0.46), 0.8), M('leather_l'), 0.06, 0.06, 'card')
    rivets(c, [0.75 + 0.36 * i for i in range(6)], M('bronze'), 0.12)
    L(c, R(0.78, 0.26, 0.1, 0.0, 0.0), M('leather'), 0.0, 0.1, 'grip')
    rivets(c, [-0.22, 0.0, 0.22], M('bronze'), 0.1, r=0.04)
    L(c, R(0.2, 0.62, 0.06, 0.44, 0.0), M('leather_d'), 0.08, 0.08, 'guard')
    rivets(c, [0.44], M('bronze'), 0.16, r=0.05, y=0.18)
    rivets(c, [0.44], M('bronze'), 0.16, r=0.05, y=-0.18)
    L(c, E(0.18, 0.18, -0.46, 0.0, 32), M('bronze_d'), 0.02, 0.1, 'pommel')


# ------------------------------------------------------------------ tier 5: Bronze Foil (Bronze Recruit) - leaf blade
def sword5(c):
    b = blade_pts(0.48, 3.08, 0.15, 0.12, tip=0.45, leaf=0.09)
    L(c, b, M('bronze'), 0.0, 0.08, 'blade')
    L(c, [(0.5, 0.045), (2.7, 0.02), (2.95, 0.0), (2.7, -0.02), (0.5, -0.045)], M('bronze_d'), 0.08, 0.03, 'midrib')
    L(c, R(0.78, 0.26, 0.1, 0.0, 0.0), M('leather'), 0.0, 0.1, 'grip')
    wraps(c, M('leather_d'), 0.1, n=4, w=0.05)
    L(c, pc.xf(pc.ellipse_pts(0.13, 0.36, 32), 0.44, 0.0), M('bronze_d'), 0.08, 0.08, 'guard')
    L(c, E(0.19, 0.19, -0.46, 0.0, 32), M('bronze'), 0.02, 0.1, 'pommel')
    L(c, E(0.08, 0.08, -0.46, 0.0, 20), M('bronze_d'), 0.12, 0.02, 'boss')


# ------------------------------------------------------------------ tier 6: Iron Laminate (Iron Scale)
def sword6(c):
    b = blade_pts(0.5, 3.15, 0.2, 0.18, tip=0.55)
    L(c, b, M('iron_d'), 0.0, 0.06, 'edge')
    L(c, inset(blade_pts(0.5, 3.0, 0.2, 0.18, tip=0.5), 0.72), M('iron'), 0.06, 0.05, 'core')
    L(c, inset(blade_pts(0.5, 2.75, 0.2, 0.18, tip=0.4), 0.3), M('iron_d'), 0.11, 0.03, 'lamina')
    L(c, R(0.78, 0.26, 0.1, 0.0, 0.0), M('leather_d'), 0.0, 0.1, 'grip')
    wraps(c, M('leather'), 0.1, n=5, w=0.05)
    L(c, R(0.2, 0.72, 0.07, 0.45, 0.0), M('iron'), 0.08, 0.08, 'guard')
    L(c, R(0.08, 0.72, 0.03, 0.45, 0.0), M('iron_d'), 0.16, 0.02, 'guard_line')
    L(c, R(0.26, 0.32, 0.08, -0.48, 0.0), M('iron'), 0.02, 0.1, 'pommel')


# ------------------------------------------------------------------ tier 7: Woven Steel (Chain Veteran)
def sword7(c):
    b = blade_pts(0.5, 3.25, 0.2, 0.17, tip=0.55)
    L(c, b, M('steel'), 0.0, 0.07, 'blade')
    L(c, R(2.05, 0.08, 0.03, 1.6, 0.0), M('steel_d'), 0.07, 0.02, 'fuller')
    L(c, R(0.78, 0.27, 0.1, 0.0, 0.0), M('chain'), 0.0, 0.1, 'grip')
    L(c, [(0.36, 0.14), (0.54, 0.14), (0.54, -0.14), (0.36, -0.14)], M('iron_d'), 0.06, 0.06, 'collar')
    L(c, R(0.13, 0.96, 0.05, 0.45, 0.0), M('iron'), 0.1, 0.06, 'guard')
    for s in (1, -1):
        L(c, E(0.09, 0.09, 0.47, s * 0.47, 20), M('iron_d'), 0.16, 0.04, 'quillon')
    L(c, E(0.2, 0.2, -0.5, 0.0, 32), M('iron'), 0.02, 0.1, 'pommel')
    L(c, E(0.1, 0.1, -0.5, 0.0, 24), M('iron_d'), 0.12, 0.03, 'pommel_ring')


# ------------------------------------------------------------------ tier 8: Legion Plate - a long gladius, brass and red
def sword8(c):
    b = blade_pts(0.5, 3.35, 0.21, 0.2, tip=0.6, waist=0.035)
    L(c, b, M('steel'), 0.0, 0.07, 'blade')
    L(c, R(2.2, 0.07, 0.03, 1.65, 0.0), M('steel_d'), 0.07, 0.02, 'fuller')
    L(c, R(0.78, 0.26, 0.1, 0.0, 0.0), M('red'), 0.0, 0.1, 'grip')
    for x in (-0.24, 0.0, 0.24):
        L(c, R(0.07, 0.3, 0.03, x, 0.0), M('red_d'), 0.1, 0.03, 'ridge')
    L(c, R(0.2, 0.7, 0.08, 0.45, 0.0), M('brass'), 0.08, 0.08, 'guard')
    L(c, E(0.21, 0.21, -0.48, 0.0, 32), M('brass'), 0.02, 0.1, 'pommel')
    L(c, E(0.1, 0.1, -0.48, 0.0, 24), M('bronze'), 0.12, 0.02, 'pommel_cap')


# ------------------------------------------------------------------ tier 9: Champion (Champion's Bronze)
def sword9(c):
    b = blade_pts(0.52, 3.5, 0.22, 0.2, tip=0.6)
    L(c, b, M('steel'), 0.0, 0.07, 'blade')
    L(c, R(2.3, 0.08, 0.03, 1.75, 0.0), M('steel_d'), 0.07, 0.02, 'fuller')
    L(c, [(0.52, 0.22), (0.92, 0.12), (0.92, -0.12), (0.52, -0.22)], M('gold'), 0.08, 0.03, 'inlay')
    L(c, R(0.78, 0.26, 0.1, 0.0, 0.0), M('red_d'), 0.0, 0.1, 'grip')
    wraps(c, M('gold_d'), 0.1, n=4, w=0.04, ang=0.0)
    L(c, R(0.18, 0.92, 0.06, 0.46, 0.0), M('bronze'), 0.08, 0.08, 'guard')
    for s_ in (1, -1):
        L(c, E(0.1, 0.1, 0.46, s_ * 0.46, 24), M('gold'), 0.16, 0.04, 'guard_end')
    L(c, R(0.07, 0.5, 0.03, 0.5, 0.0), M('gold'), 0.16, 0.02, 'guard_trim')
    L(c, E(0.22, 0.22, -0.48, 0.0, 32), M('bronze'), 0.02, 0.1, 'pommel')
    L(c, E(0.11, 0.11, -0.48, 0.0, 24), M('gold'), 0.12, 0.03, 'pommel_gold')


# ------------------------------------------------------------------ tier 10: Gilded Legend - gold edge, laurel, purple
def sword10(c):
    b = blade_pts(0.52, 3.65, 0.23, 0.21, tip=0.62)
    L(c, b, M('gold'), 0.0, 0.06, 'gold_edge')
    L(c, inset(blade_pts(0.52, 3.5, 0.23, 0.21, tip=0.56), 0.8), M('steel'), 0.06, 0.05, 'blade')
    L(c, R(2.4, 0.08, 0.03, 1.85, 0.0), M('gold_d'), 0.11, 0.02, 'fuller')
    for i in range(3):   # laurel sprigs over the blade root
        x = 0.68 + i * 0.16
        for s in (1, -1):
            L(c, E(0.11, 0.045, x, s * 0.1, 16, s * 0.6), M('laurel'), 0.14 + i * 0.01, 0.02, 'leaf')
    L(c, R(0.78, 0.27, 0.1, 0.0, 0.0), M('purple'), 0.0, 0.1, 'grip')
    wraps(c, M('gold'), 0.1, n=4, w=0.045, ang=0.0)
    L(c, R(0.22, 0.46, 0.08, 0.48, 0.0), M('gold'), 0.08, 0.08, 'guard')
    for s_ in (1, -1):
        L(c, R(0.13, 0.5, 0.06, 0.55, s_ * 0.36, -s_ * 0.45), M('gold'), 0.06, 0.08, 'wing')
        L(c, E(0.07, 0.07, 0.66, s_ * 0.58, 20), M('gold_d'), 0.14, 0.03, 'wing_tip')
    L(c, E(0.1, 0.1, 0.5, 0.0, 24), M('purple'), 0.16, 0.03, 'gem')
    L(c, E(0.24, 0.22, -0.5, 0.0, 32), M('gold'), 0.02, 0.1, 'pommel')
    L(c, E(0.12, 0.11, -0.5, 0.0, 24), M('purple'), 0.12, 0.03, 'pommel_gem')


SWORDS = {t: globals()[f'sword{t}'] for t in range(1, 11)}


# ================================================================== AXES, SPEARS, HAMMERS (#36)
# Two-handed weapons: where the BACK hand holds the haft, in weapon-bone units (front hand = origin).
# build_kit writes it into kit.json (sprite 'grip2'); PaperRig bends the back arm to reach it.
GRIP2 = {'spear': (-1.8, 0.0), 'hammer': (-1.5, 0.0)}
# set by weapon_icons.py: builders may change proportions for the shop pictures (never for the kit)
ICON = False


# Same tier ladder as the swords. The axe and hammer are held at the end of the haft, the spear on the shaft
# with its point past a sword's reach. The axe's cutting edge is on -y: the leading side in the downward swing.
def _wood(name='haft', tint='#8a6a48'):
    return sl.tex_board(name, 'brown', tint=tint, scale=0.3, rot=0.05)


def _tier(t):
    """(haft, grip, head, head_d, fitting, torn) materials for tier t"""
    wood, wood_d = _wood(), _wood('haft_d', '#5e4530')
    pulp = lambda n, c_: sl.tex_board(n, 'craft', tint=c_, scale=0.3)
    return {
        1: (_wood('scrapwood', '#9c7a52'), M('rag'), M('linen'), M('linen_d'), M('rag_d'), True),
        2: (wood, M('leather'), pulp('pulp', '#aaa294'), pulp('pulp_d', '#857d70'), M('leather_d'), False),
        3: (M('leather_l'), M('linen'), M('linen'), M('linen_d'), M('linen_d'), False),
        4: (wood, M('leather'), M('leather_l'), M('leather_d'), M('bronze'), False),
        5: (wood, M('leather'), M('bronze'), M('bronze_d'), M('bronze_d'), False),
        6: (wood_d, M('leather_d'), M('iron'), M('iron_d'), M('iron'), False),
        7: (wood_d, M('chain'), M('steel'), M('steel_d'), M('iron'), False),
        8: (wood_d, M('red'), M('steel'), M('steel_d'), M('brass'), False),
        9: (wood_d, M('red_d'), M('steel'), M('steel_d'), M('gold'), False),
        10: (M('purple'), M('purple'), M('steel'), M('gold'), M('gold'), False),
    }[t]


def _poly(pts, torn, seed):
    return sl.torn(pts, 0.025, seed) if torn else pts


def _haft(c, t, x0, x1, w, grips=(0.0,)):
    haft, grip = _tier(t)[:2]
    torn = t == 1
    L(c, _poly(R(x1 - x0, w, w * 0.4, (x0 + x1) / 2, 0.0), torn, 50 + t), haft, 0.0, 0.08, 'haft')
    if t == 10:
        for i in range(int((x1 - x0) / 0.5)):   # gold bands on the purple haft
            L(c, R(0.05, w + 0.02, 0.02, x0 + 0.3 + i * 0.5, 0.0, 0.35), M('gold'), 0.08, 0.02, 'band')
    for g in grips:
        L(c, _poly(R(0.8, w + 0.06, 0.08, g, 0.0), torn, 60 + t), grip, 0.08, 0.04, 'grip')
        if t in (1, 2, 4, 5, 6):
            mat = M('rag_d') if t == 1 else (M('leather') if t == 6 else M('leather_d'))
            wraps(c, mat, 0.12, n=3 if t == 1 else 4, x0=g - 0.36, x1=g + 0.36, w=0.05, h=w + 0.1)
        elif t == 3:
            wraps(c, M('linen_d'), 0.12, n=5, x0=g - 0.36, x1=g + 0.36, h=w + 0.1)
        elif t >= 8:
            mat = {8: M('red_d'), 9: M('gold_d'), 10: M('gold')}[t]
            wraps(c, mat, 0.12, n=4, x0=g - 0.36, x1=g + 0.36, w=0.045, h=w + 0.1, ang=0.0)
        if t == 4:
            rivets(c, [g - 0.2, g + 0.2], M('bronze'), 0.14, r=0.04)


def _butt(c, t, x, w):
    """end of the haft behind the hand"""
    fit = _tier(t)[4]
    if t == 1:
        L(c, sl.torn([(x + 0.1, 0.06), (x - 0.18, -0.16), (x - 0.12, -0.24), (x + 0.12, -0.04)], 0.02, 70), M('rag'), 0.06, 0.04, 'rag_end')
    elif t >= 4:
        L(c, R(0.16, w + 0.08, 0.05, x, 0.0), fit, 0.06, 0.06, 'butt')
        if t >= 9:
            L(c, E(0.1, 0.1, x - 0.1, 0.0, 20), M('gold') if t == 9 else M('purple'), 0.12, 0.03, 'butt_gem')


def _collar(c, t, x, w, n=1):
    fit = _tier(t)[4]
    for i in range(n):
        L(c, R(0.1, w + 0.1, 0.03, x - i * 0.16, 0.0), fit, 0.14, 0.04, 'collar')


def _arc(cx, cy, rx, ry, a0, a1, k=12):
    return [(cx + rx * math.cos(math.radians(a0 + (a1 - a0) * i / k)), cy + ry * math.sin(math.radians(a0 + (a1 - a0) * i / k)))
            for i in range(k + 1)]


# ------------------------------------------------------------------ AXE: grip at the end of the haft, heavy bearded head
def axe(t):
    def build(c):
        haft, grip, head, head_d, fit, torn = _tier(t)
        k = 0.86 + 0.04 * t                     # the head grows with the tier
        x1 = 2.45 + 0.04 * t
        hx = x1 - 0.28 * k
        w = 0.18
        _haft(c, t, -0.55, x1, w)
        _butt(c, t, -0.55, w)
        top, bot = -0.02, -0.62 * k
        hw0, hw1 = 0.16 * k, 0.42 * k
        blade = [(hx - hw0, top), (hx + hw0, top)] + _arc(hx, bot, hw1, 0.16 * k, 0, -180, 14)
        blade = blade[:2] + blade[2:]
        if t >= 3:
            L(c, _poly(blade, torn, 80 + t), head_d, 0.1, 0.06, 'edge')
            inner = [(hx - hw0 * 0.9, top - 0.02), (hx + hw0 * 0.9, top - 0.02)] + _arc(hx, bot + 0.1 * k, hw1 * 0.86, 0.12 * k, 0, -180, 14)
            L(c, inner, head, 0.16, 0.05, 'blade')
        else:
            L(c, _poly(blade, torn, 80 + t), head, 0.1, 0.08, 'blade')
        L(c, R(0.36 * k, 0.42 * k, 0.06, hx, 0.04), M('gold_d') if t == 10 else head_d, 0.2, 0.06, 'eye')
        if t == 1:
            for i in range(3):
                L(c, R(0.05, 0.5 * k, 0.02, hx - 0.12 + i * 0.12, 0.04, 0.4), M('rag_d'), 0.26, 0.03, 'lash')
        if t == 4:
            rivets(c, [hx - 0.1, hx + 0.1], M('bronze'), 0.24, r=0.045, y=-0.3 * k)
        if t >= 6:   # back spike
            L(c, [(hx - 0.12 * k, 0.24 * k), (hx + 0.12 * k, 0.24 * k), (hx, 0.46 * k + 0.02 * t)], head_d, 0.12, 0.06, 'spike')
        if t >= 8:
            _collar(c, t, hx - 0.3 * k, w, 2 if t >= 9 else 1)
        if t == 10:
            for i in range(3):
                L(c, E(0.1, 0.04, hx - 0.12 + i * 0.12, -0.34 * k, 16, 0.5), M('laurel'), 0.24 + i * 0.01, 0.02, 'leaf')
    return build


# ------------------------------------------------------------------ SPEAR: two-handed, longer than the fighter
# both hands near the butt (front hand on the origin, back hand at GRIP2['spear']; the rig bends the back arm to it),
# so most of the shaft is ahead: the point lands on an enemy standing at spear range (#36).
def spear(t):
    def build(c):
        haft, grip, head, head_d, fit, torn = _tier(t)
        k = 0.88 + 0.03 * t
        x0, x1 = -2.4, 4.73 + 0.01 * t   # held at the butt end: ~6.6 units ahead of the front hand
        grips = (0.0, GRIP2['spear'][0])
        if ICON:   # shop picture: a short shaft, so the head is big enough to see
            x0, x1, grips = -1.2, 2.3 + 0.01 * t, (0.0,)
        w = 0.18
        _haft(c, t, x0, x1 + 0.1, w, grips=grips)
        _butt(c, t, x0, w)
        hl = 1.6 * k
        if t == 1:   # a sharpened, fire-hardened pole
            L(c, sl.torn([(x1 - 0.2, 0.11), (x1 + 1.0, 0.0), (x1 - 0.2, -0.11)], 0.015, 90), _wood('charred', '#4a3626'), 0.04, 0.06, 'point')
            L(c, sl.torn(R(0.6, 0.3, 0.06, x1 - 0.2, 0.0), 0.03, 91), M('rag'), 0.1, 0.05, 'binding')
            return
        leaf = 0.12 * k if t in (5, 10) else 0.06 * k

        def head_pts(shorten=0.0):
            return blade_pts(x1, x1 + hl - shorten, 0.15 * k, 0.26 * k, tip=0.7 * k - shorten * 0.5, leaf=leaf, n=12)
        if t >= 6:
            L(c, head_pts(), M('gold') if t == 10 else head_d, 0.06, 0.05, 'edge')
            L(c, inset(head_pts(0.1), 0.74), head, 0.11, 0.05, 'head')
        else:
            L(c, head_pts(), head, 0.06, 0.08, 'head')
        L(c, [(x1 + 0.05, 0.04), (x1 + hl - 0.4 * k, 0.015), (x1 + hl - 0.4 * k, -0.015), (x1 + 0.05, -0.04)], head_d, 0.16, 0.02, 'rib')
        L(c, R(0.55, 0.32, 0.08, x1 - 0.15, 0.0), fit if t >= 4 else head_d, 0.12, 0.06, 'socket')
        if t == 4:
            rivets(c, [x1 - 0.15], M('bronze_d'), 0.18, r=0.05)
        if t >= 8:   # horsehair tassel under the head
            col = {8: M('red'), 9: M('red_d'), 10: M('purple')}[t]
            for s_ in (1, -1):
                L(c, [(x1 - 0.4, 0.0), (x1 - 0.28, 0.04 * s_), (x1 - 0.8, 0.34 * s_), (x1 - 0.9, 0.26 * s_)], col, 0.04, 0.03, 'tassel')
        if t >= 7:
            _collar(c, t, x1 - 0.5, w)
    return build


# ------------------------------------------------------------------ HAMMER: a two-handed war maul, head far heavier than a sword
# front hand on the origin (upper hand), back hand at GRIP2['hammer'] near the end of the haft
def hammer(t):
    def build(c):
        haft, grip, head, head_d, fit, torn = _tier(t)
        k = 0.86 + 0.04 * t
        x0 = GRIP2['hammer'][0] - 0.5
        hw, hh = 1.1 * k, 1.9 * k              # along the haft, across it
        x1 = 3.7 + 0.06 * t
        hx = x1 - hw * 0.5
        w = 0.27
        _haft(c, t, x0, x1, w, grips=(0.0, GRIP2['hammer'][0]))
        _butt(c, t, x0, w)
        if t == 1:   # a log lashed to a pole
            L(c, sl.torn(R(hw, hh, 0.3, hx, 0.0), 0.035, 100), _wood('log', '#7d5e3e'), 0.1, 0.12, 'log')
            for s_ in (1, -1):
                L(c, sl.torn(E(hw * 0.46, 0.1, hx, s_ * hh * 0.5, 20), 0.015, 101), _wood('log_end', '#b0906a'), 0.22, 0.02, 'ring')
            for d in (-0.15, 0.15):
                L(c, sl.torn(R(0.12, 0.9, 0.03, hx + d, 0.0, 0.5), 0.02, 102), M('rag_d'), 0.26, 0.03, 'lash')
            return
        L(c, R(hw, hh, 0.12, hx, 0.0), head, 0.1, 0.12, 'head')
        for s_ in (1, -1):   # striking faces
            L(c, R(hw * 1.1, 0.26 * k, 0.06, hx, s_ * (hh * 0.5 - 0.09 * k)), head_d, 0.22, 0.05, 'face')
        if t in (3, 6):
            for i in range(4):
                L(c, R(hw * 0.9, 0.05, 0.01, hx, -0.33 * k + i * 0.22 * k), head_d, 0.22, 0.02, 'layer')
        if t == 4:
            for y in (0.32 * k, -0.32 * k):
                rivets(c, [hx - 0.22 * k, hx + 0.22 * k], M('bronze'), 0.22, r=0.06, y=y)
        if t >= 5:
            L(c, E(0.2 * k, 0.2 * k, hx, 0.0, 28), fit, 0.22, 0.05, 'boss')
        if t >= 7:   # top spike
            L(c, [(x1 - 0.02, 0.14 * k), (x1 + 0.45 * k, 0.0), (x1 - 0.02, -0.14 * k)], head_d, 0.08, 0.06, 'spike')
        if t >= 8:
            _collar(c, t, hx - hw * 0.5 - 0.1, w, 2 if t >= 9 else 1)
        if t == 10:
            L(c, E(0.11, 0.11, hx, 0.0, 20), M('purple'), 0.28, 0.03, 'gem')
            for s_ in (1, -1):
                L(c, E(0.16, 0.06, hx - 0.06, s_ * 0.34 * k, 16, s_ * 0.5), M('laurel'), 0.28, 0.02, 'leaf')
    return build


AXES = {t: axe(t) for t in range(1, 11)}
SPEARS = {t: spear(t) for t in range(1, 11)}
HAMMERS = {t: hammer(t) for t in range(1, 11)}


# ================================================================== DAGGERS (#47): a matched pair, one in each hand
# The core's starting `daggers` strike twice at 0.6 damage. One sprite serves both hands (kit.json marks it `pair`):
# the rig draws it again on the `weapon_b` bone under the back hand. Grip on the origin like the swords, blade to +x.
def daggers(c):
    L(c, R(0.62, 0.22, 0.08, 0.0, 0.0), M('leather_d'), 0.0, 0.1, 'grip')
    wraps(c, M('leather'), 0.1, n=3, x0=-0.22, x1=0.22, w=0.05, h=0.26)
    L(c, E(0.13, 0.13, -0.38, 0.0, 24), M('bronze'), 0.02, 0.1, 'pommel')
    L(c, [(0.3, 0.3), (0.42, 0.28), (0.42, -0.28), (0.3, -0.3)], M('bronze_d'), 0.08, 0.08, 'guard')
    b = blade_pts(0.4, 1.75, 0.13, 0.08, tip=0.42, leaf=0.04)
    L(c, b, M('steel'), 0.04, 0.06, 'blade')
    L(c, [(0.45, 0.03), (1.45, 0.012), (1.6, 0.0), (1.45, -0.012), (0.45, -0.03)], M('steel_d'), 0.1, 0.02, 'fuller')


# ================================================================== TRIDENT + NET (#254): the retiarius
# One-handed, held a third of the way up the shaft (front hand on the origin), three prongs ahead; the net hangs from the
# back hand (sprite `weapon_net`, kit.json links it from every trident as `offhand`; the rig draws it on `weapon_b`).
def trident(t):
    def build(c):
        haft, grip, head, head_d, fit, torn = _tier(t)
        k = 0.9 + 0.025 * t
        x0, x1 = -1.5, 3.4 + 0.02 * t
        w = 0.16
        _haft(c, t, x0, x1, w)
        _butt(c, t, x0, w)
        pl = 1.05 * k                            # prong length past the crossbar
        if t == 1:   # a fishing fork: whittled wood, the prongs lashed on
            wood = _wood('fork', '#8a6a48')
            L(c, sl.torn(R(0.18, 0.75, 0.05, x1, 0.0), 0.02, 120), wood, 0.06, 0.06, 'bar')
            for y in (-0.3, 0.0, 0.3):
                L(c, sl.torn([(x1, y + 0.06), (x1 + pl * (1.1 if y == 0 else 0.9), y), (x1, y - 0.06)], 0.012, 121 + int(y * 10)), wood, 0.04, 0.05, 'prong')
            L(c, sl.torn(R(0.3, 0.3, 0.05, x1 - 0.12, 0.0), 0.02, 124), M('rag'), 0.12, 0.04, 'lashing')
            return
        L(c, R(0.2, 0.82 * k, 0.06, x1, 0.0), head_d, 0.06, 0.08, 'bar')
        for y in (-0.34 * k, 0.0, 0.34 * k):
            ln = pl * (1.12 if y == 0 else 0.92)
            L(c, [(x1 + 0.05, y + 0.06), (x1 + ln - 0.22, y + 0.05), (x1 + ln, y), (x1 + ln - 0.22, y - 0.05), (x1 + 0.05, y - 0.06)], head, 0.08, 0.06, 'prong')
            if y != 0:   # barbs on the outer prongs, pointing back
                s_ = 1 if y > 0 else -1
                L(c, [(x1 + ln - 0.24, y + 0.05 * s_), (x1 + ln - 0.5, y + 0.16 * s_), (x1 + ln - 0.36, y + 0.04 * s_)], head_d, 0.1, 0.04, 'barb')
        L(c, R(0.45, 0.28, 0.08, x1 - 0.2, 0.0), fit if t >= 4 else head_d, 0.12, 0.06, 'socket')
        if t >= 8:
            col = {8: M('red'), 9: M('red_d'), 10: M('purple')}[t]
            L(c, [(x1 - 0.42, 0.0), (x1 - 0.3, 0.05), (x1 - 0.85, 0.32), (x1 - 0.95, 0.24)], col, 0.04, 0.03, 'tassel')
        if t >= 6:
            _collar(c, t, x1 - 0.5, w)
    return build


def net(c):
    """a fishing net bunched in the fist, hanging down (origin = the fist, -y = down): real holes in the mesh so the body
    shows through, rope folds, lead weights on the hem"""
    rope = sl.tex_board('net_rope', 'craft', tint='#cdb183', scale=0.3)
    k = 1.25
    outline = [(x * k, y * k) for x, y in [(-0.12, 0.1), (0.14, 0.1), (0.5, -0.5), (0.62, -1.3), (0.35, -1.75), (-0.15, -1.85),
                                            (-0.55, -1.6), (-0.6, -0.9), (-0.3, -0.35)]]

    def inside(px, py):
        hit = False
        for i in range(len(outline)):
            (x1, y1), (x2, y2) = outline[i], outline[(i + 1) % len(outline)]
            if (y1 > py) != (y2 > py) and px < (x2 - x1) * (py - y1) / ((y2 - y1) or 1e-9) + x1:
                hit = not hit
        return hit
    holes = []
    step, r = 0.2, 0.088
    for i in range(-6, 7):
        for j in range(1, 26):
            cx, cy = i * step + (j % 2) * step / 2, -0.15 - j * step * 0.5
            diamond = [(cx + r, cy), (cx, cy + r), (cx - r, cy), (cx, cy - r)]
            if all(inside(x + (0.03 if x > cx else -0.03 if x < cx else 0), y + (0.03 if y > cy else -0.03 if y < cy else 0)) for x, y in diamond):
                holes.append(list(reversed(diamond)))
    pc.layer(outline, rope, h=0.04, z=0.0, holes=holes, coll=c, name='net', bevel=0.004)
    for i, (x, y) in enumerate(((0.15, -0.75), (-0.25, -1.25), (0.38, -1.55))):   # thicker folds of rope
        L(c, R(0.05, 0.8, 0.02, x, y, 0.2 - i * 0.25), M('leather_l'), 0.05, 0.02, 'fold')
    for x, y in ((0.68, -1.8), (0.3, -2.25), (-0.2, -2.33), (-0.65, -2.08), (-0.75, -1.4)):
        L(c, E(0.08, 0.08, x, y, 16), M('iron_d'), 0.06, 0.05, 'weight')
    L(c, E(0.18, 0.14, 0.0, 0.0, 20), M('leather_l'), 0.08, 0.05, 'knot')


TRIDENTS = {t: trident(t) for t in range(1, 11)}
