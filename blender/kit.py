"""Modular gladiator kit — body, 10 faces, 10 hair styles, 10 facial-hair styles.

Skin and hair parts are rendered on NEUTRAL paper and coloured in the game (per-pixel gain), so any skin / hair colour
works without re-rendering. Everything is built in bone-local coordinates (pivot = joint at the origin), the same
skeleton as gladiator.py, so every piece fits every other piece.
"""
import math
import sprite_lib as sl

pc = sl.pc

# neutral albedos: skin pieces are N x (piece colour / reference skin), so after the game multiplies by the chosen skin
# colour / N the relations (lighter pecs, darker abs, blush, lids, mouth) stay as designed
N = 0.75
REF_SKIN = (0xe8 / 255, 0xa7 / 255, 0x7c / 255)


def _hex(rgb):
    return '#%02x%02x%02x' % tuple(max(0, min(255, round(v * 255))) for v in rgb)


def neutral(hexcol):
    """skin-family colour -> neutral paper colour that turns back into it when tinted with REF_SKIN"""
    h = hexcol.lstrip('#')
    c = [int(h[i:i + 2], 16) / 255 for i in (0, 2, 4)]
    return _hex([N * c[i] / REF_SKIN[i] for i in range(3)])


NS = dict(skin=neutral('#e8a77c'), hi=neutral('#edaf86'), lo=neutral('#d8956c'), blush=neutral('#e2806a'),
          lid=neutral('#d48c66'), nose=neutral('#ea9b74'), mouth=neutral('#6a2a22'), scar=neutral('#c47a5c'),
          ear_in=neutral('#d48c66'))
HAIR_N = _hex([N, N, N])          # hair / brows / beards: neutral grey, tinted by the hair colour / N
HAIR_LO = _hex([N * 0.8] * 3)

SKINS = ['#f6d7bf', '#f2c4a2', '#eeb48e', '#e8a77c', '#d9935f', '#c47d4e', '#a8673f', '#8a5232', '#6b3d26', '#4e2c1c']
SKIN_NAMES = ['Porcelain', 'Fair', 'Rosy', 'Peach', 'Tan', 'Olive', 'Bronze', 'Brown', 'Umber', 'Ebony']
HAIR_COLORS = ['#231a16', '#4a2c20', '#7a4a2a', '#8e3b1f', '#c8642e', '#d9b16a', '#e8dcc0', '#8f8a85', '#efece6', '#a3262a']
HAIR_COLOR_NAMES = ['Black', 'Dark brown', 'Brown', 'Auburn', 'Ginger', 'Blond', 'Platinum', 'Grey', 'White', 'Dyed red']


def M_skin(c):
    return sl.tex_paper('n_' + c, c, fiber='water', fiber_k=0.8, tooth=0.5, fibre_nrm=0.25)


def M_hair(c=HAIR_N):
    return sl.tex_paper('h_' + c, c, fiber='washi', fiber_k=1.0, tooth=0.45, fibre_nrm=0.4)


def L(coll, pts, mat, z, h=0.1, name='l'):
    return pc.layer(pts, mat, h=h, z=z, coll=coll, name=name, bevel=0.01)


def E(rx, ry, x, y, n=48, rot=0.0):
    return pc.xf(pc.ellipse_pts(rx, ry, n), x, y, rot)


def R(w, h, r, x, y, rot=0.0):
    return pc.xf(pc.rrect(w, h, r), x, y, rot)


# ================================================================== body (neutral skin)
ARM_UP = (1.9, [(0, 0.5, 0.5), (0.35, 0.5, 0.56), (0.8, 0.36, 0.38), (1, 0.32, 0.32)])
ARM_LO = (1.65, [(0, 0.32, 0.33), (0.25, 0.38, 0.37), (0.75, 0.27, 0.27), (1, 0.25, 0.25)])
LEG_UP = (2.15, [(0, 0.55, 0.55), (0.3, 0.58, 0.6), (0.85, 0.42, 0.42), (1, 0.4, 0.4)])
LEG_LO = (2.05, [(0, 0.38, 0.38), (0.3, 0.5, 0.36), (0.8, 0.28, 0.28), (1, 0.27, 0.27)])
FOOT = [(-0.28, 0.12), (-0.4, -0.05), (-0.38, -0.33), (1.02, -0.33), (1.12, -0.18), (0.95, -0.06), (0.38, 0.06), (0.22, 0.16)]


def torso_outline():
    side = [(1.0, 0.0), (1.08, 0.8), (1.38, 1.7), (1.62, 2.3)]
    side += [(1.22 + 0.48 * math.cos(math.radians(a)), 2.62 + 0.48 * math.sin(math.radians(a))) for a in range(-35, 91, 12)]
    side += [(0.55, 3.1)]
    pts = side + [(-x, y) for x, y in reversed(side)]
    return [(x * (1.04 if x > 0 else 1.0), y) for x, y in pts]


def body_torso(c):
    L(c, R(0.82, 0.95, 0.3, 0.12, 3.2), M_skin(NS['lo']), 0.0, 0.1, 'neck')
    torso_flesh(c)


