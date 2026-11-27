"""Act 1 story scenes (#64): short paper dioramas shown between the leagues of Pulpport, two shots per scene.

  1  after the Bronze champion   1a Magpie's wall of clippings, your first fight pinned in the middle
                                 1b the Chronicle: a quill writes your name, very small, by a candle
  2  after the Silver champion   2a a night street: a beaten gladiator fades to blank paper
                                 2b a page of the Codex, lines blacked out, Archcensor Redact's black seal
  3  after the Gold champion     3a Mirra's counter: fire in a jar, hidden under the counter
                                 3b a wanted poster for the Kindler, its edges burnt
  4  after Pulpport's champion   4a the arena at night: a masked figure lights his blade on the wall
                                 4b his paper mask, close, sparks drifting
  5  after the Legend champion   5a an invitation sealed with the Codex
                                 5b a paper ship leaving port for Folio, the capital's tower of books on the horizon

  python -I tools/blender.py blender/story_act1.py -- [samples] [shot,...]

Writes assets/story/act1_<shot>.jpg (1920x1080). The words of each scene live in src/data/story.ts. Same camera, depth
of field and paper as the shop interiors (blender/interiors.py); every shot runs in its own Blender, like the rooms.
"""
import bpy, sys, os, math, random, subprocess
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import sprite_lib as sl  # noqa: E402
import armor  # noqa: E402
import weapons  # noqa: E402
pc = sl.pc
M = armor.M

argv = sys.argv[sys.argv.index('--') + 1:] if '--' in sys.argv else []
SAMPLES = int(argv[0]) if argv else 96
ONLY = [p for p in (argv[1].split(',') if len(argv) > 1 else []) if p]
OUT = os.path.join(sl.GAME, 'assets', 'story')
W, H = 1920, 1080
FOCUS = 6.0
X0, X1, Y0, Y1 = -29.0, 29.0, -12.0, 22.0
os.makedirs(OUT, exist_ok=True)


def L(pts, mat, z, h=0.12, holes=(), name='l'):
    return pc.layer(pts, mat, h=h, z=z, holes=holes, name=name, bevel=0.015)


def R(x0, y0, x1, y1, r=0.0):
    return pc.xf(pc.rrect(x1 - x0, y1 - y0, r), (x0 + x1) / 2, (y0 + y1) / 2)


def E(rx, ry, x, y, n=40, rot=0.0):
    return pc.xf(pc.ellipse_pts(rx, ry, n), x, y, rot)


def paper(name, col, fiber='washi', scale=0.15):
    return sl.tex_paper(name, col, fiber, 0.9, scale=scale)


def board(name, col, kind='brown', scale=0.2, rot=0.0):
    return sl.tex_board(name, kind, tint=col, scale=scale, rot=rot)


def glow(name, col, k):
    return pc.glow_mat(name, col, k)


def lines(x0, y0, x1, n, gap, mat, z, h=0.12, rnd=None, name='text'):
    """rows of 'writing': thin dark strips of random length, like printed or written lines seen from afar"""
    for i in range(n):
        ln = (x1 - x0) * (rnd.uniform(0.55, 1.0) if rnd else 1.0)
        L(R(x0, y0 - i * gap - h / 2, x0 + ln, y0 - i * gap + h / 2, h / 2), mat, z, 0.02, name=name)


def place(build, x, y, z, s=1.0, rot=0.0):
    """a kit builder (weapon / armour) set into the shot"""
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


def begin(world, world_k, sun_k):
    sc = sl.setup(samples=SAMPLES, world=world, world_strength=world_k, sun_strength=sun_k)
    sc.render.film_transparent = False
    sc.render.resolution_x, sc.render.resolution_y = W, H
    sc.render.image_settings.file_format = 'JPEG'
    sc.render.image_settings.color_mode = 'RGB'
    sc.render.image_settings.quality = 90
    return sc, random.Random(64)


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
    out = os.path.join(OUT, f'act1_{name}.jpg')
    sc.render.filepath = out
    bpy.ops.render.render(write_still=True)
    print('STORY', out, flush=True)


