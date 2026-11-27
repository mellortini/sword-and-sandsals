"""New-game intro (#322): the prologue of "The Seventh Step" (docs/SCENARIUSZ.md), five paper dioramas.

  1  Kamionka at dusk: the village feast around Fredi's leaning statue, bunting, lanterns, a bard with a lute
  2  the cobbler's workshop at night: boots on the shelf, a candle, six chalk footprints and a seventh nobody sees
  3  the Book of Duels: a hundred empty lines, the Order's seal of seven footprints
  4  morning road: Bartek's cart leaving, the goat left at the fence, Adi waving with his betting coins
  5  Brackwater: the arena gate, masts behind the wall, one-eyed Magpie with his ledger

  python -I tools/blender.py blender/story_prologue.py -- [samples] [shot,...] [width]

Writes assets/story/prologue_<n>.jpg (1920x1080; a smaller width for quick looks goes to out/). The words of the
scene live in src/data/story.ts (PROLOGUE), the narration in tools/voice/prologue.json. Same camera, depth of field
and paper as the act 1 scenes (blender/story_act1.py); every shot runs in its own Blender.
"""
import bpy, sys, os, math, random, subprocess
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import sprite_lib as sl  # noqa: E402
import weapons  # noqa: E402
pc = sl.pc

argv = sys.argv[sys.argv.index('--') + 1:] if '--' in sys.argv else []
SAMPLES = int(argv[0]) if argv else 96
ONLY = [p for p in (argv[1].split(',') if len(argv) > 1 else []) if p]
WIDTH = int(argv[2]) if len(argv) > 2 else 1920
FINAL = WIDTH == 1920
OUT = os.path.join(sl.GAME, 'assets', 'story') if FINAL else os.path.join(sl.GAME, 'out', 'story')
W, H = WIDTH, WIDTH * 9 // 16
FOCUS = 6.0
X0, X1, Y0, Y1 = -29.0, 29.0, -12.0, 22.0
os.makedirs(OUT, exist_ok=True)


def L(pts, mat, z, h=0.12, holes=(), name='l'):
    return pc.layer(pts, mat, h=h, z=z, holes=holes, name=name, bevel=0.015)


def R(x0, y0, x1, y1, r=0.0):
    return pc.xf(pc.rrect(x1 - x0, y1 - y0, r), (x0 + x1) / 2, (y0 + y1) / 2)


def E(rx, ry, x, y, n=40, rot=0.0):
    return pc.xf(pc.ellipse_pts(rx, ry, n), x, y, rot)


def rot_pts(pts, cx, cy, a):
    c, s = math.cos(a), math.sin(a)
    return [(cx + (x - cx) * c - (y - cy) * s, cy + (x - cx) * s + (y - cy) * c) for x, y in pts]


def paper(name, col, fiber='washi', scale=0.15):
    return sl.tex_paper(name, col, fiber, 0.9, scale=scale)


def board(name, col, kind='brown', scale=0.2, rot=0.0):
    return sl.tex_board(name, kind, tint=col, scale=scale, rot=rot)


def glow(name, col, k):
    return pc.glow_mat(name, col, k)


def place(build, x, y, z, s=1.0, rot=0.0):
    """a kit builder (weapon) set into the shot"""
    tmp = sl.new_coll('_prop')
    build(tmp)
    c, sn = math.cos(rot), math.sin(rot)
    for o in list(tmp.objects):
        ox, oy = o.location.x, o.location.y
        o.location = (x + (ox * c - oy * sn) * s, y + (ox * sn + oy * c) * s, z * pc.ZK + o.location.z * s)
        o.rotation_euler.z += rot
        o.scale = (o.scale.x * s, o.scale.y * s, o.scale.z * s)
        tmp.objects.unlink(o)
        bpy.context.scene.collection.objects.link(o)
    bpy.data.collections.remove(tmp)


def begin(world, world_k, sun_k, seed):
    sc = sl.setup(samples=SAMPLES, world=world, world_strength=world_k, sun_strength=sun_k)
    sc.render.film_transparent = False
    sc.render.resolution_x, sc.render.resolution_y = W, H
    sc.render.image_settings.file_format = 'JPEG'
    sc.render.image_settings.color_mode = 'RGB'
    sc.render.image_settings.quality = 90
    return sc, random.Random(seed)