def torso_flesh(c):
    """the torso without its neck (shared with the torn-neck variant)"""
    L(c, torso_outline(), M_skin(NS['skin']), 0.1, 0.12, 'torso')
    hi = M_skin(NS['hi'])
    L(c, pc.xf(pc.blob_pts(0.74, 0.48, 0.05, 2), -0.6, 2.18), hi, 0.22, 0.07, 'pec_l')
    L(c, pc.xf(pc.blob_pts(0.8, 0.5, 0.05, 5), 0.74, 2.18), hi, 0.3, 0.07, 'pec_r')
    lo = M_skin(NS['lo'])
    for y in (1.42, 0.98, 0.55):
        for x in (-0.24, 0.42):
            L(c, R(0.52, 0.36, 0.14, x, y), lo, 0.22, 0.06, 'ab')


def body_arm_up(c):
    L(c, sl.limb_pts(*ARM_UP), M_skin(NS['skin']), 0.0, 0.12, 'arm')
    hi = M_skin(NS['hi'])
    L(c, E(0.5, 0.42, 0.02, -0.12), hi, 0.12, 0.07, 'delt')
    L(c, E(0.3, 0.42, 0.14, -0.88), hi, 0.12, 0.06, 'bicep')


def body_arm_lo(c):
    L(c, sl.limb_pts(*ARM_LO), M_skin(NS['skin']), 0.0, 0.12, 'forearm')


def body_hand(c):
    s, hi = M_skin(NS['skin']), M_skin(NS['hi'])
    L(c, R(0.62, 0.7, 0.22, 0.04, -0.36), s, 0.0, 0.12, 'fist')
    for y in (-0.16, -0.36, -0.56):
        L(c, R(0.3, 0.2, 0.09, 0.27, y), hi, 0.12, 0.06, 'finger')
    L(c, R(0.22, 0.44, 0.1, -0.1, -0.3, -0.5), hi, 0.12, 0.06, 'thumb')


def body_leg_up(c):
    L(c, sl.limb_pts(*LEG_UP), M_skin(NS['skin']), 0.0, 0.12, 'thigh')


def body_leg_lo(c):
    L(c, sl.limb_pts(*LEG_LO), M_skin(NS['skin']), 0.0, 0.12, 'shin')
    L(c, E(0.22, 0.2, 0.06, -0.08), M_skin(NS['hi']), 0.12, 0.05, 'knee')


def body_foot(c):
    L(c, FOOT, M_skin(NS['skin']), 0.0, 0.12, 'foot')
    L(c, R(0.22, 0.12, 0.05, 0.98, -0.16), M_skin(NS['hi']), 0.12, 0.04, 'toe')


def body_pelvis(c):
    """loincloth + belt: the base clothing everybody wears (not tinted)"""
    cloth = sl.tex_paper('p_cloth', '#e3d6bb', 'washi', 0.9)
    L(c, [(-1.12, 0.06), (1.12, 0.06), (1.08, -0.72), (0.58, -0.95), (0.5, -1.72), (-0.36, -1.72), (-0.46, -0.95), (-1.08, -0.72)],
      cloth, 0.0, 0.12, 'cloth')
    L(c, [(0.5, -1.45), (0.5, -1.72), (-0.36, -1.72), (-0.36, -1.45)], sl.tex_paper('p_cloth_lo', '#cbbb9a', 'washi', 0.9), 0.12, 0.05, 'hem')
    belt = sl.tex_board('belt', 'kraft', scale=0.35)
    L(c, R(2.42, 0.42, 0.12, 0, -0.06), belt, 0.12, 0.1, 'belt')
    L(c, R(0.42, 0.44, 0.1, 0.3, -0.06), sl.foil('iron', '#8d939b', metal=0.7, rough=0.4, emit=0.12), 0.22, 0.08, 'buckle')


BODY = dict(torso=body_torso, arm_up=body_arm_up, arm_lo=body_arm_lo, hand=body_hand, leg_up=body_leg_up,
            leg_lo=body_leg_lo, foot=body_foot, pelvis=body_pelvis)
BODY_TINT = dict(torso='skin', arm_up='skin', arm_lo='skin', hand='skin', leg_up='skin', leg_lo='skin', foot='skin', pelvis=None)


# ================================================================== torn neck (finishers, #20)
# Drawn only when a pose has `neck_cut`: the torso gets a short neck stump instead of the whole neck, the flying head
# gets the other half. White fibre edge = torn paper; the red crepe tissue stands in for gore.
NECK_X = 0.12            # neck centre in torso space (the head joint)
TEETH = [0.02, 0.17, -0.04, 0.11, -0.07, 0.2, 0.0, 0.1, -0.03]
FIBRE = '#fbf3e4'


def _stump(y_base, y_edge, seed, cx, half=0.42, grow=0.0):
    """neck piece between a straight base and a torn edge; `y_edge` may be below the base (hanging from a head)"""
    import random
    rnd = random.Random(seed)
    x0, x1, n = cx + half + grow, cx - half - grow, len(TEETH)
    edge = [(x0 + (x1 - x0) * i / (n - 1), y_edge + t + rnd.uniform(-0.02, 0.02)) for i, t in enumerate(TEETH)]
    pts = [(cx - half - grow, y_base), (cx + half + grow, y_base)] + edge
    return pts if y_edge > y_base else list(reversed(pts))


def cut_torso(c):
    """replaces body_torso when the neck is cut: the same torso with a torn stump for a neck"""
    torso_flesh(c)
    L(c, _stump(2.75, 3.5, 3, NECK_X), M_skin(NS['lo']), 0.04, 0.08, 'stump')