def candle(x, y, z, h=1.6, r=0.25, light=80.0):
    wax = paper('wax', '#efe3c4', 'white')
    L(R(x - r, y, x + r, y + h, 0.08), wax, z, 0.1, name='candle')
    L(pc.xf(pc.teardrop_pts(0.3, 0.7), x, y + h + 0.33), glow('flame', '#ffb347', 12.0), z + 0.12, 0.04, name='flame')
    L(pc.xf(pc.teardrop_pts(0.14, 0.34), x, y + h + 0.25), glow('flame_in', '#fff1b0', 16.0), z + 0.16, 0.03, name='flame_in')
    pc.point('candle', (x, y + h + 0.6, (z + 0.8) * pc.ZK), light, '#ffb35c', 0.3)


def figure(x, y, z, mat, s=1.0, name='figure'):
    """a paper person, front on: head, shoulders, body tapering to the ground (no face: a silhouette in the story)"""
    L(E(0.75 * s, 0.85 * s, x, y + 6.6 * s), mat, z + 0.1, 0.12, name=name + '_head')
    L([(x - 2.0 * s, y + 5.2 * s), (x + 2.0 * s, y + 5.2 * s), (x + 1.6 * s, y + 1.0 * s), (x + 1.2 * s, y), (x - 1.2 * s, y),
       (x - 1.6 * s, y + 1.0 * s)], mat, z, 0.12, name=name + '_body')
    L(R(x - 0.5 * s, y + 5.0 * s, x + 0.5 * s, y + 6.0 * s, 0.2 * s), mat, z + 0.05, 0.1, name=name + '_neck')


# ------------------------------------------------------------------ 1a: Magpie's wall of clippings
def shot_1a():
    sc, rnd = begin('#2e2420', 0.35, 1.4)
    L(R(X0, Y0, X1, Y1), board('cork', '#9c7a52', 'kraft', 0.25), 0.0, 0.1, name='cork')
    news = pc.pattern_mat('news', 'hstripes', '#ece6d8', '#8a8478', freq=6.0, ratio=0.72, grit=0.5)
    news_y = pc.pattern_mat('news_y', 'hstripes', '#e3d6b4', '#7d7462', freq=6.0, ratio=0.72, grit=0.5)
    ink = paper('ink', '#2a2522', None)
    grey = paper('photo', '#9b958a', 'white')
    pin = paper('pin', '#a7281f')
    k = 0
    for row in range(7):
        for col in range(9):
            x = X0 + 3 + col * 6.4 + rnd.uniform(-0.8, 0.8)
            y = Y1 - 3 - row * 5.0 + rnd.uniform(-0.6, 0.6)
            if abs(x - 0.0) < 6 and abs(y - 4.5) < 5:   # leave the middle for the new clipping
                continue
            w, h = rnd.uniform(4.0, 5.6), rnd.uniform(3.2, 4.4)
            a = rnd.uniform(-0.15, 0.15)
            z = 0.2 + 0.03 * k
            L(sl.torn(pc.xf(pc.rrect(w, h, 0.0), x, y, a), 0.05, 200 + k, 0.12), news if k % 3 else news_y, z, 0.04, name='clip')
            L(pc.xf(pc.rrect(w * 0.7, 0.42, 0.0), x - w * 0.08, y + h * 0.32, a), ink, z + 0.05, 0.02, name='headline')
            if k % 3 == 1:
                L(pc.xf(pc.rrect(w * 0.34, h * 0.45, 0.0), x + w * 0.2, y - h * 0.1, a), grey, z + 0.05, 0.02, name='photo')
            L(E(0.18, 0.18, x, y + h * 0.42), pin, z + 0.1, 0.08, name='pin')
            k += 1
    # the new clipping: whiter, bigger, a sketch of two gladiators, a red pin and a dab of glue
    fresh = pc.pattern_mat('fresh', 'hstripes', '#fbf8ef', '#9a948a', freq=6.0, ratio=0.75, grit=0.3)
    L(sl.torn(pc.xf(pc.rrect(9.0, 7.0, 0.0), 0.0, 4.5, 0.05), 0.05, 300, 0.12), fresh, 4.0, 0.05, name='new_clip')
    L(pc.xf(pc.rrect(7.4, 0.8, 0.0), -0.3, 7.2, 0.05), ink, 4.1, 0.02, name='new_headline')
    sketch = paper('sketch', '#3a3430', None)
    for sx, lean in ((-1.8, 0.15), (1.8, -0.15)):
        L(pc.xf(E(0.45, 0.5, 0, 0), sx, 5.4, lean), sketch, 4.12, 0.02, name='sk_head')
        L(pc.xf([(-0.7, 0.0), (0.7, 0.0), (0.5, -2.6), (-0.5, -2.6)], sx, 4.8, lean), sketch, 4.12, 0.02, name='sk_body')
    L(pc.xf(pc.rrect(3.2, 0.12, 0.05), 0.0, 4.6, 0.6), sketch, 4.13, 0.02, name='sk_blades')
    L(E(0.28, 0.28, 0.0, 7.9), pin, 4.2, 0.12, name='new_pin')
    L(pc.blob_pts(0.7, 0.35, 0.2, 7, n=30), pc.paper_mat('glue', '#f6f2e6', rough=0.25, sss=0.3), 4.15, 0.02, name='glue')
    pc.point('lamp', (2.0, 9.0, 9.0), 1800, '#ffd9a0', 3.0)
    shoot(sc, '1a', fstop=0.25)