def shoot(sc, name, fstop=0.3, cam_y=4.7):
    fz = FOCUS * pc.ZK + 0.2
    cam = sc.camera
    cam.data.type = 'PERSP'
    cam.data.lens = 50
    cam.data.sensor_width = 36
    cam.data.sensor_fit = 'HORIZONTAL'
    dist = 50.5 * 50 / 36
    cam.location = (0, cam_y, fz + dist)
    cam.rotation_euler = (0, 0, 0)
    cam.data.dof.use_dof = True
    cam.data.dof.focus_distance = dist
    cam.data.dof.aperture_fstop = fstop
    cam.data.clip_end = 1000
    out = os.path.join(OUT, f'prologue_{name}.jpg')
    sc.render.filepath = out
    bpy.ops.render.render(write_still=True)
    print('STORY', out, flush=True)


def candle(x, y, z, h=1.6, r=0.25, light=80.0):
    wax = paper('wax', '#efe3c4', 'white')
    L(R(x - r, y, x + r, y + h, 0.08), wax, z, 0.1, name='candle')
    L(pc.xf(pc.teardrop_pts(0.3, 0.7), x, y + h + 0.33), glow('flame', '#ffb347', 12.0), z + 0.12, 0.04, name='flame')
    L(pc.xf(pc.teardrop_pts(0.14, 0.34), x, y + h + 0.25), glow('flame_in', '#fff1b0', 16.0), z + 0.16, 0.03, name='flame_in')
    pc.point('candle', (x, y + h + 0.6, (z + 0.8) * pc.ZK), light, '#ffb35c', 0.3)


def person(x, y, z, mat, s=1.0, lean=0.0, name='person', arm=None):
    """a paper person (silhouette, no face): head, shoulders, waist, a short tunic and two legs; `arm` = angle of a raised arm"""
    body = [(-1.95, 5.0), (-1.7, 5.35), (1.7, 5.35), (1.95, 5.0), (1.3, 3.4), (1.6, 1.6), (0.95, 1.6), (0.9, 0.0),
            (0.25, 0.0), (0.12, 1.3), (-0.12, 1.3), (-0.25, 0.0), (-0.9, 0.0), (-0.95, 1.6), (-1.6, 1.6), (-1.3, 3.4)]
    parts = [
        (E(0.75 * s, 0.85 * s, x, y + 6.6 * s), z + 0.1, 'head'),
        ([(x + px * s, y + py * s) for px, py in body], z, 'body'),
        (R(x - 0.42 * s, y + 5.1 * s, x + 0.42 * s, y + 6.0 * s, 0.2 * s), z + 0.05, 'neck'),
        (pc.xf(pc.rrect(0.5 * s, 3.0 * s, 0.25 * s), x - 1.85 * s, y + 3.6 * s, -0.12), z + 0.03, 'arm_b'),
    ]
    if arm is None:
        parts.append((pc.xf(pc.rrect(0.5 * s, 3.0 * s, 0.25 * s), x + 1.85 * s, y + 3.6 * s, 0.12), z + 0.03, 'arm'))
    if arm is not None:
        arm_pts = pc.xf(pc.rrect(0.55 * s, 3.4 * s, 0.25 * s), 0.0, 1.5 * s, arm)
        parts.append(([(x + 1.6 * s + px, y + 4.8 * s + py) for px, py in arm_pts], z + 0.03, 'arm'))
    for pts, zz, part in parts:
        L(rot_pts(pts, x, y, lean), mat, zz, 0.1, name=f'{name}_{part}')


def lantern(x, y, z, col='#ffb347', light=120.0):
    L(E(0.55, 0.7, x, y), glow('lantern_' + col, col, 6.0), z, 0.06, name='lantern')
    L(R(x - 0.3, y + 0.6, x + 0.3, y + 0.85, 0.05), paper('lantern_cap', '#3a2a22'), z + 0.07, 0.03, name='lantern_cap')
    pc.point('lantern', (x, y, (z + 0.9) * pc.ZK), light, col, 0.4)


