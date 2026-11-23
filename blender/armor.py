"""10 armour sets (tier 1 = beggar's rags ... tier 10 = gilded legend). Every set has the same slots:

  helmet{t}              head bone
  armor{t}_torso         torso bone      armor{t}_skirt  pelvis bone      armor{t}_bracer  arm_lo bone
  shoulders{t}           arm_up bone
  greaves{t}_shin        leg_lo bone     greaves{t}_knee leg_lo bone (drawn over the thigh)
  boots{t}_foot          foot bone       boots{t}_cuff   leg_lo bone

Pieces are built in bone-local coordinates on top of the body shapes from kit.py, so each set fits every body.
PIECES[(slot, t)] = builder(coll). Missing keys = that set has no such piece.
"""
import math
import random
import sprite_lib as sl
import kit

pc = sl.pc
L, E, R = kit.L, kit.E, kit.R


# ------------------------------------------------------------------ materials
def M(name):
    f = {
        'rag': lambda: sl.tex_board('rag', 'craft', tint='#b9ad94', scale=0.35),
        'rag_d': lambda: sl.tex_board('rag_d', 'craft', tint='#978a6e', scale=0.35),
        'linen': lambda: sl.tex_paper('linen', '#e8dfc9', 'washi', 1.0),
        'linen_d': lambda: sl.tex_paper('linen_d', '#cfc2a3', 'washi', 1.0),
        'quilt': lambda: pc.pattern_mat('quilt', 'hstripes', '#e6dcc3', '#cdbf9e', freq=4.5, ratio=0.82, grit=0.5),
        'leather': lambda: sl.tex_board('leather', 'brown', tint='#8a5a3a', scale=0.35),
        'leather_d': lambda: sl.tex_board('leather_d', 'brown', tint='#64402a', scale=0.35),
        'leather_l': lambda: sl.tex_board('leather_l', 'kraft', scale=0.35),
        'bronze': lambda: sl.foil('bronze', '#c8955a', metal=0.6, rough=0.36, emit=0.22),
        'bronze_d': lambda: sl.foil('bronze_d', '#a9784a', metal=0.6, rough=0.4, emit=0.18),
        'iron': lambda: sl.foil('iron', '#8d939b', metal=0.7, rough=0.45, emit=0.12),
        'iron_d': lambda: sl.foil('iron_d', '#6f747c', metal=0.7, rough=0.5, emit=0.1),
        'steel': lambda: sl.foil('steel', '#c9ccd2', metal=0.75, rough=0.3, emit=0.16),
        'steel_d': lambda: sl.foil('steel_d', '#9fa3ab', metal=0.7, rough=0.35, emit=0.12),
        'brass': lambda: sl.foil('brass', '#d6a84a', metal=0.65, rough=0.32, emit=0.26),
        'gold': lambda: sl.foil('gold', '#e8be4c', metal=0.7, rough=0.26, emit=0.32),
        'gold_d': lambda: sl.foil('gold_d', '#b88a2e', metal=0.65, rough=0.32, emit=0.24),
        'chain': lambda: pc.pattern_mat('chain', 'polka', '#a3a9b1', '#4d525a', freq=9.0, ratio=0.62, grit=0.4),
        'red': lambda: sl.tex_paper('red', '#a7281f', 'washi', 0.9),
        'red_d': lambda: sl.tex_paper('red_d', '#7e1d17', 'washi', 0.9),
        'purple': lambda: sl.tex_paper('purple', '#5b2c83', 'washi', 0.9),
        'white': lambda: sl.tex_paper('white', '#f4efe6', 'washi', 0.9),
        'fur': lambda: sl.tex_paper('fur', '#d9cbb0', 'washi', 1.0),
        'laurel': lambda: sl.tex_paper('laurel', '#6f8a3a', 'washi', 0.9),
    }[name]
    return f()


TORSO = kit.torso_outline()


def torso_part(y0, y1, grow=1.05):
    return sl.clip_y(sl.scale_about(TORSO, grow, 1.0, 0.0, 1.5), y0, y1)


def inside(pts, x, y):
    c = False
    n = len(pts)
    for i in range(n):
        x1, y1 = pts[i]
        x2, y2 = pts[(i + 1) % n]
        if (y1 > y) != (y2 > y) and x < (x2 - x1) * (y - y1) / ((y2 - y1) or 1e-9) + x1:
            c = not c
    return c


def studs(c, pts_area, mat, z, spacing=0.36, r=0.06, rows=None, seed=0):
    xs = [p[0] for p in pts_area]
    ys = [p[1] for p in pts_area]
    k = 0
    y = min(ys) + spacing * 0.6
    while y < max(ys) - spacing * 0.4:
        x = min(xs) + spacing * (0.6 + 0.5 * (k % 2))
        while x < max(xs) - spacing * 0.4:
            if inside(pts_area, x, y):
                L(c, E(r, r, x, y, 16), mat, z, 0.04, 'stud')
            x += spacing
        y += spacing
        k += 1


def scales(c, area, mat_a, mat_b, z, w=0.3, h=0.3):
    """overlapping scale rows (lower rows on top), each scale a rounded tongue pointing down"""
    xs = [p[0] for p in area]
    ys = [p[1] for p in area]
    row = 0
    y = max(ys) - h * 0.4
    while y > min(ys) + h * 0.1:
        x = min(xs) + (w * 0.5 if row % 2 else 0)
        col = 0
        while x < max(xs) + w * 0.2:
            if inside(area, x, y - h * 0.3):
                tongue = [(x - w / 2, y)] + [(x + w / 2 * math.cos(math.radians(a)), y - h * 0.45 + h * 0.55 * math.sin(math.radians(a))) for a in range(0, -181, -15)] + [(x + w / 2, y)]
                tongue = list(reversed(tongue))
                L(c, tongue, mat_a if (row + col) % 3 else mat_b, z + row * 0.03 + col * 0.0007, 0.03, 'scale')
            x += w
            col += 1
        y -= h * 0.62
        row += 1


def strap(c, p0, p1, w, mat, z, h=0.05, name='strap'):
    dx, dy = p1[0] - p0[0], p1[1] - p0[1]
    ln = math.hypot(dx, dy)
    return L(c, R(ln, w, min(w, ln) * 0.3, (p0[0] + p1[0]) / 2, (p0[1] + p1[1]) / 2, math.atan2(dy, dx)), mat, z, h, name)