def cut_torso_edge(c):
    m = sl.tex_paper('cut_fibre', FIBRE, 'washi', 1.0)
    L(c, sl.torn(_stump(3.2, 3.59, 3, NECK_X, grow=0.03), 0.035, 11, 0.07), m, 0.0, 0.04, 'fibre')


def _shreds(c, cx, base_y, sign, seed, half=0.36, k=1.0, core=0.4):
    """crepe-paper strips fanning out of the torn edge; sign +1 = standing up, -1 = hanging down.
    `half` = half width of the fan, `k` = strip length scale, `core` = half width of the red core (an arm is thinner than a neck)"""
    import random
    rnd = random.Random(seed)
    mats = [sl.tex_paper('cut_red%d' % i, h, 'washi', 1.0, tooth=0.7) for i, h in enumerate(('#8f141c', '#c3262b', '#e0483c'))]
    for i in range(11):
        layer = i % 3
        x = cx - half + 2 * half * ((i * 7) % 11) / 10.0
        length = rnd.uniform(0.28, 0.62) * (1.0 if layer else 1.15) * k
        w = rnd.uniform(0.07, 0.13) * (0.5 + 0.5 * k)
        lean = (x - cx) * 0.75 + rnd.uniform(-0.1, 0.1)
        tip = (x + lean, base_y + sign * length)
        mid = (x + lean * 0.35 + rnd.uniform(-0.09, 0.09), base_y + sign * length * 0.55)
        pts = [(x - w, base_y - sign * 0.06 * k), (x + w, base_y - sign * 0.06 * k), (mid[0] + w * 0.75, mid[1]),
               (tip[0] + 0.025, tip[1]), (tip[0] - 0.025, tip[1] - sign * 0.07 * k), (mid[0] - w * 0.75, mid[1])]
        if sign < 0:
            pts = list(reversed(pts))
        L(c, pts, mats[layer], 0.02 + 0.05 * layer, 0.04, 'shred')
    L(c, sl.torn(E(core, 0.12, cx, base_y, 32), 0.03, seed + 40, 0.07), mats[0], 0.0, 0.05, 'core')


def cut_torso_tissue(c):
    _shreds(c, NECK_X, 3.47, 1, 21)


# the flying half lives in head-bone space: the joint is the origin, the chin sits just above it
def cut_head_neck(c):
    L(c, _stump(0.55, -0.2, 5, 0.0, half=0.4), M_skin(NS['lo']), 0.04, 0.08, 'stump')


def cut_head_edge(c):
    m = sl.tex_paper('cut_fibre', FIBRE, 'washi', 1.0)
    L(c, sl.torn(_stump(0.2, -0.29, 5, 0.0, half=0.4, grow=0.03), 0.035, 13, 0.07), m, 0.0, 0.04, 'fibre')


def cut_head_tissue(c):
    _shreds(c, 0.0, -0.2, -1, 31)


# ================================================================== torn arm (the shield arm cut off, #275 / #332)
# Same paper as the neck: the upper arm ends in a torn stump just above the elbow (red crepe hanging down), the loose
# forearm gets the other half at its top (crepe standing up). Both bones hang down from their joint, y = 0 at the joint.
ARM_UP_CUT = -1.68     # where the upper arm is torn (its bone is 1.85 long)
ARM_LO_CUT = -0.1      # where the loose forearm starts


def _cut_limb(prof, y_cut, keep_above, seed):
    """a limb outline (sl.limb_pts) clipped at y_cut, the straight cut replaced by torn teeth sticking out of the kept part;
    keep_above = keep the part above the cut (the stump on the shoulder), else the part below (the loose forearm)"""
    import random
    rnd = random.Random(seed)
    pts = sl.limb_pts(*prof)
    inside = (lambda p: p[1] >= y_cut) if keep_above else (lambda p: p[1] <= y_cut)
    sign = -1 if keep_above else 1
    out = []
    for i, a in enumerate(pts):
        b = pts[(i + 1) % len(pts)]
        if inside(a):
            out.append(a)
        if inside(a) != inside(b):
            t = (y_cut - a[1]) / (b[1] - a[1])
            q = (a[0] + (b[0] - a[0]) * t, y_cut)
            out.append(q)
            if inside(a):   # leaving the kept part: walk the torn edge across to where the outline comes back
                for j in range(len(pts)):
                    c_, d = pts[(i + 1 + j) % len(pts)], pts[(i + 2 + j) % len(pts)]
                    if not inside(c_) and inside(d):
                        x2 = c_[0] + (d[0] - c_[0]) * (y_cut - c_[1]) / (d[1] - c_[1])
                        break
                n = len(TEETH)
                for k in range(1, n - 1):
                    x = q[0] + (x2 - q[0]) * k / (n - 1)
                    out.append((x, y_cut + sign * TEETH[k] * 0.8 + rnd.uniform(-0.02, 0.02)))
    return out


def cut_arm_up(c):
    """replaces body_arm_up when the arm is cut: the upper arm without its elbow, torn above it"""
    L(c, _cut_limb(ARM_UP, ARM_UP_CUT, True, 7), M_skin(NS['skin']), 0.0, 0.12, 'arm')
    hi = M_skin(NS['hi'])
    L(c, E(0.5, 0.42, 0.02, -0.12), hi, 0.12, 0.07, 'delt')
    L(c, E(0.3, 0.42, 0.14, -0.88), hi, 0.12, 0.06, 'bicep')
    L(c, _stump(ARM_UP_CUT + 0.3, ARM_UP_CUT - 0.02, 7, 0.0, half=0.3), M_skin(NS['lo']), 0.04, 0.08, 'stump')