def footprint(x, y, z, mat, a=0.0, s=1.0, ring=False):
    sole = pc.xf(pc.ellipse_pts(0.42 * s, 0.95 * s, 28), x, y, a)
    heel = pc.xf(pc.ellipse_pts(0.34 * s, 0.4 * s, 20), x + math.sin(-a) * -1.25 * s, y - math.cos(a) * 1.25 * s, a)
    if ring:   # the seventh step: only an outline in the dust
        L(sole, mat, z, 0.02, holes=[list(reversed(pc.xf(pc.ellipse_pts(0.3 * s, 0.82 * s, 28), x, y, a)))], name='step7')
    else:
        L(sole, mat, z, 0.02, name='step')
        L(heel, mat, z, 0.02, name='step_heel')


def cottage(x, y, z, w, h, wall, roof, rnd, window):
    L(R(x - w / 2, y, x + w / 2, y + h, 0.1), wall, z, 0.12, name='cottage')
    L([(x - w / 2 - 0.8, y + h - 0.2), (x + w / 2 + 0.8, y + h - 0.2), (x + w * 0.12, y + h + w * 0.55), (x - w * 0.12, y + h + w * 0.55)],
      roof, z + 0.13, 0.12, name='roof')
    L(R(x - w * 0.18, y + h * 0.35, x + w * 0.08, y + h * 0.7, 0.08), window, z + 0.13, 0.03, name='window')
    L(R(x + w * 0.16, y, x + w * 0.36, y + h * 0.55, 0.1), board('door', '#5a3d28', rot=1.5708), z + 0.13, 0.04, name='door')


def wheel(x, y, z, r, mat):
    L(E(r, r, x, y, 48), mat, z, 0.1, holes=[list(reversed(E(r * 0.8, r * 0.8, x, y, 48)))], name='wheel')
    for k in range(6):
        a = k * math.pi / 6
        L(pc.xf(pc.rrect(0.18, 1.6 * r, 0.05), x, y, a), mat, z + 0.02, 0.05, name='spoke')
    L(E(r * 0.2, r * 0.2, x, y), mat, z + 0.06, 0.06, name='hub')