def pteruges(c, mat, tip, z, n=7, y0=-0.18, ln=1.05, w=0.3, x0=-1.05, x1=1.05, tipmat=None):
    """leather strip skirt hanging from the belt"""
    for i in range(n):
        x = x0 + (x1 - x0) * i / (n - 1)
        zz = z + (i % 2) * 0.05
        L(c, R(w, ln, 0.06, x, y0 - ln / 2), mat, zz, 0.05, 'pteryx')
        if tip:
            L(c, R(w * 0.9, 0.18, 0.05, x, y0 - ln + 0.12), tipmat or tip, zz + 0.05, 0.03, 'tip')


def limb_band(prof, t0, t1, mat, z, grow=0.05, curve=0.06, torn_amp=0.0, seed=0, name='band'):
    pts = sl.band(prof[0], prof[1], t0, t1, grow, curve)
    if torn_amp:
        pts = sl.torn(pts, torn_amp, seed)
    return L(prof_c[0], pts, mat, z, 0.06, name)


prof_c = [None]


def lb(c, prof, t0, t1, mat, z, grow=0.05, curve=0.06, torn_amp=0.0, seed=0, name='band'):
    prof_c[0] = c
    return limb_band(prof, t0, t1, mat, z, grow, curve, torn_amp, seed, name)


def wraplines(c, prof, t0, t1, mat, z, n=3, ang=0.4):
    ln = prof[0]
    for i in range(n):
        t = t0 + (t1 - t0) * (i + 0.5) / n
        wl = 0.55
        L(c, R(wl * 1.25, 0.055, 0.025, 0.0, -t * ln, ang * (1 if i % 2 else -1)), mat, z, 0.02, 'wrapline')


# ================================================================== HELMETS (head bone, before HEAD_S)
CAP = lambda rx=1.2, ry=0.95, cy=1.62, a0=196, a1=-16: [(0.1 + rx * math.cos(math.radians(a)), cy + ry * math.sin(math.radians(a))) for a in range(a0, a1 - 1, -6)]


def crest(c, mat, z, n=13, r=1.05, cy=1.75, length=0.85, spread=11, start=160, width=0.17):
    for i in range(n):
        a = math.radians(start - i * spread)
        cx, yy = 0.1 + r * math.cos(a), cy + r * 0.9 * math.sin(a)
        L(c, R(width, length, 0.08, cx + 0.32 * math.cos(a), yy + 0.32 * math.sin(a), a - math.pi / 2), mat, z + (i % 2) * 0.04, 0.05, 'crest')


def helmet1(c):          # rag head wrap
    pts = sl.torn(CAP(1.16, 0.72, 1.7, 192, -12) + [(1.2, 1.62), (-1.0, 1.55)], 0.04, 3)
    L(c, pts, M('rag'), 0.0, 0.08, 'wrap')
    L(c, sl.torn(R(2.3, 0.28, 0.1, 0.1, 1.68, 0.03), 0.03, 4), M('rag_d'), 0.08, 0.05, 'band')
    L(c, sl.torn([(-1.0, 1.75), (-1.55, 1.4), (-1.45, 1.1), (-1.05, 1.55)], 0.03, 5), M('rag'), -0.06, 0.05, 'tail')
    L(c, sl.torn([(-1.0, 1.7), (-1.35, 1.0), (-1.15, 0.9), (-0.95, 1.5)], 0.03, 6), M('rag_d'), -0.1, 0.04, 'tail2')


def helmet2(c):          # leather cap
    L(c, CAP(1.18, 0.88, 1.62) + [(1.28, 1.6), (-1.06, 1.55)], M('leather'), 0.0, 0.1, 'cap')
    L(c, R(2.42, 0.2, 0.08, 0.1, 1.6), M('leather_d'), 0.1, 0.05, 'rim')
    L(c, R(0.08, 0.85, 0.03, 0.1, 2.15), M('leather_d'), 0.1, 0.03, 'seam')


def helmet3(c):          # padded linen coif
    pts = CAP(1.24, 1.0, 1.55, 200, -14) + [(1.2, 1.4), (1.0, 1.5), (-0.6, 1.45), (-0.75, 0.6), (-1.15, 0.45), (-1.25, 1.0)]
    L(c, pts, M('quilt'), 0.0, 0.1, 'coif')
    L(c, R(2.3, 0.22, 0.1, 0.12, 1.55), M('linen_d'), 0.1, 0.05, 'rim')


def helmet4(c):          # studded leather cap with nasal
    cap = CAP(1.2, 0.92, 1.6) + [(1.3, 1.58), (-1.08, 1.52)]
    L(c, cap, M('leather'), 0.0, 0.1, 'cap')
    L(c, R(2.48, 0.24, 0.1, 0.1, 1.58), M('leather_d'), 0.1, 0.05, 'rim')
    L(c, R(0.16, 0.62, 0.06, 0.42, 1.3), M('iron'), 0.15, 0.05, 'nasal')
    studs(c, sl.clip_y(cap, 1.75, 3), M('bronze'), 0.1, 0.34, 0.06)
    for x in (-0.7, -0.2, 0.5, 1.0):
        L(c, E(0.06, 0.06, x, 1.58, 16), M('bronze'), 0.16, 0.04, 'stud')


def helmet5(c):          # bronze recruit cap with short crest
    L(c, CAP(1.22, 0.98, 1.6) + [(1.3, 1.56), (-1.1, 1.5)], M('bronze'), 0.0, 0.12, 'cap')
    L(c, R(2.56, 0.26, 0.1, 0.12, 1.52), M('bronze_d'), 0.12, 0.06, 'brim')
    L(c, R(0.36, 0.3, 0.1, 0.1, 2.62), M('bronze_d'), 0.12, 0.05, 'knob')
    crest(c, M('red'), -0.1, n=7, r=1.0, length=0.45, spread=14, start=135, width=0.15)