def cut_arm_up_rim(c):
    m = sl.tex_paper('cut_fibre', FIBRE, 'washi', 1.0)
    L(c, sl.torn(_stump(ARM_UP_CUT + 0.25, ARM_UP_CUT - 0.06, 7, 0.0, half=0.33, grow=0.03), 0.035, 15, 0.07), m, 0.0, 0.04, 'fibre')


def cut_arm_up_tissue(c):
    _shreds(c, 0.0, ARM_UP_CUT + 0.02, -1, 41, half=0.22, k=0.62, core=0.27)


def cut_arm_lo(c):
    """replaces body_arm_lo on the loose forearm: torn across just under the elbow"""
    L(c, _cut_limb(ARM_LO, ARM_LO_CUT, False, 9), M_skin(NS['skin']), 0.0, 0.12, 'forearm')
    L(c, _stump(ARM_LO_CUT - 0.3, ARM_LO_CUT + 0.02, 9, 0.0, half=0.31), M_skin(NS['lo']), 0.04, 0.08, 'stump')


def cut_arm_lo_rim(c):
    m = sl.tex_paper('cut_fibre', FIBRE, 'washi', 1.0)
    L(c, sl.torn(_stump(ARM_LO_CUT - 0.25, ARM_LO_CUT + 0.06, 9, 0.0, half=0.34, grow=0.03), 0.035, 17, 0.07), m, 0.0, 0.04, 'fibre')


def cut_arm_lo_tissue(c):
    _shreds(c, 0.0, ARM_LO_CUT - 0.02, 1, 43, half=0.22, k=0.62, core=0.27)


CUT = dict(torso_edge=(cut_torso_edge, None), torso=(cut_torso, 'skin'), torso_tissue=(cut_torso_tissue, None),
           head_tissue=(cut_head_tissue, None), head_edge=(cut_head_edge, None), head_neck=(cut_head_neck, 'skin'),
           arm_up=(cut_arm_up, 'skin'), arm_up_rim=(cut_arm_up_rim, None), arm_up_tissue=(cut_arm_up_tissue, None),
           arm_lo=(cut_arm_lo, 'skin'), arm_lo_rim=(cut_arm_lo_rim, None), arm_lo_tissue=(cut_arm_lo_tissue, None))


# ================================================================== faces
# jaw: a_low (width), b_low (length), n_low (squareness, 2 = round, 4 = boxy)
FACES = [
    dict(name='Stoic', a=1.0, b=1.125, n=3.0, eye=(0.26, 0.22, 0.21), lid=0.5, slant=0.0, brow=(0.55, 0.16, 0.12, -0.10, 0.0), nose=('tear', 1.0), mouth='line', cheek=0.25),
    dict(name='Brute', a=1.1, b=1.22, n=4.2, eye=(0.2, 0.17, 0.17), lid=0.55, slant=0.06, brow=(0.6, 0.22, -0.35, 0.35, -0.08), nose=('wide', 1.1), mouth='frown', cheek=0.0),
    dict(name='Youth', a=0.95, b=1.04, n=2.2, eye=(0.3, 0.26, 0.26), lid=0.18, slant=0.0, brow=(0.48, 0.1, 0.2, -0.2, 0.06), nose=('button', 1.0), mouth='smile', cheek=0.28),
    dict(name='Veteran', a=0.92, b=1.32, n=2.6, eye=(0.25, 0.21, 0.15), lid=0.6, slant=0.0, brow=(0.58, 0.18, 0.05, -0.05, -0.03), nose=('roman', 1.05), mouth='line', cheek=0.0, scar=True),
    dict(name='Cheerful', a=1.0, b=1.1, n=2.5, eye=(0.27, 0.23, 0.22), lid=0.25, slant=0.0, brow=(0.5, 0.13, 0.28, -0.28, 0.08), nose=('tear', 1.2), mouth='smile', cheek=0.3),
    dict(name='Sly', a=0.88, b=1.18, n=2.3, eye=(0.25, 0.21, 0.18), lid=0.6, slant=-0.05, brow=(0.52, 0.12, 0.25, 0.25, 0.02), nose=('long', 1.0), mouth='smirk', cheek=0.0),
    dict(name='Grim', a=1.04, b=1.15, n=3.6, eye=(0.24, 0.2, 0.19), lid=0.66, slant=0.05, brow=(0.58, 0.2, -0.28, 0.28, -0.06), nose=('tear', 0.9), mouth='frown', cheek=0.0),
    dict(name='Elder', a=0.98, b=1.16, n=2.8, eye=(0.21, 0.18, 0.17), lid=0.55, slant=0.0, brow=(0.66, 0.24, -0.12, 0.12, 0.02), nose=('tear', 1.3), mouth='wide', cheek=0.2, wrinkles=True),
    dict(name='Wild', a=0.97, b=1.08, n=2.4, eye=(0.31, 0.27, 0.27), lid=0.05, slant=0.0, brow=(0.5, 0.14, 0.3, -0.3, 0.12), nose=('button', 1.15), mouth='o', cheek=0.22),
    dict(name='Noble', a=0.94, b=1.2, n=2.8, eye=(0.25, 0.21, 0.2), lid=0.42, slant=0.0, brow=(0.5, 0.1, 0.0, 0.0, 0.03), nose=('roman', 0.85), mouth='line_s', cheek=0.16, dimple=True),
]
HEAD_C = (0.12, 1.15)


