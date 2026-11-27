"""Shields (#38) in the ten tiers of the armour sets, shaped by their era: the early, poor tiers 1-4 carry a small
round parma that grows with the tier; from tier 5 (bronze, the legion era) a tall rectangular scutum that keeps growing.

  shield{t}      shield bone (child of the back hand)

Built in shield-bone space: the origin is where the back hand grips it (behind the boss), y up, the face towards the
camera. The rig keeps the shield upright with the torso (src/rig/shield.ts), so these are drawn standing.
Sizes in rig units (1 unit = 1/10 of the fighter): the parma 2.3 -> 2.8 across, the scutum 2.0 x 3.6 -> 2.4 x 4.3.
"""
import math
import sprite_lib as sl
import kit
import armor

pc = sl.pc
L, E, R = kit.L, kit.E, kit.R
M = armor.M

ROUND_TIERS = 4   # tiers 1-4 round, 5-10 scutum


def round_r(t):
    return 1.15 + 0.08 * (t - 1)


def scutum_wh(t):
    k = (t - 5) / 5
    return 2.0 + 0.4 * k, 3.6 + 0.7 * k


def _wood(name, tint):
    return sl.tex_board(name, 'brown', tint=tint, scale=0.3, rot=1.5708)


def _tier(t):
    """(face, face_d, rim, boss, torn) materials for tier t, matching the armour set of that tier"""
    pulp = lambda n, c_: sl.tex_board(n, 'craft', tint=c_, scale=0.3)
    return {
        1: (_wood('shield_scrap', '#9c7a52'), _wood('shield_scrap_d', '#6e5236'), M('rag_d'), M('rag'), True),
        2: (pulp('shield_pulp', '#aaa294'), pulp('shield_pulp_d', '#857d70'), M('leather'), M('leather_d'), False),
        3: (M('quilt'), M('linen_d'), M('linen_d'), M('linen'), False),
        4: (M('leather_l'), M('leather_d'), M('leather_d'), M('bronze'), False),
        5: (M('red'), M('red_d'), M('bronze'), M('bronze'), False),
        6: (M('iron'), M('iron_d'), M('iron_d'), M('iron'), False),
        7: (M('red_d'), M('red'), M('iron'), M('steel'), False),
        8: (M('red'), M('red_d'), M('brass'), M('brass'), False),
        9: (M('steel'), M('steel_d'), M('gold'), M('gold'), False),
        10: (M('purple'), M('purple'), M('gold'), M('gold'), False),
    }[t]


def _poly(pts, torn, seed, amp=0.03):
    return sl.torn(pts, amp, seed) if torn else pts


def _ring(c, outer, inner, mat, z, h=0.06, name='rim'):
    pc.layer(outer, mat, h=h, z=z, holes=[list(reversed(inner))], coll=c, name=name, bevel=0.01)


def _boss(c, t, boss, z, r=0.42):
    if t == 1:   # a knot of rag tied through the planks
        L(c, sl.torn(E(0.28, 0.24, 0.0, 0.0, 20), 0.03, 7), boss, z, 0.06, 'knot')
        return
    L(c, E(r, r, 0.0, 0.0, 40), boss, z, 0.1, 'boss')
    L(c, E(r * 0.55, r * 0.55, -0.05, 0.05, 32), boss, z + 0.1, 0.06, 'boss_top')
    if t == 10:
        L(c, E(0.12, 0.12, 0.0, 0.0, 20), M('purple'), z + 0.16, 0.03, 'gem')


def _rivets(c, pts, mat, z, r=0.05):
    for x, y in pts:
        L(c, E(r, r, x, y, 16), mat, z, 0.03, 'rivet')


def _planks(c, outline, n, w, mat_a, mat_b, torn, seed):
    """vertical planks cut to the outline (shield face of wood or card strips)"""
    for i in range(n):
        x0 = -w / 2 + i * w / n
        part = sl.clip_x(outline, x0 + 0.01, x0 + w / n - 0.01)
        if len(part) >= 3:
            L(c, _poly(part, torn, seed + i, 0.02), mat_a if i % 2 == 0 else mat_b, 0.0, 0.06, 'plank')