def helmet6(c):          # iron galea: neck + cheek guards
    L(c, CAP(1.2, 0.98, 1.6) + [(1.28, 1.55), (-1.08, 1.5)], M('iron'), 0.0, 0.12, 'cap')
    L(c, [(-1.05, 1.62), (-1.0, 1.25), (-1.55, 1.05), (-1.6, 1.25), (-1.2, 1.6)], M('iron_d'), -0.06, 0.06, 'neckguard')
    L(c, R(2.5, 0.22, 0.08, 0.12, 1.56), M('iron_d'), 0.12, 0.05, 'brow')
    L(c, [(-0.72, 1.5), (-0.36, 1.5), (-0.32, 0.85), (-0.58, 0.62), (-0.8, 0.9)], M('iron'), 0.18, 0.06, 'cheek_n')
    L(c, [(0.98, 1.5), (1.18, 1.5), (1.2, 0.9), (1.02, 0.75)], M('iron_d'), 0.18, 0.06, 'cheek_f')
    for x in (-0.55, 0.3, 1.05):
        L(c, E(0.055, 0.055, x, 1.56, 16), M('brass'), 0.18, 0.03, 'rivet')


def helmet7(c):          # chain coif + iron cap
    hood = [(0.1 + 1.36 * math.cos(math.radians(a)), 1.3 + 1.25 * math.sin(math.radians(a))) for a in range(206, -27, -6)]
    hood += [(1.35, 0.6), (1.1, 0.0), (0.2, -0.25), (-0.9, -0.05), (-1.25, 0.6)]
    face = [(0.12 + 0.95 * math.cos(math.radians(a)), 1.0 + 0.92 * math.sin(math.radians(a))) for a in range(0, 360, 10)]
    pc.layer(hood, M('chain'), h=0.08, z=0.0, holes=[face], coll=c, name='coif', bevel=0.01)
    L(c, CAP(1.2, 0.92, 1.66) + [(1.28, 1.62), (-1.08, 1.58)], M('iron'), 0.08, 0.1, 'cap')
    L(c, R(2.5, 0.2, 0.08, 0.12, 1.62), M('iron_d'), 0.18, 0.05, 'rim')


def helmet8(c):          # imperial galea, red crest
    L(c, CAP(1.24, 1.0, 1.6) + [(1.3, 1.55), (-1.1, 1.5)], M('steel'), 0.0, 0.12, 'cap')
    L(c, [(-1.08, 1.62), (-1.02, 1.2), (-1.7, 0.95), (-1.75, 1.2), (-1.25, 1.62)], M('steel_d'), -0.06, 0.06, 'neckguard')
    L(c, R(2.6, 0.24, 0.1, 0.12, 1.55), M('brass'), 0.12, 0.05, 'brow')
    L(c, [(-0.74, 1.5), (-0.34, 1.5), (-0.3, 0.82), (-0.58, 0.58), (-0.82, 0.88)], M('steel'), 0.18, 0.06, 'cheek_n')
    L(c, [(-0.72, 1.45), (-0.38, 1.45), (-0.4, 1.3), (-0.7, 1.3)], M('brass'), 0.24, 0.03, 'cheek_trim')
    L(c, [(0.98, 1.5), (1.2, 1.5), (1.22, 0.88), (1.02, 0.72)], M('steel_d'), 0.18, 0.06, 'cheek_f')
    L(c, R(0.3, 0.32, 0.08, 0.1, 2.62), M('brass'), 0.12, 0.05, 'holder')
    crest(c, M('red'), -0.12)


def helmet9(c):          # champion: wide brim + tall fin crest
    L(c, CAP(1.2, 1.02, 1.62) + [(1.3, 1.58), (-1.1, 1.52)], M('bronze'), 0.0, 0.12, 'cap')
    L(c, [(-1.6, 1.5), (1.75, 1.5), (1.85, 1.66), (1.4, 1.74), (-1.3, 1.72), (-1.7, 1.62)], M('bronze_d'), 0.12, 0.06, 'brim')
    L(c, R(3.0, 0.08, 0.04, 0.08, 1.7), M('gold'), 0.2, 0.03, 'brim_trim')
    # curved fish-fin crest sweeping back (left) from the brow to the nape
    outer = [(0.1 + 1.55 * math.cos(math.radians(a)), 1.55 + 1.75 * math.sin(math.radians(a))) for a in range(20, 171, 6)]
    inner = [(0.1 + 1.05 * math.cos(math.radians(a)), 1.55 + 1.12 * math.sin(math.radians(a))) for a in range(165, 24, -6)]
    L(c, outer + inner, M('bronze_d'), -0.12, 0.08, 'fin')
    o2 = [(0.1 + 1.45 * math.cos(math.radians(a)), 1.55 + 1.62 * math.sin(math.radians(a))) for a in range(28, 163, 6)]
    i2 = [(0.1 + 1.14 * math.cos(math.radians(a)), 1.55 + 1.24 * math.sin(math.radians(a))) for a in range(158, 32, -6)]
    L(c, o2 + i2, M('red'), -0.04, 0.04, 'fin_in')
    for a in range(40, 161, 20):
        r0, r1 = 1.12, 1.46
        ca, sa = math.cos(math.radians(a)), math.sin(math.radians(a))
        strap(c, (0.1 + r0 * ca, 1.55 + r0 * 1.1 * sa), (0.1 + r1 * ca, 1.55 + r1 * 1.1 * sa), 0.06, M('gold'), 0.0, 0.02, 'fin_rib')
    L(c, [(-0.74, 1.5), (-0.36, 1.5), (-0.32, 0.85), (-0.58, 0.6), (-0.8, 0.9)], M('bronze'), 0.18, 0.06, 'cheek_n')
    L(c, E(0.12, 0.12, -0.54, 1.12, 24), M('gold'), 0.24, 0.03, 'rosette')