def face_geo(f):
    chin = HEAD_C[1] - f['b']
    nose_dy = -(f['b'] - 1.125) * 0.45
    return chin, nose_dy


def face_head(c, f):
    """head base (tinted skin): skull + jaw, ear, cheeks, mouth, scar / wrinkles"""
    chin, ndy = face_geo(f)
    L(c, E(0.27, 0.36, -0.86, 1.05), M_skin(NS['lo']), 0.0, 0.1, 'ear')
    L(c, E(0.12, 0.18, -0.88, 1.05), M_skin(NS['ear_in']), 0.1, 0.03, 'ear_in')
    L(c, sl.head_outline(a_low=f['a'], b_low=f['b'], n_low=f['n']), M_skin(NS['skin']), 0.1, 0.12, 'head')
    if f['cheek'] > 0:
        r = f['cheek']
        L(c, E(r, r * 0.92, -0.26, 0.92 + ndy * 0.6), M_skin(NS['blush']), 0.22, 0.04, 'cheek_l')
        L(c, E(r * 0.86, r * 0.84, 0.98, 0.95 + ndy * 0.6), M_skin(NS['blush']), 0.22, 0.04, 'cheek_r')
    my = chin + 0.34
    m = M_skin(NS['mouth'])
    kind = f['mouth']
    if kind == 'line':
        L(c, R(0.3, 0.08, 0.04, 0.45, my), m, 0.27, 0.03, 'mouth')
    elif kind == 'line_s':
        L(c, R(0.22, 0.07, 0.035, 0.46, my), m, 0.27, 0.03, 'mouth')
    elif kind == 'wide':
        L(c, R(0.46, 0.08, 0.04, 0.44, my), m, 0.27, 0.03, 'mouth')
    elif kind == 'frown':
        L(c, sl.arc_pts(0.45, my - 0.12, 0.13, 0.2, 35, 145), m, 0.27, 0.03, 'mouth')
    elif kind == 'smile':
        L(c, sl.arc_pts(0.45, my + 0.12, 0.14, 0.22, 215, 325), m, 0.27, 0.03, 'mouth')
    elif kind == 'smirk':
        L(c, R(0.3, 0.075, 0.035, 0.47, my + 0.02, 0.22), m, 0.27, 0.03, 'mouth')
    elif kind == 'o':
        L(c, E(0.09, 0.11, 0.45, my), m, 0.27, 0.03, 'mouth')
    lo = M_skin(NS['scar'])
    if f.get('scar'):
        L(c, R(0.07, 0.62, 0.03, 0.9, 1.25, -0.35), lo, 0.27, 0.025, 'scar')
        for k in range(3):
            L(c, R(0.18, 0.04, 0.02, 0.86 + k * 0.08 - 0.08, 1.12 + k * 0.17, 0.4), lo, 0.3, 0.02, 'stitch')
    if f.get('wrinkles'):
        for k, w in enumerate((0.7, 0.55)):
            L(c, R(w, 0.045, 0.02, 0.3, 1.86 + k * 0.13), lo, 0.27, 0.02, 'wrinkle')
    if f.get('dimple'):
        L(c, E(0.05, 0.035, 0.45, chin + 0.13), lo, 0.27, 0.02, 'dimple')


def face_eyes(c, f):
    """sclera + pupils (not tinted)"""
    rx0, rx1, ry = f['eye']
    eye = sl.tex_paper('p_eye', '#f4efe6', 'white', 0.6)
    pup = sl.tex_paper('p_pupil', '#2a1a16', None)
    for x, rx in ((-0.02, rx0), (0.72, rx1)):
        L(c, E(rx, ry, x, 1.36), eye, 0.0, 0.04, 'sclera')
        pr = 0.085 * (0.8 if f['lid'] < 0.1 else 1.0)
        L(c, E(pr, pr, x + rx * 0.35, 1.36 - ry * 0.15, 24), pup, 0.045, 0.03, 'pupil')


def face_lids(c, f):
    """upper lids (tinted skin) covering `lid` of the eye height; slant > 0 = angry, < 0 = sly"""
    rx0, rx1, ry = f['eye']
    lid = M_skin(NS['lid'])
    for side, (x, rx) in enumerate(((-0.02, rx0), (0.72, rx1))):
        cy = 1.36
        yc = cy + ry * (1 - 2 * f['lid'])
        sl_ = f['slant'] * (1 if side == 0 else -1)

        def line(px):
            return yc + sl_ * (px - x) / max(rx, 1e-3)
        arc = []
        for a in range(0, 181, 8):
            px = x + rx * 1.08 * math.cos(math.radians(a))
            py = cy + ry * 1.18 * math.sin(math.radians(a))
            arc.append((px, max(py, line(px))))
        if f['lid'] < 0.02:
            continue
        L(c, arc, lid, 0.0, 0.04, 'lid')