# ------------------------------------------------------------------ 1: Kamionka at dusk, Fredi's statue
def shot_1():
    sc, rnd = begin('#3a2630', 0.5, 0.9, 1)
    L(R(X0, -2.0, X1, Y1), paper('dusk', '#e59a78', 'water', 0.08), 0.0, 0.1, name='sky')
    L(R(X0, 8.0, X1, Y1), paper('dusk_hi', '#a8667a', 'water', 0.08), 0.12, 0.06, name='sky_hi')
    L(E(3.2, 3.2, -16.0, 6.5), glow('sun', '#ffd59a', 1.6), 0.15, 0.04, name='sun')
    for i, (col, y0, amp) in enumerate((('#7a5a6a', 4.0, 1.6), ('#5e4a5a', 2.0, 1.2))):
        pts = pc.wave_pts(X1 - X0 + 2, amp, 0.12 + 0.05 * i, i * 2.1, y0, 120)
        L(pts + [(X1 + 1, -6.0), (X0 - 1, -6.0)], paper('hill%d' % i, col), 0.5 + i * 0.3, 0.1, name='hill')
    wall = paper('wall', '#e9dcc0', 'white')
    thatch = board('thatch', '#a07a48', 'kraft', 0.18)
    window = glow('window', '#ffc46a', 2.5)
    for x, w, h in ((-23.0, 7.0, 4.2), (-15.5, 5.5, 3.6), (16.5, 6.0, 3.8), (24.0, 7.0, 4.4)):
        cottage(x, -1.2, 1.4 + (0.05 if x > 0 else 0), w, h, wall, thatch, rnd, window)
    L(R(X0, Y0, X1, -1.0), paper('square', '#8a7458'), 2.0, 0.1, name='square')
    # Fredi on his plinth, leaning a little, sword up
    stone = paper('stone', '#b8ad9c', 'white')
    stone_d = paper('stone_d', '#958a7a', 'white')
    L(R(-3.4, -2.0, 3.4, 3.0, 0.2), stone, 3.0, 0.15, name='plinth')
    L(R(-4.0, 2.8, 4.0, 3.6, 0.15), stone_d, 3.16, 0.06, name='plinth_cap')
    person(0.2, 3.6, 3.3, stone, 1.25, lean=-0.09, name='fredi', arm=-0.5)
    place(weapons.SWORDS[5], 3.6, 11.4, 3.45, s=1.6, rot=math.radians(80))
    # bunting across the square and lanterns
    flags = [paper('flag%d' % i, c) for i, c in enumerate(('#b8352a', '#e0b048', '#3f6f8f', '#e9dcc0'))]
    for side in (-1, 1):
        x0, x1 = side * 1.5, side * 27.0
        for k in range(14):
            t = k / 13
            x = x0 + (x1 - x0) * t
            y = 13.5 - 4.0 * math.sin(math.pi * t) * 0.6 - t * 2.0
            L([(x - 0.6, y), (x + 0.6, y), (x, y - 1.3)], flags[k % 4], 4.0 + 0.01 * k, 0.03, name='flag')
    for x, y in ((-9.0, 10.0), (9.5, 9.8), (-20.0, 8.6), (21.0, 8.4)):
        lantern(x, y, 4.2)
    # the village crowd in front, and a bard with a lute on the right
    crowd = paper('crowd', '#3c2a30')
    for i in range(34):
        x = X0 + 1.2 + i * 1.72 + rnd.uniform(-0.3, 0.3)
        if abs(x) < 4.5:
            continue
        L(E(0.75, 0.85, x, -6.4 + (i % 2) * 0.6), crowd, 5.0 + (i % 2) * 0.05, 0.08, name='head')
        L(R(x - 1.2, Y0, x + 1.2, -6.8 + (i % 2) * 0.6, 0.5), crowd, 4.9 + (i % 2) * 0.05, 0.08, name='shoulders')
    bard = paper('bard', '#4a3040')
    person(14.0, -3.2, 4.6, bard, 0.85, lean=0.05, name='bard')
    L(E(1.0, 1.25, 13.0, 0.4, rot=0.6), board('lute', '#8a5a30', 'brown'), 4.75, 0.08, name='lute')
    L(pc.xf(pc.rrect(0.3, 3.2, 0.1), 14.7, 2.0, 0.95), board('lute_neck', '#6e4526'), 4.8, 0.05, name='lute_neck')
    shoot(sc, '1', fstop=0.3, cam_y=5.0)