def helmet10(c):         # gilded legend: gold, laurel, tall plume
    L(c, CAP(1.24, 1.02, 1.6) + [(1.3, 1.55), (-1.1, 1.5)], M('gold'), 0.0, 0.12, 'cap')
    L(c, [(-1.08, 1.62), (-1.02, 1.2), (-1.7, 0.95), (-1.75, 1.2), (-1.25, 1.62)], M('gold_d'), -0.06, 0.06, 'neckguard')
    L(c, R(2.62, 0.26, 0.1, 0.12, 1.55), M('gold_d'), 0.12, 0.05, 'brow')
    for i in range(9):
        a = math.radians(170 - i * 19)
        x, y = 0.1 + 1.0 * math.cos(a), 1.82 + 0.36 * math.sin(a)
        L(c, E(0.2, 0.09, x, y, 20, a + 0.7), M('laurel'), 0.17 + (i % 2) * 0.02, 0.03, 'leaf')
    L(c, [(-0.74, 1.5), (-0.34, 1.5), (-0.3, 0.82), (-0.58, 0.58), (-0.82, 0.88)], M('gold'), 0.18, 0.06, 'cheek_n')
    L(c, E(0.11, 0.11, -0.55, 1.1, 24), M('purple'), 0.24, 0.03, 'gem')
    L(c, R(0.32, 0.36, 0.08, 0.1, 2.62), M('gold_d'), 0.12, 0.05, 'holder')
    crest(c, M('white'), -0.14, n=15, r=1.08, length=1.15, spread=10, start=165, width=0.2)
    crest(c, M('purple'), -0.2, n=8, r=1.05, length=0.7, spread=18, start=155, width=0.18)


# ================================================================== ARMOUR: torso / skirt / bracer
def armor1_torso(c):
    p = sl.torn(R(0.62, 3.6, 0.1, 0.05, 1.5, -0.72), 0.05, 11)
    L(c, sl.clip_y(p, 0.0, 3.05), M('rag'), 0.0, 0.06, 'sash')
    L(c, sl.torn(E(0.28, 0.22, 0.95, 0.28), 0.04, 12), M('rag_d'), 0.06, 0.05, 'knot')
    L(c, sl.torn([(0.9, 0.2), (1.25, -0.4), (1.05, -0.45), (0.8, 0.1)], 0.03, 13), M('rag'), -0.04, 0.04, 'end')


def armor1_bracer(c):
    lb(c, kit.ARM_LO, 0.5, 0.95, M('rag'), 0.0, 0.04, 0.05, 0.035, 21)
    wraplines(c, kit.ARM_LO, 0.52, 0.92, M('rag_d'), 0.06, 2)


def armor2_torso(c):
    strap(c, (-1.45, 2.85), (0.95, 0.15), 0.34, M('leather'), 0.0)
    strap(c, (1.5, 2.85), (-0.95, 0.15), 0.34, M('leather_d'), 0.06)
    ring = E(0.24, 0.24, 0.02, 1.48, 32)
    pc.layer(ring, M('iron'), h=0.05, z=0.12, holes=[list(reversed(E(0.13, 0.13, 0.02, 1.48, 32)))], coll=c, name='ring', bevel=0.01)


def armor2_bracer(c):
    lb(c, kit.ARM_LO, 0.58, 0.94, M('leather'), 0.0, 0.05, 0.05)
    L(c, R(0.6, 0.06, 0.02, 0.0, -1.2), M('leather_d'), 0.06, 0.02, 'lace')


def armor3_torso(c):
    L(c, torso_part(0.05, 2.78, 1.05), M('quilt'), 0.0, 0.1, 'gambeson')
    L(c, sl.clip_y(sl.scale_about(TORSO, 0.55, 1.0, 0.0, 1.5), 2.62, 3.0), M('linen_d'), 0.1, 0.05, 'collar')
    L(c, R(2.25, 0.16, 0.06, 0.0, 0.14), M('linen_d'), 0.1, 0.04, 'hem')


def armor3_bracer(c):
    lb(c, kit.ARM_LO, 0.5, 0.96, M('linen'), 0.0, 0.05, 0.05)
    wraplines(c, kit.ARM_LO, 0.52, 0.94, M('linen_d'), 0.06, 3)


def armor3_skirt(c):
    L(c, [(-1.1, -0.18), (1.1, -0.18), (1.2, -0.95), (-1.2, -0.95)], M('quilt'), 0.0, 0.06, 'skirt')


def armor4_torso(c):
    area = torso_part(0.05, 2.82, 1.05)
    L(c, area, M('leather'), 0.0, 0.1, 'vest')
    L(c, R(2.3, 0.18, 0.06, 0.0, 0.14), M('leather_d'), 0.1, 0.04, 'hem')
    studs(c, sl.clip_y(sl.scale_about(area, 0.9, 0.95, 0.0, 1.4), 0.3, 2.7), M('bronze'), 0.1, 0.4, 0.065)


def armor4_skirt(c):
    pteruges(c, M('leather'), None, 0.0, n=7)
    for i in range(7):
        L(c, E(0.05, 0.05, -1.05 + 2.1 * i / 6, -0.62, 16), M('bronze'), 0.12, 0.03, 'stud')


def armor4_bracer(c):
    lb(c, kit.ARM_LO, 0.5, 0.95, M('leather'), 0.0, 0.05, 0.05)
    for t in (0.62, 0.78):
        L(c, E(0.05, 0.05, 0.12, -t * kit.ARM_LO[0], 16), M('bronze'), 0.06, 0.03, 'stud')


def armor5_torso(c):
    strap(c, (-1.25, 2.95), (-0.45, 1.9), 0.3, M('leather'), 0.0)
    strap(c, (1.35, 2.95), (0.65, 1.9), 0.3, M('leather'), 0.0)
    L(c, R(2.5, 0.3, 0.1, 0.05, 1.12), M('leather_d'), 0.05, 0.05, 'girth')
    L(c, E(0.66, 0.62, 0.1, 2.05, 48), M('bronze'), 0.1, 0.08, 'disc')
    L(c, E(0.46, 0.43, 0.1, 2.05, 48), M('bronze_d'), 0.18, 0.04, 'ring')
    L(c, E(0.16, 0.16, 0.1, 2.05, 24), M('bronze'), 0.22, 0.04, 'boss')


def armor5_skirt(c):
    pteruges(c, M('leather'), M('bronze'), 0.0, n=6, ln=0.9)


def armor5_bracer(c):
    lb(c, kit.ARM_LO, 0.55, 0.93, M('bronze'), 0.0, 0.05, 0.05)
    L(c, sl.band(kit.ARM_LO[0], kit.ARM_LO[1], 0.6, 0.66, 0.06, 0.05), M('bronze_d'), 0.06, 0.02, 'ridge')