def _laurel(c, r, z):
    """a wreath of leaves around the boss (tier 10)"""
    for i in range(14):
        a = i / 14 * math.tau
        L(c, E(0.16, 0.06, r * math.cos(a), r * math.sin(a), 16, a + 1.2), M('laurel'), z, 0.02, 'leaf')



def round_shield(t):
    """tiers 1-4: a small round parma of planks, pulp, layered card or leather"""
    def build(c):
        face, face_d, rim, boss, torn = _tier(t)
        rr = round_r(t)
        outline = E(rr, rr, 0.0, 0.0, 72)
        if t == 1:
            _planks(c, sl.torn(outline, 0.04, 11), 4, 2 * rr, face, face_d, True, 20)
            for y in (0.55, -0.55):   # cross battens and a rag rim
                L(c, sl.torn(R(2.2, 0.16, 0.03, 0.0, y), 0.02, 30 + int(y * 10)), face_d, 0.08, 0.04, 'batten')
            _ring(c, sl.torn(E(rr + 0.03, rr + 0.03, 0, 0, 48), 0.03, 12), E(rr - 0.12, rr - 0.12, 0, 0, 48), rim, 0.1, 0.05)
        else:
            L(c, outline, face, 0.0, 0.08, 'face')
            if t in (2, 3):   # layered card: a lighter inner disc
                L(c, E(rr * 0.72, rr * 0.72, 0.0, 0.0, 64), face_d, 0.08, 0.03, 'inner')
            _ring(c, E(rr + 0.03, rr + 0.03, 0, 0, 72), E(rr - 0.16, rr - 0.16, 0, 0, 72), rim, 0.1, 0.06)
        if t == 4:   # studs round the rim
            n = 12
            _rivets(c, [((rr - 0.08) * math.cos(i / n * math.tau), (rr - 0.08) * math.sin(i / n * math.tau)) for i in range(n)], boss, 0.16)
        _boss(c, t, boss, 0.14)
    return build


def scutum(t):
    """tiers 5-10: the legion's tall curved board with a spine, a cross band and a metal boss"""
    def build(c):
        face, face_d, rim, boss, torn = _tier(t)
        w, h = scutum_wh(t)
        L(c, pc.rrect(w, h, 0.32), face, 0.0, 0.08, 'face')
        # the curve of the board: a strip down the middle catches the light
        L(c, pc.rrect(w * 0.34, h - 0.3, 0.12), face_d if t == 6 else face, 0.06, 0.02, 'curve')
        L(c, R(0.22, h - 0.36, 0.08, 0.0, 0.0), rim, 0.09, 0.03, 'spine')
        L(c, R(w - 0.36, 0.2, 0.08, 0.0, 0.0), rim, 0.09, 0.03, 'band')
        if t in (8, 9):   # wings / lightning flanking the boss (legion)
            for sx in (1, -1):
                for sy in (1, -1):
                    L(c, [(0.18 * sx, 0.5 * sy), (0.72 * sx, 1.35 * sy), (0.52 * sx, 1.5 * sy), (0.08 * sx, 0.62 * sy)],
                      boss, 0.11, 0.03, 'wing')
        if t == 10:
            _laurel(c, 0.82, 0.11)
        _ring(c, pc.rrect(w + 0.05, h + 0.05, 0.34), pc.rrect(w - 0.3, h - 0.3, 0.22), rim, 0.1, 0.06)
        if t in (6, 7):
            xs, ys = (w / 2 - 0.08, -(w / 2 - 0.08)), (h / 2 - 0.4, 0.0, -(h / 2 - 0.4))
            _rivets(c, [(x, y) for x in xs for y in ys], M('steel_d'), 0.16)
        _boss(c, t, boss, 0.14, r=0.48)
    return build


SHIELDS = {t: (round_shield(t) if t <= ROUND_TIERS else scutum(t)) for t in range(1, 11)}