# ------------------------------------------------------------------ 2: the workshop at night, seven steps
def shot_2():
    sc, rnd = begin('#2a2026', 0.4, 0.7, 2)
    pc.point('moonlight', (-18.0, 12.0, 8.0), 2600, '#9fb4e0', 6.0)
    pc.point('workshop', (4.0, 4.0, 10.0), 3200, '#ffc890', 8.0)
    L(R(X0, -2.0, X1, Y1), board('planks', '#5a4030', 'brown', 0.25, 1.5708), 0.0, 0.1, name='wall')
    # the window with the moon
    L(R(-24.0, 8.0, -14.0, 17.0, 0.3), paper('night', '#22304a', 'water'), 0.12, 0.04, name='window')
    L(E(1.6, 1.6, -17.0, 14.0), glow('moon', '#f4ecd0', 1.2), 0.17, 0.03, name='moon')
    frame = board('frame', '#3e2a1e', rot=0.0)
    L(R(-24.6, 12.2, -13.4, 12.8), frame, 0.2, 0.06, name='mullion')
    L(R(-19.3, 7.4, -18.7, 17.6), frame, 0.22, 0.06, name='mullion')
    L(R(-24.6, 7.4, -13.4, 17.6, 0.3), frame, 0.18, 0.04, holes=[list(reversed(R(-24.0, 8.0, -14.0, 17.0, 0.3)))], name='frame')
    # the shelf of boots
    L(R(2.0, 12.0, 26.0, 12.8), board('shelf', '#6e4b30', rot=0.0), 0.3, 0.12, name='shelf')
    leather = [board('boot%d' % i, c, 'brown', 0.16) for i, c in enumerate(('#7a4a2a', '#4e3424', '#8a5a36'))]
    for i in range(6):
        x = 4.0 + i * 3.7
        m = leather[i % 3]
        L([(x, 12.8), (x + 1.3, 12.8), (x + 1.3, 16.4), (x + 0.1, 16.4)], m, 0.45, 0.1, name='boot_shaft')
        L([(x, 12.8), (x + 2.6, 12.8), (x + 2.6, 13.6), (x + 1.2, 14.2), (x, 14.0)], m, 0.5, 0.1, name='boot_foot')
    # the wooden practice sword on two pegs
    peg = board('peg', '#3e2a1e')
    for x in (-9.0, -1.0):
        L(E(0.3, 0.3, x, 15.0), peg, 0.3, 0.1, name='peg')
    L([(-10.6, 15.3), (0.6, 15.3), (1.9, 15.7), (0.6, 16.1), (-10.6, 16.1)], board('wood_sword', '#a8834e', 'kraft', 0.15, 0.0), 0.42, 0.1, name='wood_sword')
    L(R(-12.9, 14.9, -10.4, 16.5, 0.15), board('wood_grip', '#5a3d28'), 0.43, 0.08, name='wood_hilt')
    # the floor, six chalk steps and a seventh only as an outline
    L(R(X0, Y0, X1, -2.0), board('floor', '#4a3424', 'brown', 0.3, 0.0), 1.0, 0.1, name='floor')
    chalk = paper('chalk', '#e8e2d2', 'white')
    chalk_faint = paper('chalk_faint', '#9c9280', 'white')
    steps = [(-20.0, -8.0, 0.4), (-15.5, -5.5, -0.2), (-11.0, -8.6, 0.5), (-6.0, -6.0, -0.3), (-1.5, -9.0, 0.3), (3.0, -6.4, -0.2)]
    for x, y, a in steps:
        footprint(x, y, 1.12, chalk, a, 1.3)
    footprint(8.5, -9.2, 1.12, chalk_faint, 0.25, 1.3, ring=True)
    # the bench, a boot being mended, and the candle
    L(R(12.0, -2.0, 27.0, 0.6, 0.2), board('bench', '#6e4b30', rot=0.0), 1.3, 0.2, name='bench')
    L([(16.0, 0.6), (18.2, 0.6), (18.2, 4.4), (16.2, 4.4)], leather[0], 1.55, 0.1, name='mend_shaft')
    L([(16.0, 0.6), (21.0, 0.6), (21.0, 1.6), (18.4, 2.4), (16.0, 2.2)], leather[0], 1.6, 0.1, name='mend_foot')
    candle(24.0, 0.6, 1.6, 2.6, 0.45, 260.0)
    # you, mid-step, lit from the bench
    person(-6.0, -4.0, 2.0, paper('you', '#2a1e22'), 1.45, lean=0.12, name='you', arm=-1.1)
    shoot(sc, '2', fstop=0.25)