# ------------------------------------------------------------------ 1b: the Chronicle
def shot_1b():
    sc, rnd = begin('#1f1712', 0.2, 0.4)
    L(R(X0, Y0, X1, Y1), board('desk', '#5e4530', 'brown', 0.3, 1.5708), 0.0, 0.1, name='desk')
    page = paper('page', '#f2ead8', 'white')
    page_d = paper('page_d', '#e4d8bf', 'white')
    ink = paper('ink', '#231c18', None)
    L(R(-20.0, -9.0, -0.4, 14.0, 0.3), page_d, 1.0, 0.1, name='page_l')
    L(R(0.4, -9.0, 20.0, 14.0, 0.3), page, 1.0, 0.1, name='page_r')
    L(R(-0.5, -9.2, 0.5, 14.2, 0.2), board('spine', '#6e2a1f', 'brown'), 0.9, 0.1, name='spine')
    lines(-18.0, 12.0, -2.5, 15, 1.35, ink, 1.12, 0.14, rnd)
    lines(2.5, 12.0, 18.0, 9, 1.35, ink, 1.12, 0.14, rnd)
    # the newest line: one short word in fresh ink, and the quill still on it
    L(R(2.5, -0.35, 6.2, -0.05, 0.1), paper('wet_ink', '#0f0c0a', None), 1.14, 0.02, name='new_name')
    L(pc.xf(pc.teardrop_pts(1.0, 9.0), 9.5, 4.2, -0.55), paper('quill', '#f4efe6', 'white'), 3.0, 0.05, name='quill')
    L(pc.xf(pc.rrect(0.14, 7.5, 0.05), 9.5, 4.2, -0.55), paper('rachis', '#d9cdb5'), 3.06, 0.03, name='rachis')
    L(R(21.0, -2.0, 25.0, 1.0, 0.6), ink, 2.0, 0.3, name='inkpot')
    candle(-24.0, -3.0, 2.0, 3.5, 0.6, 400.0)
    shoot(sc, '1b', fstop=0.22)