def face_brows(c, f):
    """brows (tinted hair colour). brow = (length, thickness, angle near, angle far, dy)"""
    ln, th, a0, a1, dy = f['brow']
    hair = M_hair()
    L(c, R(ln, th, th * 0.45, -0.04, 1.67 + dy, a0 * 0.5 + 0.1), hair, 0.0, 0.05, 'brow_l')
    L(c, R(ln * 0.82, th * 0.95, th * 0.45, 0.74, 1.69 + dy, a1 * 0.5 - 0.08), hair, 0.0, 0.05, 'brow_r')


def face_nose(c, f):
    _, ndy = face_geo(f)
    kind, s = f['nose']
    m = M_skin(NS['nose'])
    bx, by = 0.42, 0.66 + ndy
    if kind == 'tear':
        L(c, pc.xf(pc.teardrop_pts(0.56 * s, 0.78 * s), bx, by), m, 0.0, 0.1, 'nose')
    elif kind == 'long':
        L(c, pc.xf(pc.teardrop_pts(0.44 * s, 1.0 * s), bx + 0.02, by - 0.06), m, 0.0, 0.1, 'nose')
    elif kind == 'button':
        L(c, E(0.21 * s, 0.17 * s, bx, by + 0.18), m, 0.0, 0.1, 'nose')
    elif kind == 'wide':
        L(c, pc.xf(pc.teardrop_pts(0.7 * s, 0.7 * s), bx, by - 0.02), m, 0.0, 0.1, 'nose')
        L(c, E(0.08, 0.05, bx - 0.14, by + 0.08), M_skin(NS['lo']), 0.1, 0.02, 'nostril')
        L(c, E(0.08, 0.05, bx + 0.16, by + 0.08), M_skin(NS['lo']), 0.1, 0.02, 'nostril')
    elif kind == 'roman':
        pts = [(0.0, 0.78), (0.1, 0.62), (0.24, 0.36), (0.36, 0.16), (0.3, 0.02), (0.12, -0.02), (-0.12, 0.0), (-0.22, 0.12), (-0.16, 0.36), (-0.08, 0.62)]
        L(c, pc.xf([(x * s, y * s) for x, y in pts], bx + 0.02, by), m, 0.0, 0.1, 'nose')


# ================================================================== expressions (#26): drawn over the neutral face when a pose asks
# eyes > 0.5 -> lids_closed over the eyes (blink, pain); mouth > 0.5 -> mouth_open over the mouth (pain, shout);
# brows > 0.5 -> brows_angry instead of the brows (anger, effort)
def face_lids_closed(c, f):
    """both eyes shut: a skin lid over the whole eye and a dark lash line low on it (tinted skin)"""
    rx0, rx1, ry = f['eye']
    lid = M_skin(NS['lid'])
    lash = M_skin(NS['mouth'])
    for x, rx in ((-0.02, rx0), (0.72, rx1)):
        L(c, E(rx * 1.14, ry * 1.22, x, 1.36), lid, 0.0, 0.04, 'lid_closed')
        # the lash line sags a little: a thin crescent across the lower half of the lid
        L(c, sl.arc_pts(x, 1.36 + ry * 0.55, ry * 0.85, ry * 0.85 + 0.045, 200, 340, 16), lash, 0.05, 0.02, 'lash')


def face_mouth_open(c, f):
    """an open mouth (pain, a triumphant shout) covering any of the neutral mouths (tinted skin)"""
    chin, _ = face_geo(f)
    my = chin + 0.34
    L(c, E(0.24, 0.17, 0.45, my - 0.01), M_skin(NS['lo']), 0.0, 0.03, 'lips')
    L(c, E(0.18, 0.12, 0.45, my - 0.02), M_skin(NS['mouth']), 0.04, 0.03, 'mouth_in')
    L(c, E(0.1, 0.045, 0.47, my - 0.1), M_skin(NS['blush']), 0.08, 0.02, 'tongue')


def face_brows_angry(c, f):
    """the face's brows pulled down towards the nose (tinted hair colour)"""
    ln, th, _, _, dy = f['brow']
    hair = M_hair()
    th = th * 1.15
    L(c, R(ln, th, th * 0.45, -0.04, 1.62 + dy, -0.32), hair, 0.0, 0.05, 'brow_l')
    L(c, R(ln * 0.82, th * 0.95, th * 0.45, 0.74, 1.64 + dy, 0.34), hair, 0.0, 0.05, 'brow_r')


# ================================================================== hair (tinted). front = over the head, back = behind the whole body
CAP_C = (0.1, 1.72)


def _cap(rx=1.14, ry=0.86, a0=200, a1=-10, cx=CAP_C[0], cy=CAP_C[1], step=6):
    return [(cx + rx * math.cos(math.radians(a)), cy + ry * math.sin(math.radians(a))) for a in range(a0, a1 - 1, -step)]


FRINGE = [(1.0, 1.94), (0.78, 1.84), (0.52, 1.99), (0.24, 1.88), (-0.06, 2.0), (-0.38, 1.88), (-0.62, 1.72), (-0.72, 1.3), (-0.98, 1.22)]


def hair_none(front, back):
    pass


def hair_crop(front, back):
    L(front, _cap() + FRINGE, M_hair(), 0.0, 0.1, 'hair')