# ------------------------------------------------------------------ 3: the Book of Duels
def shot_3():
    sc, rnd = begin('#1f1712', 0.2, 0.45, 3)
    L(R(X0, Y0, X1, Y1), board('desk', '#5e4530', 'brown', 0.3, 1.5708), 0.0, 0.1, name='desk')
    page = paper('page', '#f2ead8', 'white')
    page_d = paper('page_d', '#e4d8bf', 'white')
    rule = paper('rule', '#c9b99a', 'white')
    L(R(-20.0, -9.0, -0.4, 15.0, 0.3), page_d, 1.0, 0.1, name='page_l')
    L(R(0.4, -9.0, 20.0, 15.0, 0.3), page, 1.0, 0.1, name='page_r')
    L(R(-0.5, -9.2, 0.5, 15.2, 0.2), board('spine', '#3f2a1e', 'brown'), 0.9, 0.1, name='spine')
    # a hundred empty lines, numbered with tiny ticks
    for col, (xa, xb) in enumerate(((-18.5, -2.0), (2.0, 18.5))):
        for i in range(16):
            y = 13.0 - i * 1.3
            if col == 0 and y > 3.0:
                continue   # the top of the left page holds the seal
            L(R(xa, y - 0.05, xb, y + 0.05), rule, 1.12, 0.01, name='rule')
            L(R(xa, y + 0.05, xa + 0.5, y + 0.45, 0.1), paper('tick', '#8a7a60', None), 1.13, 0.01, name='tick')
    # the Order's seal: dark red wax, seven footprints pressed in a curve, the last one only a ring
    L([(-12.2, 6.0), (-8.8, 6.0), (-7.8, 1.8), (-9.4, 2.8), (-10.5, 1.4), (-11.6, 2.8), (-13.2, 1.8)], paper('ribbon', '#2e3f5a'), 1.25, 0.05, name='ribbon')
    wax = paper('wax', '#8e1f1a')
    wax_d = paper('wax_d', '#6e1612')
    L(pc.xf(pc.blob_pts(3.6, 3.4, 0.06, 14, n=60), -10.5, 8.8), wax, 1.4, 0.35, name='seal')
    L(E(2.7, 2.7, -10.5, 8.8), wax_d, 1.8, 0.04, name='seal_ring')
    for k in range(7):
        a = math.radians(200 - k * 37)
        footprint(-10.5 + 1.7 * math.cos(a), 8.8 + 1.7 * math.sin(a), 1.86, paper('wax_hi', '#b8342a'), -a + math.pi / 2, 0.45, ring=(k == 6))
    # the quill, ink pot and candle
    L(pc.xf(pc.teardrop_pts(1.0, 9.0), 14.0, 2.0, -0.6), paper('quill', '#f4efe6', 'white'), 3.0, 0.05, name='quill')
    L(pc.xf(pc.rrect(0.14, 7.5, 0.05), 14.0, 2.0, -0.6), paper('rachis', '#d9cdb5'), 3.06, 0.03, name='rachis')
    L(R(21.5, -3.0, 25.5, 0.2, 0.6), paper('inkpot', '#231c18', None), 2.0, 0.3, name='inkpot')
    candle(-24.5, -4.0, 2.0, 4.0, 0.65, 420.0)
    shoot(sc, '3', fstop=0.22)