def armor6_torso(c):
    area = torso_part(0.05, 2.86, 1.06)
    L(c, area, M('leather_d'), 0.0, 0.06, 'backing')
    scales(c, area, M('iron'), M('iron_d'), 0.06, 0.3, 0.3)
    L(c, sl.clip_y(sl.scale_about(TORSO, 0.6, 1.0, 0.0, 1.5), 2.7, 3.02), M('leather'), 0.5, 0.04, 'collar')


def armor6_skirt(c):
    pteruges(c, M('leather_d'), M('iron'), 0.0, n=7)


def armor6_bracer(c):
    lb(c, kit.ARM_LO, 0.48, 0.95, M('leather_d'), 0.0, 0.05, 0.05)
    lb(c, kit.ARM_LO, 0.56, 0.86, M('iron'), 0.06, 0.06, 0.05)


def armor7_torso(c):
    area = torso_part(0.0, 2.92, 1.06)
    L(c, area, M('chain'), 0.0, 0.08, 'mail')
    L(c, sl.clip_y(sl.scale_about(TORSO, 0.6, 1.0, 0.0, 1.5), 2.72, 3.02), M('iron_d'), 0.08, 0.04, 'collar')
    L(c, R(2.35, 0.14, 0.05, 0.0, 0.08), M('iron_d'), 0.08, 0.04, 'hem')


def armor7_skirt(c):
    L(c, [(-1.14, -0.18), (1.14, -0.18), (1.24, -0.85), (-1.24, -0.85)], M('chain'), 0.0, 0.06, 'skirt')
    L(c, R(2.5, 0.12, 0.05, 0.0, -0.85), M('iron_d'), 0.06, 0.03, 'hem')


def armor7_bracer(c):
    lb(c, kit.ARM_LO, 0.45, 0.95, M('iron'), 0.0, 0.06, 0.06)
    L(c, sl.band(kit.ARM_LO[0], kit.ARM_LO[1], 0.47, 0.53, 0.07, 0.06), M('iron_d'), 0.06, 0.02, 'rim')


def armor8_torso(c):
    k = 0
    for y0 in (1.65, 1.25, 0.85, 0.45, 0.05):
        L(c, torso_part(y0, y0 + 0.48, 1.06 + k * 0.004), M('steel') if k % 2 == 0 else M('steel_d'), k * 0.05, 0.05, 'hoop')
        k += 1
    L(c, torso_part(2.0, 2.95, 1.07), M('steel'), 0.3, 0.06, 'chest')
    L(c, R(0.08, 0.95, 0.03, 0.06, 2.45), M('steel_d'), 0.36, 0.02, 'split')
    for x, y in ((-0.6, 2.3), (0.72, 2.3), (-0.6, 2.7), (0.72, 2.7)):
        L(c, E(0.07, 0.07, x, y, 16), M('brass'), 0.36, 0.03, 'rivet')
    L(c, R(0.28, 0.22, 0.06, 0.06, 2.1), M('brass'), 0.36, 0.03, 'buckle')


def armor8_skirt(c):
    pteruges(c, M('leather'), M('red'), 0.0, n=8, ln=1.1, w=0.26)


def armor8_bracer(c):
    for i, t in enumerate((0.2, 0.36, 0.52, 0.68, 0.84)):
        L(c, sl.band(kit.ARM_LO[0], kit.ARM_LO[1], t, t + 0.18, 0.07, 0.05), M('steel') if i % 2 == 0 else M('steel_d'), 0.3 - i * 0.05, 0.05, 'lame')


def _cuirass(c, metal, metal_l, trim):
    area = torso_part(0.0, 2.96, 1.06)
    L(c, area, M(metal), 0.0, 0.1, 'cuirass')
    hi = M(metal_l)
    L(c, pc.xf(pc.blob_pts(0.7, 0.44, 0.04, 2), -0.58, 2.16), hi, 0.1, 0.05, 'pec_l')
    L(c, pc.xf(pc.blob_pts(0.76, 0.46, 0.04, 5), 0.72, 2.16), hi, 0.16, 0.05, 'pec_r')
    for y in (1.4, 0.98, 0.58):
        for x in (-0.24, 0.42):
            L(c, R(0.5, 0.34, 0.14, x, y), hi, 0.1, 0.04, 'ab')
    L(c, R(2.3, 0.16, 0.06, 0.0, 0.1), M(trim), 0.16, 0.04, 'trim')
    L(c, sl.clip_y(sl.scale_about(TORSO, 0.58, 1.0, 0.0, 1.5), 2.78, 3.05), M(trim), 0.16, 0.04, 'neck_trim')


def armor9_torso(c):
    _cuirass(c, 'bronze', 'bronze_d', 'gold')


def armor9_skirt(c):
    pteruges(c, M('red_d'), None, 0.0, n=8, ln=1.12, w=0.27)
    pteruges(c, M('leather'), M('gold'), 0.12, n=7, ln=0.8, w=0.3, x0=-0.95, x1=0.95)


def armor9_bracer(c):
    for i, t in enumerate((0.2, 0.38, 0.56, 0.74)):
        L(c, sl.band(kit.ARM_LO[0], kit.ARM_LO[1], t, t + 0.2, 0.07, 0.05), M('bronze') if i % 2 == 0 else M('bronze_d'), 0.3 - i * 0.05, 0.05, 'lame')
    L(c, sl.band(kit.ARM_LO[0], kit.ARM_LO[1], 0.9, 0.96, 0.08, 0.05), M('gold'), 0.35, 0.02, 'cuff')


def armor10_torso(c):
    _cuirass(c, 'gold', 'gold_d', 'gold_d')
    L(c, sl.clip_y(R(0.55, 3.8, 0.1, 0.0, 1.4, -0.68), 0.0, 3.05), M('purple'), 0.22, 0.05, 'sash')
    cx, cy = 0.08, 1.55
    for i in range(14):
        a = i / 14 * math.tau
        L(c, E(0.13, 0.08, cx + 0.3 * math.cos(a), cy + 0.3 * math.sin(a), 16, a), M('gold_d'), 0.3, 0.03, 'mane')
    L(c, E(0.24, 0.26, cx, cy, 32), M('gold'), 0.34, 0.04, 'lion')
    L(c, E(0.08, 0.06, cx + 0.03, cy - 0.04, 16), M('gold_d'), 0.38, 0.02, 'snout')