# ------------------------------------------------------------------ 2a: the erased gladiator
def shot_2a():
    sc, rnd = begin('#141a2a', 0.25, 0.3)
    L(R(X0, -2.0, X1, Y1), paper('night', '#1e2a44', 'water', 0.1), 0.0, 0.1, name='sky')
    L(E(2.0, 2.0, 18.0, 18.5), glow('moon', '#f2ecd0', 1.2), 0.15, 0.05, name='moon')
    house = [paper('house%d' % i, c) for i, c in enumerate(('#3a3448', '#463c52', '#2f2b3e'))]
    win = glow('window', '#f2c06a', 2.0)
    x = X0
    while x < X1:
        w, h = rnd.uniform(5.0, 8.0), rnd.uniform(8.0, 13.0)
        L([(x, -4.0), (x + w, -4.0), (x + w, h), (x + w / 2, h + 2.5), (x, h)], rnd.choice(house), 1.0 + rnd.uniform(0, 0.3), 0.15, name='house')
        if rnd.random() < 0.6:
            L(R(x + w * 0.3, h - 4.0, x + w * 0.6, h - 2.0, 0.1), win, 1.4, 0.03, name='window')
        x += w + 0.3
    L(R(X0, Y0, X1, -3.5), paper('street', '#2a2a36', 'water'), 4.0, 0.1, name='street')
    # the beaten gladiator: half still inked, half gone to blank white paper, ink running off
    inked, blank = paper('inked', '#7a5a46'), paper('blank', '#f7f3ea', 'white')
    figure(0.0, -3.5, 5.0, inked, 1.8, 'erased')
    # the right half has already gone blank, from the head down
    L([(0.0, -3.5), (2.2, -3.5), (2.9, -1.7), (3.6, 5.9), (0.0, 5.9)], blank, 5.25, 0.06, name='blank_half')
    L(sl.clip_x(E(1.38, 1.56, 0.0, -3.5 + 6.6 * 1.8), 0.0, 2.0), blank, 5.3, 0.06, name='blank_head')
    ink = paper('run_ink', '#1b1620', None)
    for i in range(7):
        L(pc.xf(pc.teardrop_pts(0.3, 0.65), rnd.uniform(0.2, 3.0), rnd.uniform(-3.2, 4.0), math.pi), ink, 5.4, 0.03, name='drip')
    pc.point('lamp', (-6.0, 6.0, 7.0), 900, '#f2c06a', 2.0)
    pc.point('glow', (0.0, 2.0, 6.5), 500, '#e8e8ff', 2.0)
    shoot(sc, '2a', fstop=0.28)


# ------------------------------------------------------------------ 2b: the Codex page, redacted
def shot_2b():
    sc, rnd = begin('#2a2220', 0.3, 1.0)
    L(R(X0, Y0, X1, Y1), board('table', '#4a3426', 'brown', 0.3), 0.0, 0.1, name='table')
    L(sl.torn(R(-15.0, -10.0, 15.0, 18.0, 0.0), 0.06, 401, 0.2), paper('vellum', '#efe2c2', 'water', 0.12), 1.0, 0.1, name='page')
    ink = paper('ink', '#2a221e', None)
    black = paper('bar', '#0d0b0a', None)
    gold = sl.foil('gold', '#e2b64a', metal=0.65, rough=0.3, emit=0.3)
    L(pc.xf(pc.rrect(10.0, 1.2, 0.2), 0.0, 15.6), ink, 1.12, 0.03, name='title')
    for i in range(14):
        y = 13.0 - i * 1.6
        lines(-12.5, y, 12.5, 1, 1.6, ink, 1.12, 0.22, rnd)
        if i in (3, 4, 7, 10, 11):   # names blacked out
            x0 = rnd.uniform(-12.0, 0.0)
            L(R(x0, y - 0.45, x0 + rnd.uniform(5, 10), y + 0.45, 0.05), black, 1.2, 0.03, name='redacted')
    seal = paper('seal', '#1a1412', None)
    L(pc.blob_pts(3.6, 3.4, 0.08, 9, n=60), seal, 2.0, 0.3, name='seal')
    L(E(2.4, 2.4, 0.0, 0.0), paper('seal_in', '#2b221e', None), 2.3, 0.1, name='seal_ring')
    L(R(-1.6, -0.25, 1.6, 0.25, 0.1), gold, 2.45, 0.05, name='seal_bar')   # a single struck-out line: Redact's mark
    pc.point('lamp', (-8.0, 10.0, 9.0), 1500, '#ffd9a0', 3.0)
    shoot(sc, '2b', fstop=0.25, cam_y=3.0)