# ------------------------------------------------------------------ 4: the cart leaves, the goat stays
def shot_4():
    sc, rnd = begin('#e9eef0', 0.7, 2.6, 4)
    L(R(X0, -1.0, X1, Y1), paper('morning', '#bcd6e4', 'water', 0.08), 0.0, 0.1, name='sky')
    L(R(X0, -1.0, X1, 6.0), paper('morning_lo', '#e8e4cc', 'water', 0.08), 0.12, 0.06, name='sky_lo')
    L(E(2.6, 2.6, 18.0, 15.0), glow('sun', '#fff3c4', 1.4), 0.15, 0.04, name='sun')
    for i, (col, y0, amp) in enumerate((('#8fae7a', 3.5, 1.4), ('#7a9e66', 1.5, 1.0), ('#6a8e58', -1.0, 0.8))):
        pts = pc.wave_pts(X1 - X0 + 2, amp, 0.1 + 0.04 * i, i * 1.9, y0, 140)
        L(pts + [(X1 + 1, Y0), (X0 - 1, Y0)], paper('field%d' % i, col), 0.4 + i * 0.35, 0.1, name='field')
    # the road running away to the right
    L([(X0 - 1, -9.5), (X0 - 1, -5.5), (2.0, -4.2), (X1 + 1, -1.6), (X1 + 1, -2.6), (4.0, -6.0), (-10.0, -9.0)],
      paper('road', '#cdb58a'), 1.6, 0.06, name='road')
    # Kamionka behind on the left: a fence, the goat, Adi waving with his coins
    rail = board('rail', '#8a6a46', rot=0.0)
    for x in (-27.0, -23.5, -20.0, -16.5):
        L(R(x - 0.3, -4.0, x + 0.3, 0.5, 0.1), rail, 1.8, 0.1, name='post')
    L(R(-28.0, -1.2, -15.5, -0.6), rail, 1.95, 0.06, name='rail')
    L(R(-28.0, -3.0, -15.5, -2.4), rail, 1.95, 0.06, name='rail')
    goat = paper('goat', '#f2ede0', 'white')
    L(E(2.0, 1.2, -21.5, -2.0), goat, 2.1, 0.1, name='goat')
    L([(-19.8, -1.6), (-18.6, -0.4), (-17.6, -0.9), (-18.8, -2.2)], goat, 2.12, 0.1, name='goat_head')
    L([(-18.8, -0.6), (-19.4, 0.8), (-18.6, -0.4)], paper('horn', '#8a7a60'), 2.25, 0.03, name='horn')
    for x in (-23.0, -22.2, -20.8, -20.0):
        L(R(x - 0.2, -4.2, x + 0.2, -2.6, 0.1), goat, 2.08, 0.06, name='goat_leg')
    person(-11.5, -5.6, 2.2, paper('adi', '#5a3a4a'), 0.9, lean=-0.04, name='adi', arm=-0.4)
    coin = sl.foil('coin', '#d6ac48', metal=0.5, rough=0.35, emit=0.2)
    for k, (cx, cy) in enumerate(((-8.6, 1.8), (-8.0, 2.6), (-9.2, 2.8))):
        L(E(0.32, 0.32, cx, cy, 20), coin, 2.4 + 0.02 * k, 0.04, name='coin')
    # Bartek's cart and his old horse, heading off down the road
    wood = board('cart', '#8a6040', 'brown', 0.18, 0.0)
    L([(4.0, -2.6), (15.0, -2.0), (15.0, 1.0), (4.0, 0.4)], wood, 2.6, 0.15, name='cart')
    L(R(4.0, 0.4, 15.0, 0.9), board('cart_rim', '#6a4830', rot=0.0), 2.77, 0.06, name='cart_rim')
    wheel(6.4, -3.0, 2.9, 1.9, board('wheel', '#4e3424'))
    wheel(12.8, -2.6, 2.9, 1.9, board('wheel', '#4e3424'))
    horse = paper('horse', '#7a5236')
    L(E(3.0, 1.5, 19.5, 0.4), horse, 2.5, 0.12, name='horse')
    L([(21.6, 0.8), (23.8, 4.2), (25.2, 3.6), (23.6, 0.2)], horse, 2.55, 0.12, name='horse_neck')
    L(E(1.0, 0.6, 25.0, 3.8, rot=-0.5), horse, 2.6, 0.12, name='horse_head')
    for x in (17.4, 18.4, 20.8, 21.8):
        L(R(x - 0.3, -3.8, x + 0.3, -0.4, 0.1), horse, 2.45, 0.08, name='horse_leg')
    L(R(14.6, 0.0, 17.6, 0.3), board('shaft', '#4e3424', rot=0.0), 2.65, 0.05, name='shaft')
    person(13.2, 0.6, 3.0, paper('bartek', '#4a3a2a'), 0.75, name='bartek')
    L(R(11.9, 6.0, 14.5, 6.4, 0.1), board('hat', '#6a5034', 'kraft'), 3.2, 0.06, name='hat_brim')
    L(R(12.4, 6.3, 14.0, 7.3, 0.3), board('hat', '#6a5034', 'kraft'), 3.25, 0.06, name='hat')
    person(7.8, 0.6, 3.0, paper('you', '#2a1e22'), 0.8, lean=-0.1, name='you')
    L(R(4.8, 3.4, 9.6, 3.7), board('stick', '#6a4830', rot=0.0), 3.15, 0.04, name='stick')
    L(E(1.0, 0.9, 4.6, 3.3), paper('bundle', '#b8352a'), 3.2, 0.08, name='bundle')
    shoot(sc, '4', fstop=0.32, cam_y=4.5)