def armor10_skirt(c):
    L(c, [(-1.15, -0.18), (1.15, -0.18), (1.3, -1.25), (-1.3, -1.25)], M('purple'), 0.0, 0.05, 'cloth')
    pteruges(c, M('gold_d'), M('gold'), 0.08, n=8, ln=0.95, w=0.27)


def armor10_bracer(c):
    for i, t in enumerate((0.2, 0.38, 0.56, 0.74)):
        L(c, sl.band(kit.ARM_LO[0], kit.ARM_LO[1], t, t + 0.2, 0.07, 0.05), M('gold') if i % 2 == 0 else M('gold_d'), 0.3 - i * 0.05, 0.05, 'lame')


# ================================================================== SHOULDERS (arm_up bone; the shoulder cap is the top of the limb)
def _dome(rx=0.66, top=0.62, bottom=-0.55):
    pts = [(rx * math.cos(math.radians(a)), (top - 0.1) * math.sin(math.radians(a)) + 0.1) for a in range(0, 181, 10)]
    return pts + [(-rx * 0.92, bottom + 0.1), (-rx * 0.7, bottom), (rx * 0.7, bottom), (rx * 0.92, bottom + 0.1)]


def shoulders1(c):
    L(c, sl.torn(_dome(0.62, 0.55, -0.5), 0.05, 31), M('rag'), 0.0, 0.06, 'rag')
    L(c, sl.torn(R(1.25, 0.16, 0.06, 0.0, -0.32, 0.15), 0.03, 32), M('rag_d'), 0.06, 0.04, 'tie')


def shoulders2(c):
    L(c, _dome(0.6, 0.56, -0.42), M('leather'), 0.0, 0.08, 'pad')
    L(c, R(1.1, 0.12, 0.05, 0.0, -0.2), M('leather_d'), 0.08, 0.03, 'strap')


def shoulders3(c):
    L(c, _dome(0.64, 0.6, -0.6), M('quilt'), 0.0, 0.08, 'pad')
    L(c, R(1.25, 0.14, 0.06, 0.0, -0.5), M('linen_d'), 0.08, 0.04, 'hem')


def shoulders4(c):
    d = _dome(0.64, 0.6, -0.55)
    L(c, d, M('leather'), 0.0, 0.08, 'pad')
    studs(c, d, M('bronze'), 0.08, 0.3, 0.055)


def shoulders5(c):
    L(c, E(0.6, 0.58, 0.0, 0.08, 48), M('bronze'), 0.0, 0.08, 'disc')
    L(c, E(0.4, 0.38, 0.0, 0.08, 48), M('bronze_d'), 0.08, 0.04, 'ring')
    L(c, E(0.13, 0.13, 0.0, 0.08, 24), M('bronze'), 0.12, 0.04, 'boss')


def shoulders6(c):
    d = _dome(0.68, 0.64, -0.7)
    L(c, d, M('leather_d'), 0.0, 0.05, 'backing')
    scales(c, d, M('iron'), M('iron_d'), 0.05, 0.28, 0.28)


def shoulders7(c):
    L(c, sl.clip_y(_dome(0.62, 0.62, -0.85), -1.0, 0.7), M('chain'), 0.0, 0.06, 'sleeve')
    L(c, sl.band(kit.ARM_UP[0], kit.ARM_UP[1], 0.42, 0.48, 0.08, 0.08), M('iron_d'), 0.06, 0.03, 'hem')


def _lames(c, a, b, trim=None, n=4):
    for i in range(n):
        y = 0.38 - i * 0.28
        w = 0.66 + i * 0.02
        arc = sl.arc_pts(0.0, y - 0.55, 0.45, 0.72, 25, 155)
        arc = [(x * w / 0.72, yy) for x, yy in arc]
        L(c, arc, M(a) if i % 2 == 0 else M(b), 0.05 * i, 0.05, 'lame')
        if trim:
            L(c, sl.arc_pts(0.0, y - 0.55, 0.66, 0.72, 25, 155), M(trim), 0.05 * i + 0.05, 0.02, 'trim')


def shoulders8(c):
    _lames(c, 'steel', 'steel_d')
    L(c, E(0.07, 0.07, 0.0, 0.42, 16), M('brass'), 0.22, 0.03, 'rivet')


def shoulders9(c):
    _lames(c, 'bronze', 'bronze_d', 'gold', 3)
    L(c, E(0.13, 0.13, 0.0, 0.3, 24), M('gold'), 0.2, 0.04, 'rosette')


def shoulders10(c):
    L(c, _dome(0.7, 0.66, -0.66), M('gold'), 0.0, 0.08, 'dome')
    for i in range(12):
        a = i / 12 * math.tau
        L(c, E(0.11, 0.07, 0.3 * math.cos(a), 0.05 + 0.3 * math.sin(a), 16, a), M('gold_d'), 0.08, 0.03, 'mane')
    L(c, E(0.2, 0.22, 0.0, 0.05, 32), M('gold'), 0.12, 0.04, 'lion')
    L(c, E(0.07, 0.05, 0.02, 0.0, 16), M('gold_d'), 0.16, 0.02, 'snout')


# ================================================================== GREAVES (leg_lo bone: knee at 0, ankle at -2.05)
def greaves1_shin(c):
    lb(c, kit.LEG_LO, 0.2, 0.82, M('rag'), 0.0, 0.04, 0.05, 0.04, 41)
    wraplines(c, kit.LEG_LO, 0.22, 0.8, M('rag_d'), 0.06, 4)


def greaves2_shin(c):
    lb(c, kit.LEG_LO, 0.22, 0.78, M('leather'), 0.0, 0.04, 0.05)
    for t in (0.35, 0.5, 0.65):
        L(c, R(0.6, 0.05, 0.02, 0.0, -t * kit.LEG_LO[0], 0.3), M('leather_d'), 0.06, 0.02, 'lace')


