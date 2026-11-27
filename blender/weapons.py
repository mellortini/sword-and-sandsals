"""Weapon sprites: swords tier 1-10 (#184), matching the armour sets in armor.py (1 = scrapwood and rags ... 10 = gold).

Every builder works in weapon-bone space like the gladius in build_kit.py: the grip is centred on the origin
(x -0.39 .. 0.39, under the hand), the pommel sits at x < -0.39, the blade points to +x. The pivot is the origin,
so the hand holds every sword at the same point as the gladius. Axes, spears and hammers (#36) go here too.
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