# ------------------------------------------------------------------ 3a: fire under the counter
def shot_3a():
    sc, rnd = begin('#1b1830', 0.25, 0.3)
    L(R(X0, Y0, X1, Y1), board('counter_front', '#4a3426', 'brown', 0.3, 1.5708), 0.0, 0.1, name='wood')
    # the counter top across the upper third, the dark space under it, a curtain pulled aside
    L(R(X0, 8.0, X1, 10.5, 0.2), board('top', '#7d5e3e'), 3.0, 0.3, name='counter_top')
    L(R(-22.0, -9.0, 22.0, 8.0, 0.4), paper('under', '#120e14', None), 0.5, 0.1, name='under')
    L([(-22.0, 8.0), (-12.0, 8.0), (-16.0, -9.0), (-22.0, -9.0)], paper('curtain', '#5b2c83'), 2.0, 0.1, name='curtain')
    jar_glass = pc.paper_mat('glass', '#cfe3e0', rough=0.3, sss=0.3)
    L(R(-3.5, -6.0, 3.5, 2.0, 1.2), jar_glass, 1.5, 0.15, name='jar')
    L(R(-2.0, 2.0, 2.0, 3.0, 0.3), board('cork', '#a07a50', 'craft'), 1.7, 0.1, name='cork')
    for i, (col, w, h, y) in enumerate((('#c8402a', 4.0, 6.0, -3.0), ('#ec8a2c', 2.8, 4.6, -3.6), ('#f6cf55', 1.6, 2.8, -4.2))):
        L(pc.xf(pc.teardrop_pts(w, h), 0.0, y), glow('jar_fire%d' % i, col, 6.0 + i * 3), 1.7 + i * 0.05, 0.04, name='fire')
    pc.point('fire', (0.0, -2.0, 2.5), 2200, '#ff8a3a', 1.5)
    # Mirra's ink-black fingertips on the counter edge, top right
    skin = paper('skin', '#eeb48e')
    ink = paper('ink_tip', '#1b1620', None)
    for i in range(4):
        x = 12.0 + i * 1.4
        L(R(x - 0.5, 8.6, x + 0.5, 11.6, 0.4), skin, 3.6, 0.15, name='finger')
        L(R(x - 0.5, 8.6, x + 0.5, 9.6, 0.4), ink, 3.8, 0.05, name='fingertip')
    shoot(sc, '3a', fstop=0.25)


# ------------------------------------------------------------------ 3b: the Kindler's wanted poster
def shot_3b():
    sc, rnd = begin('#2e2420', 0.35, 1.2)
    bricks = [board('brick%d' % i, c, scale=0.25) for i, c in enumerate(('#9c5038', '#8a4632', '#a65e42'))]
    L(R(X0, Y0, X1, Y1), paper('mortar', '#4a2f27'), 0.0, 0.1, name='mortar')
    y, row = Y0, 0
    while y < Y1:
        x = X0 - (row % 2) * 1.4
        while x < X1:
            L(R(x + 0.08, y + 0.08, x + 2.7, y + 1.0, 0.08), rnd.choice(bricks), 0.15, 0.1, name='brick')
            x += 2.8
        y, row = y + 1.1, row + 1
    poster = paper('poster', '#e9dcc0', 'water')
    burnt = paper('burnt', '#3a2418', None)
    ink = paper('p_ink', '#2a1d18', None)
    red = paper('p_red', '#a7281f')
    outline = sl.torn(R(-9.0, -9.0, 9.0, 16.0, 0.0), 0.35, 500, 0.4)
    L(sl.torn(R(-9.4, -9.4, 9.4, 16.4, 0.0), 0.4, 501, 0.4), burnt, 1.0, 0.05, name='char')
    L(outline, poster, 1.1, 0.05, name='poster')
    L(R(-7.0, 12.5, 7.0, 14.5, 0.1), ink, 1.2, 0.03, name='wanted')
    # the masked face: an oval mask with eye slits, flames for hair
    L(E(4.2, 5.0, 0.0, 4.5), paper('mask', '#efe7d4', 'white'), 1.25, 0.04, name='mask')
    for sx in (-1.6, 1.6):
        L(pc.xf(pc.rrect(2.0, 0.5, 0.25), sx, 5.6, -0.2 * sx), ink, 1.3, 0.02, name='eye')
    flame_o, flame_y = paper('p_orange', '#e0701f'), paper('p_yellow', '#f2c14e')
    for i, dx in enumerate((-3.0, -1.2, 0.6, 2.4)):   # hair of flames: printed red, orange and yellow layers
        L(pc.xf(pc.teardrop_pts(1.6, 3.6), dx, 10.0 + (i % 2) * 0.6), red, 1.22, 0.03, name='hair_flame')
        L(pc.xf(pc.teardrop_pts(1.0, 2.4), dx, 9.6 + (i % 2) * 0.6), flame_o, 1.24, 0.02, name='hair_flame_o')
        L(pc.xf(pc.teardrop_pts(0.5, 1.2), dx, 9.2 + (i % 2) * 0.6), flame_y, 1.26, 0.02, name='hair_flame_y')
    L(R(-7.0, -4.0, 7.0, -2.6, 0.1), ink, 1.2, 0.03, name='name')
    L(R(-5.0, -7.0, 5.0, -6.0, 0.1), red, 1.2, 0.03, name='reward')
    for i in range(10):   # embers still glowing at the burnt edge
        a = rnd.uniform(0, math.tau)
        L(E(0.15, 0.15, 9.2 * math.cos(a) * rnd.uniform(0.9, 1.0), 3.5 + 12.5 * math.sin(a) * rnd.uniform(0.9, 1.0), 10), glow('ember', '#ff7a2a', 8.0), 1.3, 0.02, name='ember')
    pc.point('torch', (14.0, 6.0, 6.0), 1500, '#ff9a4a', 2.0)
    shoot(sc, '3b', fstop=0.25)