def hair_curly(front, back):
    h, lo = M_hair(), M_hair(HAIR_LO)
    L(front, _cap(1.1, 0.8) + FRINGE, h, 0.0, 0.1, 'hair')
    k = 0
    for a in range(196, -16, -17):
        x = CAP_C[0] + 1.12 * math.cos(math.radians(a))
        y = CAP_C[1] + 0.86 * math.sin(math.radians(a))
        L(front, E(0.3, 0.28, x, y, 24), h if k % 2 else lo, 0.1 + (k % 2) * 0.04, 0.06, 'curl')
        k += 1
    for x, y in ((-0.3, 1.98), (0.3, 1.94), (0.8, 1.92)):
        L(front, E(0.22, 0.2, x, y, 24), lo, 0.2, 0.05, 'curl_f')


def hair_long(front, back):
    h, lo = M_hair(), M_hair(HAIR_LO)
    L(front, _cap() + [(1.0, 1.9), (0.6, 2.02), (0.1, 2.06), (-0.4, 1.96), (-0.7, 1.6), (-0.8, 1.0), (-1.0, 0.8)], h, 0.0, 0.1, 'hair')
    L(back, [(-1.25, 2.1), (-0.6, 2.55), (0.4, 2.5), (0.9, 1.9), (0.6, 0.6), (0.2, -0.7), (-0.6, -0.95), (-1.35, -0.5), (-1.5, 0.6)], lo, 0.0, 0.1, 'hair_back')


def hair_mohawk(front, back):
    h, lo = M_hair(), M_hair(HAIR_LO)
    L(front, _cap(1.06, 0.62, 200, -10) + [(1.0, 1.72), (-0.95, 1.5)], lo, 0.0, 0.05, 'shaved')
    for k in range(8):
        a = math.radians(165 - k * 17)
        x, y = CAP_C[0] + 1.0 * math.cos(a), CAP_C[1] + 0.72 * math.sin(a)
        L(front, pc.xf([(-0.17, 0), (0.17, 0), (0.0, 0.8)], x, y, a - math.pi / 2), h, 0.08 + (k % 2) * 0.04, 0.06, 'spike')


def hair_bun(front, back):
    h, lo = M_hair(), M_hair(HAIR_LO)
    L(front, _cap(1.1, 0.8) + [(1.02, 1.82), (0.4, 2.02), (-0.3, 1.98), (-0.75, 1.6), (-0.98, 1.22)], h, 0.0, 0.1, 'hair')
    L(back, E(0.5, 0.48, -0.55, 2.55), h, 0.0, 0.1, 'bun')
    L(back, R(0.32, 0.55, 0.1, -0.28, 2.32, -0.6), lo, 0.1, 0.05, 'band')


def hair_receding(front, back):
    h = M_hair()
    L(front, [(-0.98, 1.22), (-1.06, 1.6), (-0.9, 2.05), (-0.62, 2.22), (-0.5, 1.9), (-0.68, 1.3)], h, 0.0, 0.08, 'side')
    L(front, E(0.12, 0.1, 0.35, 2.22, 16), h, 0.0, 0.05, 'tuft')


def hair_spiky(front, back):
    h, lo = M_hair(), M_hair(HAIR_LO)
    L(front, _cap(1.1, 0.8) + FRINGE, h, 0.0, 0.1, 'hair')
    for k in range(9):
        a = math.radians(188 - k * 20)
        x, y = CAP_C[0] + 1.02 * math.cos(a), CAP_C[1] + 0.78 * math.sin(a)
        L(front, pc.xf([(-0.22, 0), (0.22, 0), (0.05, 0.62)], x, y, a - math.pi / 2 - 0.25), lo if k % 2 else h, 0.1 + (k % 2) * 0.03, 0.05, 'spike')


def hair_braids(front, back):
    h, lo = M_hair(), M_hair(HAIR_LO)
    L(front, _cap() + [(1.0, 1.86), (0.4, 1.98), (-0.3, 1.94), (-0.7, 1.6), (-0.98, 1.22)], h, 0.0, 0.1, 'hair')
    for k, x0 in enumerate((-1.0, -0.62)):
        for j in range(6):
            L(back, E(0.2, 0.17, x0 - j * 0.03, 1.5 - j * 0.33, 24), h if j % 2 else lo, 0.0 + j * 0.03 + k * 0.2, 0.05, 'braid')
        L(back, R(0.28, 0.1, 0.04, x0 - 0.2, -0.5), lo, 0.4 + k * 0.05, 0.04, 'tie')


def hair_slick(front, back):
    h, lo = M_hair(), M_hair(HAIR_LO)
    L(front, _cap(1.16, 0.84) + [(1.08, 1.9), (0.5, 2.1), (-0.2, 2.06), (-0.7, 1.72), (-1.0, 1.22)], h, 0.0, 0.1, 'hair')
    for k in range(3):
        L(front, R(0.9 - k * 0.15, 0.05, 0.02, 0.0 - k * 0.1, 2.18 + k * 0.12, 0.12), lo, 0.1, 0.02, 'comb')
    L(back, E(0.42, 0.34, -1.05, 1.62), h, 0.0, 0.08, 'curl')


HAIRS = [('Bald', hair_none), ('Crop', hair_crop), ('Curly', hair_curly), ('Long', hair_long), ('Mohawk', hair_mohawk),
         ('Bun', hair_bun), ('Receding', hair_receding), ('Spiky', hair_spiky), ('Braids', hair_braids), ('Slicked', hair_slick)]