def greaves3_shin(c):
    lb(c, kit.LEG_LO, 0.15, 0.84, M('linen'), 0.0, 0.04, 0.05)
    wraplines(c, kit.LEG_LO, 0.17, 0.82, M('linen_d'), 0.06, 5)


def greaves4_shin(c):
    pts = sl.band(kit.LEG_LO[0], kit.LEG_LO[1], 0.15, 0.8, 0.05, 0.05)
    L(c, pts, M('leather'), 0.0, 0.06, 'guard')
    studs(c, pts, M('bronze'), 0.06, 0.32, 0.055)


def greaves5_shin(c):
    lb(c, kit.LEG_LO, 0.1, 0.84, M('bronze'), 0.0, 0.06, 0.06)
    L(c, E(0.2, 0.3, 0.08, -0.85, 32), M('bronze_d'), 0.06, 0.03, 'calf')


def greaves6_shin(c):
    lb(c, kit.LEG_LO, 0.12, 0.84, M('iron'), 0.0, 0.06, 0.06)
    L(c, sl.band(kit.LEG_LO[0], kit.LEG_LO[1], 0.12, 0.17, 0.07, 0.06), M('iron_d'), 0.06, 0.02, 'rim')


def greaves6_knee(c):
    L(c, E(0.38, 0.32, 0.04, 0.0, 40), M('iron'), 0.0, 0.06, 'cop')
    L(c, E(0.2, 0.17, 0.04, 0.0, 32), M('iron_d'), 0.06, 0.03, 'boss')


def greaves7_shin(c):
    lb(c, kit.LEG_LO, 0.05, 0.86, M('chain'), 0.0, 0.05, 0.05)
    L(c, sl.band(kit.LEG_LO[0], kit.LEG_LO[1], 0.15, 0.8, 0.0, 0.05), M('iron'), 0.06, 0.05, 'plate')


def greaves7_knee(c):
    L(c, E(0.4, 0.34, 0.04, 0.0, 40), M('iron'), 0.0, 0.06, 'cop')


def greaves8_shin(c):
    lb(c, kit.LEG_LO, 0.1, 0.85, M('steel'), 0.0, 0.06, 0.06)
    L(c, R(0.08, 1.3, 0.03, 0.22, -1.0), M('steel_d'), 0.06, 0.02, 'ridge')


def greaves8_knee(c):
    L(c, E(0.4, 0.34, 0.04, 0.0, 40), M('steel'), 0.0, 0.06, 'cop')
    L(c, E(0.12, 0.12, 0.04, 0.0, 24), M('brass'), 0.06, 0.03, 'boss')


def greaves9_shin(c):
    lb(c, kit.LEG_LO, 0.08, 0.86, M('bronze'), 0.0, 0.07, 0.06)
    L(c, E(0.22, 0.34, 0.06, -0.8, 32), M('bronze_d'), 0.06, 0.03, 'relief')
    L(c, sl.band(kit.LEG_LO[0], kit.LEG_LO[1], 0.8, 0.86, 0.08, 0.06), M('gold'), 0.06, 0.02, 'trim')


def greaves9_knee(c):
    L(c, E(0.42, 0.36, 0.04, 0.0, 40), M('bronze'), 0.0, 0.06, 'cop')
    L(c, E(0.16, 0.16, 0.04, 0.0, 24), M('gold'), 0.06, 0.03, 'rosette')


def greaves10_shin(c):
    lb(c, kit.LEG_LO, 0.08, 0.88, M('gold'), 0.0, 0.07, 0.06)
    L(c, R(0.08, 1.35, 0.03, 0.22, -1.0), M('gold_d'), 0.06, 0.02, 'ridge')


def greaves10_knee(c):
    for i in range(10):
        a = i / 10 * math.tau
        L(c, E(0.1, 0.06, 0.04 + 0.26 * math.cos(a), 0.26 * math.sin(a), 16, a), M('gold_d'), 0.0, 0.03, 'mane')
    L(c, E(0.24, 0.24, 0.04, 0.0, 32), M('gold'), 0.03, 0.05, 'lion')


# ================================================================== BOOTS (foot bone + cuff on leg_lo)
FOOT = kit.FOOT


def boot_shape(grow=0.06, top=0.3):
    pts = sl.scale_about(FOOT, 1.06, 1.12, 0.35, -0.1)
    return [(x, min(y, top)) for x, y in pts] + []


def boots1_foot(c):
    L(c, sl.torn(sl.clip_x(boot_shape(), -0.45, 0.85), 0.04, 51), M('rag'), 0.0, 0.06, 'wrap')
    wl = M('rag_d')
    for x in (0.0, 0.35, 0.65):
        L(c, R(0.06, 0.5, 0.02, x, -0.1, 0.4), wl, 0.06, 0.02, 'line')


def boots1_cuff(c):
    lb(c, kit.LEG_LO, 0.84, 1.0, M('rag'), 0.0, 0.05, 0.04, 0.03, 52)


def boots2_foot(c):
    L(c, R(1.62, 0.15, 0.06, 0.36, -0.38), M('leather_l'), 0.0, 0.06, 'sole')
    L(c, R(0.16, 0.5, 0.05, 0.5, -0.12, -0.3), M('leather'), 0.06, 0.05, 'toe_strap')


def boots3_foot(c):
    L(c, R(1.62, 0.15, 0.06, 0.36, -0.38), M('leather_l'), 0.0, 0.06, 'sole')
    L(c, R(0.16, 0.5, 0.05, 0.5, -0.12, -0.3), M('leather'), 0.06, 0.05, 'toe_strap')
    L(c, R(0.6, 0.13, 0.05, -0.02, 0.0, 0.1), M('leather'), 0.06, 0.05, 'heel_strap')


def boots3_cuff(c):
    for i, y in enumerate((-1.35, -1.62, -1.88)):
        L(c, R(0.7, 0.13, 0.05, 0.0, y, 0.35 if i % 2 else -0.35), M('leather'), 0.0 + i * 0.04, 0.04, 'strap')


def boots4_foot(c):
    L(c, boot_shape(top=0.2), M('leather'), 0.0, 0.08, 'shoe')
    L(c, R(1.68, 0.16, 0.06, 0.36, -0.4), M('leather_d'), 0.08, 0.05, 'sole')
    for x in (-0.1, 0.3, 0.7):
        L(c, E(0.045, 0.045, x, -0.4, 12), M('bronze'), 0.13, 0.02, 'nail')