# ------------------------------------------------------------------ 4a: the Kindler on the arena wall at night
def shot_4a():
    sc, rnd = begin('#0d1018', 0.2, 0.2)
    L(R(X0, 6.0, X1, Y1), paper('night', '#141a2a', 'water', 0.1), 0.0, 0.1, name='sky')
    stone = paper('stone', '#3a3448')
    arches = []
    for i in range(17):
        ax = X0 + 1.6 + i * 3.4
        pts = [(ax - 1.1, 10.0), (ax + 1.1, 10.0)] + [(ax + 1.1 * math.cos(math.radians(a)), 13.0 + 1.1 * math.sin(math.radians(a))) for a in range(0, 181, 15)]
        arches.append(list(reversed(pts)))
    L(R(X0, 8.0, X1, 16.0), stone, 1.0, 0.15, holes=arches, name='colonnade')
    crowd = paper('crowd', '#211d2c')
    for i in range(70):   # dark heads of a silent crowd
        L(E(0.55, 0.62, X0 + i * 0.85 + rnd.uniform(-0.2, 0.2), 6.6 + (i % 3) * 0.5), crowd, 1.5 + (i % 3) * 0.05, 0.08, name='head')
    L(R(X0, -1.0, X1, 6.0), paper('wall', '#2a2638'), 2.0, 0.15, name='barrier')
    L(R(X0, Y0, X1, -1.0), paper('sand', '#4a3f38'), 3.0, 0.1, name='sand')
    figure(0.0, 4.5, 4.0, paper('kindler', '#2a1c20'), 1.6, 'kindler')
    L(E(1.1, 1.25, 0.15, 15.05), paper('mask_n', '#efe7d4', 'white'), 4.3, 0.05, name='mask')
    # the blade held up, burning
    place(weapons.SWORDS[8], 2.6, 12.0, 4.4, s=2.2, rot=math.radians(70))
    for i, (col, w, h) in enumerate((('#c8402a', 1.6, 4.2), ('#ec8a2c', 1.1, 3.2), ('#f6cf55', 0.6, 2.0))):
        L(pc.xf(pc.teardrop_pts(w * 1.3, h * 1.3), 4.6, 18.0 + i * 0.2, -0.3), glow('blade_fire%d' % i, col, 8.0 + i * 3), 4.6 + i * 0.04, 0.04, name='blade_fire')
    pc.point('blade', (4.4, 16.5, 5.5), 3500, '#ff8a3a', 1.0)
    shoot(sc, '4a', fstop=0.3, cam_y=8.5)