# ================================================================== facial hair (tinted), built on the default jaw (the game scales it to the face's jaw)
def _jaw_band(y_top, inset=0.08):
    """lower face area under y_top, inset from the default jaw outline"""
    o = sl.head_outline(a_top=1.0 - inset, b_top=1.125 - inset, a_low=1.0 - inset, b_low=1.125 - inset)
    return sl.clip_y(o, -5, y_top)


def _stache(c, h, z=0.1, ends=0.0):
    L(c, sl.arc_pts(0.42, 0.5, 0.14, 0.5, 18, 162), h, z, 0.08, 'mustache')
    if ends:
        for sgn, x in ((-1, 0.0), (1, 0.84)):
            L(c, E(0.12, 0.1, x + sgn * 0.08, 0.5 + ends), h, z + 0.02, 0.05, 'curl')


def beard_none(c):
    pass


def beard_stubble(c):
    L(c, _jaw_band(0.78, 0.1), M_hair(HAIR_LO), 0.0, 0.03, 'stubble')


def beard_stache(c):
    _stache(c, M_hair())


def beard_handlebar(c):
    h = M_hair()
    L(c, sl.arc_pts(0.42, 0.42, 0.16, 0.42, 25, 155), h, 0.0, 0.08, 'mustache')
    for x0, d in ((0.06, -1), (0.78, 1)):
        L(c, sl.arc_pts(x0 + d * 0.1, 0.62, 0.06, 0.15, 180 if d < 0 else -90, 270 if d < 0 else 0), h, 0.06, 0.05, 'curl')


def beard_full(c):
    h, lo = M_hair(), M_hair(HAIR_LO)
    o = sl.head_outline(a_low=1.06, b_low=1.3, n_low=2.6)
    L(c, sl.clip_y(o, -5, 0.95), lo, 0.0, 0.08, 'beard')
    L(c, E(0.16, 0.08, 0.45, 0.36), M_skin(NS['mouth']), 0.09, 0.02, 'mouth_gap')
    _stache(c, h, 0.12)


def beard_goatee(c):
    h = M_hair()
    L(c, [(0.22, 0.28), (0.68, 0.28), (0.62, -0.12), (0.45, -0.3), (0.28, -0.12)], h, 0.0, 0.08, 'goatee')
    L(c, sl.arc_pts(0.45, 0.44, 0.12, 0.3, 25, 155), h, 0.06, 0.06, 'mustache')


def beard_boxed(c):
    h, lo = M_hair(), M_hair(HAIR_LO)
    L(c, _jaw_band(0.7, -0.02), lo, 0.0, 0.07, 'beard')
    L(c, E(0.15, 0.07, 0.45, 0.36), M_skin(NS['mouth']), 0.08, 0.02, 'mouth_gap')
    _stache(c, h, 0.1)


def beard_chops(c):
    h = M_hair()
    L(c, [(-0.9, 1.15), (-0.6, 1.15), (-0.42, 0.55), (-0.1, 0.42), (-0.2, 0.2), (-0.7, 0.35), (-0.92, 0.7)], h, 0.0, 0.07, 'chop_l')
    L(c, [(1.12, 1.1), (0.96, 1.1), (0.92, 0.55), (0.98, 0.42), (1.1, 0.5)], h, 0.0, 0.07, 'chop_r')
    _stache(c, h, 0.08)


def beard_long(c):
    h, lo = M_hair(), M_hair(HAIR_LO)
    o = sl.head_outline(a_low=1.04, b_low=1.25, n_low=2.6)
    L(c, sl.clip_y(o, -5, 0.92), lo, 0.0, 0.08, 'beard')
    L(c, [(0.0, 0.1), (0.9, 0.1), (0.62, -1.2), (0.45, -1.5), (0.28, -1.2)], lo, 0.02, 0.08, 'braid')
    for k in range(4):
        L(c, R(0.36 - k * 0.04, 0.09, 0.04, 0.45, -0.25 - k * 0.3), h, 0.12, 0.03, 'band')
    L(c, E(0.16, 0.08, 0.45, 0.36), M_skin(NS['mouth']), 0.1, 0.02, 'mouth_gap')
    _stache(c, h, 0.13)


BEARDS = [('Clean', beard_none), ('Stubble', beard_stubble), ('Moustache', beard_stache), ('Handlebar', beard_handlebar),
          ('Full beard', beard_full), ('Goatee', beard_goatee), ('Boxed', beard_boxed), ('Mutton chops', beard_chops),
          ('Braided', beard_long), ('Chin strap', None)]


def beard_chinstrap(c):
    """thin band along the jaw line: outer jaw arc + inner arc back"""
    def lower(a, b, n=48):
        pts = []
        for i in range(n + 1):
            th = math.pi + math.pi * i / n
            cth, sth = math.cos(th), math.sin(th)
            pts.append((HEAD_C[0] + a * math.copysign(abs(cth) ** (2 / 3.0), cth), HEAD_C[1] + b * math.copysign(abs(sth) ** (2 / 3.0), sth)))
        return pts
    o = lower(1.03, 1.16)
    inn = lower(0.9, 0.98)
    pts = [p for p in o if p[1] <= 1.0] + list(reversed([p for p in inn if p[1] <= 1.0]))
    L(c, pts, M_hair(), 0.0, 0.06, 'strap')


BEARDS[9] = ('Chin strap', beard_chinstrap)