def boots5_foot(c):
    L(c, boot_shape(top=0.35), M('leather'), 0.0, 0.08, 'boot')
    L(c, R(1.7, 0.16, 0.06, 0.36, -0.4), M('leather_d'), 0.08, 0.05, 'sole')
    for k in range(3):
        L(c, R(0.42, 0.05, 0.02, 0.25 + k * 0.08, 0.0 - k * 0.12, 0.5), M('leather_l'), 0.08, 0.02, 'lace')


def boots5_cuff(c):
    lb(c, kit.LEG_LO, 0.72, 1.0, M('leather'), 0.0, 0.05, 0.05)
    L(c, sl.band(kit.LEG_LO[0], kit.LEG_LO[1], 0.72, 0.76, 0.06, 0.05), M('leather_d'), 0.06, 0.02, 'rim')


def boots6_foot(c):
    L(c, R(1.72, 0.2, 0.06, 0.36, -0.4), M('leather_d'), 0.0, 0.07, 'sole')
    for i in range(6):
        L(c, E(0.04, 0.04, -0.3 + i * 0.25, -0.47, 12), M('iron'), 0.07, 0.02, 'hobnail')
    for i, x in enumerate((-0.15, 0.15, 0.45, 0.75)):
        L(c, R(0.13, 0.48, 0.04, x, -0.1, -0.25 + 0.15 * i), M('leather'), 0.07 + i * 0.02, 0.04, 'strap')


def boots6_cuff(c):
    for i, t in enumerate((0.78, 0.86, 0.94)):
        L(c, sl.band(kit.LEG_LO[0], kit.LEG_LO[1], t, t + 0.05, 0.05, 0.05), M('leather'), i * 0.03, 0.03, 'strap')


def boots7_foot(c):
    L(c, boot_shape(top=0.35), M('leather_d'), 0.0, 0.08, 'boot')
    L(c, R(1.72, 0.17, 0.06, 0.36, -0.4), M('iron_d'), 0.08, 0.05, 'sole')
    L(c, sl.clip_x(boot_shape(), 0.55, 1.3), M('iron'), 0.12, 0.05, 'toecap')


def boots7_cuff(c):
    lb(c, kit.LEG_LO, 0.74, 1.0, M('leather_d'), 0.0, 0.05, 0.05)


def boots8_foot(c):
    L(c, boot_shape(top=0.3), M('leather_d'), 0.0, 0.06, 'boot')
    for i, (x0, x1) in enumerate(((-0.45, 0.2), (0.12, 0.55), (0.48, 0.85), (0.78, 1.3))):
        L(c, sl.clip_x(sl.scale_about(boot_shape(), 1.03, 1.06, 0.35, -0.2), x0, x1), M('steel') if i % 2 == 0 else M('steel_d'), 0.06 + i * 0.04, 0.04, 'sabaton')


def boots8_cuff(c):
    lb(c, kit.LEG_LO, 0.76, 1.0, M('leather_d'), 0.0, 0.05, 0.05)


def boots9_foot(c):
    L(c, boot_shape(top=0.35), M('leather'), 0.0, 0.08, 'boot')
    L(c, R(1.72, 0.17, 0.06, 0.36, -0.4), M('leather_d'), 0.08, 0.05, 'sole')
    L(c, sl.clip_x(boot_shape(), 0.62, 1.3), M('bronze'), 0.12, 0.05, 'toecap')


def boots9_cuff(c):
    lb(c, kit.LEG_LO, 0.58, 1.0, M('leather'), 0.0, 0.05, 0.05)
    L(c, sl.torn(sl.band(kit.LEG_LO[0], kit.LEG_LO[1], 0.55, 0.68, 0.12, 0.07), 0.04, 61), M('fur'), 0.06, 0.05, 'fur')


def boots10_foot(c):
    L(c, boot_shape(top=0.35), M('gold'), 0.0, 0.08, 'boot')
    L(c, R(1.72, 0.17, 0.06, 0.36, -0.4), M('gold_d'), 0.08, 0.05, 'sole')
    for i in range(3):
        L(c, R(0.08, 0.42, 0.03, 0.3 + i * 0.22, -0.05, 0.35), M('gold_d'), 0.08, 0.02, 'ridge')


def boots10_cuff(c):
    lb(c, kit.LEG_LO, 0.66, 1.0, M('gold'), 0.0, 0.06, 0.05)
    L(c, [(-0.3, -1.4), (-0.85, -1.15), (-0.75, -1.4), (-0.95, -1.45), (-0.4, -1.62)], M('gold_d'), 0.06, 0.04, 'wing')


# ------------------------------------------------------------------ registry
SLOTS = {
    'helmet': ('head', ['']), 'armor': (None, ['torso', 'skirt', 'bracer']), 'shoulders': ('arm_up', ['']),
    'greaves': ('leg_lo', ['shin', 'knee']), 'boots': (None, ['foot', 'cuff']),
}
PIECE_BONE = {('helmet', ''): 'head', ('armor', 'torso'): 'torso', ('armor', 'skirt'): 'pelvis', ('armor', 'bracer'): 'arm_lo',
              ('shoulders', ''): 'arm_up', ('greaves', 'shin'): 'leg_lo', ('greaves', 'knee'): 'leg_lo',
              ('boots', 'foot'): 'foot', ('boots', 'cuff'): 'leg_lo'}


def pieces():
    g = globals()
    out = {}
    for t in range(1, 11):
        for (slot, piece), bone in PIECE_BONE.items():
            fn = g.get(f'{slot}{t}' + (f'_{piece}' if piece else ''))
            if fn:
                key = f'{slot}{t}' + (f'_{piece}' if piece else '')
                out[key] = (fn, bone, slot, piece, t)
    return out


SET_NAMES = ["Beggar's Rags", 'Scrap Leather', 'Padded Linen', 'Studded Hide', 'Bronze Recruit', 'Iron Scale',
             'Chain Veteran', 'Legion Plate', "Champion's Bronze", 'Gilded Legend']