# ------------------------------------------------------------------ 4b: the mask, close
def shot_4b():
    sc, rnd = begin('#0d0a0c', 0.15, 0.3)
    L(R(X0, Y0, X1, Y1), paper('dark', '#16101a', None), 0.0, 0.1, name='dark')
    hood = paper('hood', '#2a1c20')
    L(E(13.0, 15.0, 0.0, 3.0), hood, 1.0, 0.15, name='hood')
    mask = paper('mask', '#efe7d4', 'white')
    mask_d = paper('mask_d', '#d9cdb3', 'white')
    L(E(9.0, 11.0, 0.0, 3.5), mask, 2.0, 0.15, name='mask')
    L(E(8.2, 10.2, 0.4, 3.2), mask_d, 2.15, 0.03, name='mask_shade')
    ink = paper('slit', '#0a0708', None)
    for sx in (-3.6, 3.6):
        L(pc.xf(pc.rrect(4.4, 1.2, 0.6), sx, 6.0, -0.12 * sx), ink, 2.2, 0.03, name='eye')
        L(E(0.5, 0.5, sx + 0.4, 6.0), glow('eye_glow', '#ff9a4a', 3.0), 2.25, 0.02, name='eye_glow')
    L(pc.xf(pc.rrect(5.0, 0.4, 0.2), 0.0, -3.5), ink, 2.2, 0.02, name='mouth')
    # a burnt notch at the mask's edge and sparks drifting up through the frame
    L(sl.torn(E(2.0, 1.6, 7.6, 9.6), 0.2, 600, 0.3), paper('char', '#2a1810', None), 2.3, 0.03, name='burn')
    for i in range(26):
        x, y = rnd.uniform(-24, 24), rnd.uniform(-10, 20)
        r = rnd.uniform(0.08, 0.3)
        L(E(r, r, x, y, 10), glow('spark', rnd.choice(('#ff7a2a', '#ffb347', '#ffd36a')), 10.0), rnd.uniform(3.0, 10.0), 0.02, name='spark')
    pc.point('fire', (-14.0, -8.0, 6.0), 2600, '#ff7a2a', 3.0)
    shoot(sc, '4b', fstop=0.22)


# ------------------------------------------------------------------ 5a: an invitation sealed with the Codex
def shot_5a():
    sc, rnd = begin('#2a2220', 0.3, 1.2)
    L(R(X0, Y0, X1, Y1), board('table', '#5e4530', 'brown', 0.3), 0.0, 0.1, name='table')
    L(R(-13.0, -8.0, 13.0, 16.0, 0.3), paper('letter', '#f4ecd8', 'water', 0.12), 1.0, 0.1, name='letter')
    ink = paper('ink', '#2a221e', None)
    L(R(-10.0, 13.0, 4.0, 14.0, 0.2), ink, 1.12, 0.02, name='salutation')
    lines(-10.0, 11.0, 10.0, 7, 1.4, ink, 1.12, 0.16, rnd)
    # the seal: gold wax, a book stamped into it, a ribbon under it
    L([(-1.5, 0.5), (1.5, 0.5), (2.6, -7.5), (1.0, -6.4), (0.0, -8.0), (-1.0, -6.4), (-2.6, -7.5)], paper('ribbon', '#7e1d17'), 1.3, 0.05, name='ribbon')
    gold = sl.foil('wax', '#d4a640', metal=0.5, rough=0.35, emit=0.25)
    gold_d = sl.foil('wax_d', '#a87e2a', metal=0.5, rough=0.4, emit=0.2)
    L(pc.blob_pts(3.4, 3.2, 0.06, 12, n=60), gold, 1.5, 0.35, name='seal')
    L(E(2.4, 2.4, 0.0, 0.0), gold_d, 1.9, 0.05, name='seal_ring')
    L([(-1.6, -0.9), (0.0, -0.6), (1.6, -0.9), (1.6, 1.0), (0.0, 1.3), (-1.6, 1.0)], gold, 2.0, 0.05, name='book')
    L(R(-0.06, -0.6, 0.06, 1.3), gold_d, 2.1, 0.02, name='book_spine')
    candle(19.0, -6.0, 2.0, 5.0, 0.7, 500.0)
    place(weapons.SWORDS[10], -20.0, 10.0, 0.6, s=2.2, rot=math.radians(-30))   # your sword, laid on the table
    shoot(sc, '5a', fstop=0.25)