# ------------------------------------------------------------------ 5: Brackwater, Magpie at the gate
def shot_5():
    sc, rnd = begin('#e8dccb', 0.6, 2.2, 5)
    L(R(X0, 4.0, X1, Y1), paper('port_sky', '#f0d2a8', 'water', 0.08), 0.0, 0.1, name='sky')
    # masts of the harbour behind the arena
    for x, h in ((-22.0, 19.0), (-17.5, 17.0), (19.0, 18.5), (24.0, 16.5)):
        L(R(x - 0.25, 6.0, x + 0.25, h), board('mast', '#5e4530', rot=1.5708), 0.3, 0.06, name='mast')
        L([(x - 0.1, h - 0.6), (x + 2.2, h - 1.0), (x - 0.1, h - 1.6)], paper('pennant', '#a7281f'), 0.35, 0.02, name='pennant')
    # the arena wall with arches and the big gate in the middle
    stone = board('arena', '#c9a982', 'kraft', 0.22)
    arches = []
    for i in range(14):
        ax = X0 + 2.0 + i * 4.1
        if abs(ax) < 6.0:
            continue
        pts = [(ax - 1.3, 9.0), (ax + 1.3, 9.0)] + [(ax + 1.3 * math.cos(math.radians(a)), 12.4 + 1.3 * math.sin(math.radians(a))) for a in range(0, 181, 15)]
        arches.append(list(reversed(pts)))
    L(R(X0, -2.0, X1, 16.0), stone, 1.0, 0.15, holes=arches, name='arena')
    L(R(X0, 15.4, X1, 16.6), board('cornice', '#b08f6a', 'kraft', 0.22), 1.18, 0.05, name='cornice')
    L(R(X0, 6.8, X1, 7.6), board('cornice', '#b08f6a', 'kraft', 0.22), 1.18, 0.05, name='band')
    gate = [(-4.2, -2.0), (4.2, -2.0)] + [(4.2 * math.cos(math.radians(a)), 7.0 + 4.2 * math.sin(math.radians(a))) for a in range(0, 181, 10)]
    L(gate, paper('gate_dark', '#2a2024', None), 1.2, 0.04, name='gate')
    for x in (-12.0, 12.0):
        L([(x - 1.4, 15.0), (x + 1.4, 15.0), (x + 1.4, 8.0), (x, 9.0), (x - 1.4, 8.0)], paper('banner', '#8e1f1a'), 1.3, 0.04, name='banner')
        L(E(0.7, 0.7, x, 12.4), paper('banner_mark', '#e0b048'), 1.36, 0.02, name='banner_mark')
    L(R(X0, Y0, X1, -2.0), paper('cobbles', '#9a8a74'), 2.0, 0.1, name='street')
    # Magpie at the gate: one eye patched, the ledger open, your goat money on it
    magpie = paper('magpie', '#2e2a30')
    mx = -9.0
    person(mx, -6.5, 3.0, magpie, 1.25, name='magpie')
    L(E(0.34, 0.28, mx + 0.35, 1.9), paper('patch', '#0e0a0c', None), 3.2, 0.03, name='patch')
    L(pc.xf(pc.rrect(1.9, 0.12, 0.05), mx + 0.1, 2.05, 0.35), paper('strap', '#0e0a0c', None), 3.18, 0.02, name='strap')
    L(R(mx - 0.4, -3.2, mx + 5.2, -1.2, 0.1), paper('ledger', '#f2ead8', 'white'), 3.3, 0.08, name='ledger')
    L(R(mx + 2.35, -3.3, mx + 2.45, -1.1), paper('ledger_spine', '#6e2a1f'), 3.4, 0.02, name='ledger_fold')
    coin = sl.foil('coin', '#d6ac48', metal=0.5, rough=0.35, emit=0.2)
    for k, (cx, cy) in enumerate(((mx + 3.4, -1.6), (mx + 3.9, -1.45), (mx + 3.6, -1.25))):
        L(E(0.32, 0.32, cx, cy, 20), coin, 3.42 + 0.02 * k, 0.03, name='coin')
    # you, from behind, in front on the right, with the bundle from home
    person(10.0, Y0, 5.0, paper('you', '#2a1e22'), 1.55, name='you')
    L(E(1.5, 1.3, 13.6, -0.4), paper('bundle', '#b8352a'), 5.2, 0.08, name='bundle')
    L(pc.xf(pc.rrect(0.3, 7.0, 0.1), 12.2, -3.0, 0.5), board('stick', '#6a4830'), 5.15, 0.05, name='stick')
    shoot(sc, '5', fstop=0.3, cam_y=5.0)


SHOTS = {'1': shot_1, '2': shot_2, '3': shot_3, '4': shot_4, '5': shot_5}
if len(ONLY) == 1:
    SHOTS[ONLY[0]]()
else:
    # every shot in a fresh Blender: sl.setup() clears the scene, and cached materials would point at removed data
    for name in ONLY or SHOTS:
        subprocess.check_call([bpy.app.binary_path, '-b', '--disable-autoexec', '--python', os.path.abspath(__file__), '--',
                               str(SAMPLES), name, str(WIDTH)])
print('STORY done')