# ------------------------------------------------------------------ 5b: sailing for Folio
def shot_5b():
    sc, rnd = begin('#f3e6d6', 0.6, 2.4)
    L(R(X0, 2.0, X1, Y1), paper('dawn', '#f2c9a0', 'water', 0.08), 0.0, 0.1, name='sky')
    L(R(X0, 2.0, X1, 9.0), paper('dawn_lo', '#f7dcc0', 'water', 0.08), 0.12, 0.06, name='sky_lo')
    L(E(3.0, 3.0, 8.0, 4.0), glow('sun', '#ffe6b0', 1.5), 0.15, 0.05, name='sun')
    # Folio on the horizon: a tower of stacked books
    books = [paper('book%d' % i, c) for i, c in enumerate(('#8a3a2a', '#3a5a7a', '#6a5a3a', '#4a6a4a', '#7a4a6a'))]
    y = 2.0
    for i in range(12):
        w = 4.4 - i * 0.22
        L(R(-14.0 - w / 2 + rnd.uniform(-0.2, 0.2), y, -14.0 + w / 2, y + 0.9, 0.1), rnd.choice(books), 0.6 + i * 0.01, 0.1, name='book')
        y += 0.95
    L([(-14.6, y), (-13.4, y), (-14.0, y + 2.2)], paper('spire', '#e2b64a'), 0.65, 0.05, name='spire')
    # the sea in bands, the ship mid-frame, the harbour wall in front
    for i, (col, y0) in enumerate((('#5a86a8', 2.0), ('#4a7698', -1.0), ('#3e6888', -4.5))):
        pts = pc.wave_pts(X1 - X0 + 2, 0.25, 0.25 + 0.1 * i, i * 1.7, y0, 160)
        L(pts + [(X1 + 1, Y0), (X0 - 1, Y0)], paper('sea%d' % i, col, 'water'), 2.0 + i * 0.8, 0.1, name='sea')
    hull = board('hull', '#6e4b30', rot=0.0)
    L([(-2.0, -1.5), (11.0, -1.5), (9.5, -4.2), (-0.5, -4.2)], hull, 3.2, 0.2, name='hull')
    L(R(4.3, -1.5, 4.7, 11.0), board('mast', '#5e4530', rot=1.5708), 3.0, 0.1, name='mast')
    sail = paper('sail', '#f4ecd8', 'water')
    L([(0.4, 0.0), (8.6, 0.0), (8.0, 9.6), (1.0, 9.6)], sail, 3.4, 0.08, name='sail')
    L(E(1.2, 1.2, 4.5, 5.0), paper('sail_mark', '#7e1d17'), 3.5, 0.02, name='sail_mark')
    L([(4.7, 11.0), (7.0, 10.4), (4.7, 9.8)], paper('pennant', '#a7281f'), 3.1, 0.03, name='pennant')
    L(R(X0, Y0, -8.0, -6.0, 0.2), board('pier', '#7d5e3e', rot=0.0), 7.0, 0.3, name='pier')
    for x in (-26.0, -20.0, -14.0):
        L(R(x - 0.4, Y0, x + 0.4, -4.5, 0.1), board('post', '#5e4530', rot=1.5708), 7.3, 0.2, name='post')
    shoot(sc, '5b', fstop=0.3)


SHOTS = {'1a': shot_1a, '1b': shot_1b, '2a': shot_2a, '2b': shot_2b, '3a': shot_3a, '3b': shot_3b,
         '4a': shot_4a, '4b': shot_4b, '5a': shot_5a, '5b': shot_5b}
if len(ONLY) == 1:
    SHOTS[ONLY[0]]()
else:
    # every shot in a fresh Blender: sl.setup() clears the scene, and cached materials would point at removed data
    for name in ONLY or SHOTS:
        subprocess.check_call([bpy.app.binary_path, '-b', '--disable-autoexec', '--python', os.path.abspath(__file__), '--', str(SAMPLES), name])
print('STORY done')
