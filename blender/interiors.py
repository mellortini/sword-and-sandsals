"""Shop interiors (#35): five paper dioramas behind the shop screens, 1920x1080, perspective camera with shallow DOF
like the arena (blender/arena.py):

  shop_forge       Old Crease's forge: brick wall, a glowing hearth, a rack of weapons, an anvil
  shop_armoury     the armoury: plaster and beams, armour on stands, helmets on shelves, shields on the wall
  shop_enchanter   Mirra Inkwell's workshop: indigo walls, a moon window, jars, candles, floating glyphs
  shop_temple      the Glue Temple: columns, a stained window, the glue pot on the altar, candles
  shop_training    Magpie's training yard: palisade, straw dummies, a weapon rack, the arena in the distance

  python -I tools/blender.py blender/interiors.py -- [samples] [only,...]

Writes assets/bg/shop_<name>.jpg (no alpha needed; a JPEG is a tenth of the PNG). The shop screen (#34) puts the
vendor's bust on the left and the goods on a scroll on the right, so the middle and right of each room stay calm and the
detail sits at the edges and the top. The props reuse the kit's own weapons, armour and shields, so the rooms sell what
the fighters wear.

Frame at the focus plane (z = FOCUS): 50.5 x 28.4 units (x -25.25..25.25, y -9.5..18.9), as the arena.
Depth (z, units): back wall 0, wall dressing 0.2-2, floor 4, standing props 4.5-7, foreground 9-11 (blurred).
"""
import bpy, sys, os, math, random
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import sprite_lib as sl  # noqa: E402
import kit  # noqa: E402
import armor  # noqa: E402
import weapons  # noqa: E402
import shields  # noqa: E402
pc = sl.pc
M = armor.M

argv = sys.argv[sys.argv.index('--') + 1:] if '--' in sys.argv else []
SAMPLES = int(argv[0]) if argv else 96
ONLY = [p for p in (argv[1].split(',') if len(argv) > 1 else []) if p]
OUT = os.path.join(sl.GAME, 'assets', 'bg')
W, H = 1920, 1080
FOCUS = 6.0
X0, X1, Y0, Y1 = -29.0, 29.0, -12.0, 22.0        # built wider than the frame: the back wall is further away
FLOOR_Y = -2.5                                     # where the floor meets the back wall
os.makedirs(OUT, exist_ok=True)


def L(pts, mat, z, h=0.12, holes=(), name='l'):
    return pc.layer(pts, mat, h=h, z=z, holes=holes, name=name, bevel=0.015)


def R(x0, y0, x1, y1, r=0.0):
    return pc.xf(pc.rrect(x1 - x0, y1 - y0, r), (x0 + x1) / 2, (y0 + y1) / 2)


def E(rx, ry, x, y, n=40, rot=0.0):
    return pc.xf(pc.ellipse_pts(rx, ry, n), x, y, rot)


def place(build, x, y, z, s=1.0, rot=0.0, flip=False):
    """a kit builder (weapon / armour / shield, in its own bone space) set into the room: moved, turned, scaled"""
    tmp = sl.new_coll('_prop')
    build(tmp)
    c, sn = math.cos(rot), math.sin(rot)
    for o in list(tmp.objects):
        ox = -o.location.x if flip else o.location.x
        oy = o.location.y
        if flip:
            o.scale.x *= -1
            o.rotation_euler.z = -o.rotation_euler.z
        o.location = (x + (ox * c - oy * sn) * s, y + (ox * sn + oy * c) * s, z * pc.ZK + o.location.z * s)
        o.rotation_euler.z += rot
        o.scale = (o.scale.x * s, o.scale.y * s, o.scale.z * s)
        tmp.objects.unlink(o)
        bpy.context.scene.collection.objects.link(o)
    for ch in list(bpy.data.collections):
        if ch.name.startswith(('_prop', '_trash')):
            sl.clear_coll(ch)
            bpy.data.collections.remove(ch)


def paper(name, col, fiber='washi', scale=0.15):
    return sl.tex_paper(name, col, fiber, 0.9, scale=scale)


def board(name, col, kind='brown', scale=0.2, rot=0.0):
    return sl.tex_board(name, kind, tint=col, scale=scale, rot=rot)


def glow(name, col, k):
    return pc.glow_mat(name, col, k)


def begin(world, world_k, sun_k):
    sc = sl.setup(samples=SAMPLES, world=world, world_strength=world_k, sun_strength=sun_k)
    sc.render.film_transparent = False
    sc.render.resolution_x, sc.render.resolution_y = W, H
    sc.render.image_settings.file_format = 'JPEG'
    sc.render.image_settings.color_mode = 'RGB'
    sc.render.image_settings.quality = 90
    return sc, random.Random(35)


def shoot(sc, name, fstop=0.3):
    fz = FOCUS * pc.ZK + 0.2
    cam = sc.camera
    cam.data.type = 'PERSP'
    cam.data.lens = 50
    cam.data.sensor_width = 36
    cam.data.sensor_fit = 'HORIZONTAL'
    dist = 50.5 * 50 / 36
    cam.location = (0, 4.7, fz + dist)
    cam.rotation_euler = (0, 0, 0)
    cam.data.dof.use_dof = True
    cam.data.dof.focus_distance = dist
    cam.data.dof.aperture_fstop = fstop
    cam.data.clip_end = 1000
    for ch in sc.collection.children:
        ch.hide_render = False
    out = os.path.join(OUT, f'shop_{name}.jpg')
    sc.render.filepath = out
    bpy.ops.render.render(write_still=True)
    print('INTERIOR', out, flush=True)


# ------------------------------------------------------------------ shared pieces
def bricks(rnd, y0, y1, cols, z=0.15, w=2.2, h=0.8):
    mats = [board('brick%d' % i, c, scale=0.25) for i, c in enumerate(cols)]
    row = 0
    y = y0
    while y < y1:
        off = (row % 2) * w / 2
        x = X0 - off
        while x < X1:
            L(R(x + 0.06, y + 0.06, x + w - 0.06, y + h - 0.06, 0.08), rnd.choice(mats), z + rnd.uniform(0, 0.04), 0.1, name='brick')
            x += w
        y += h
        row += 1


def planks_floor(rnd, cols, z=4.0, y_top=FLOOR_Y, w=2.6, lines='#3d2a20'):
    mats = [board('floor%d' % i, c, scale=0.2, rot=1.5708) for i, c in enumerate(cols)]
    L(R(X0, Y0, X1, y_top), paper('floor_gap', lines), z, 0.08, name='floor_base')
    for i, y in enumerate((y_top - 0.95, y_top - 2.4, y_top - 4.3, y_top - 6.8, y_top - 9.8)):
        yt = y_top - (0 if i == 0 else (0.95, 2.4, 4.3, 6.8)[i - 1]) - 0.05
        x = X0 - rnd.uniform(0, w)
        while x < X1:
            ln = rnd.uniform(w, w * 2.4)
            L(R(x + 0.05, y + 0.04, x + ln - 0.05, yt, 0.04), rnd.choice(mats), z + 0.08, 0.06, name='plank')
            x += ln


def candle(x, y, z, h=1.4, r=0.22, light=60.0):
    wax = paper('wax', '#efe3c4', 'white')
    L(R(x - r, y, x + r, y + h, 0.08), wax, z, 0.1, name='candle')
    L(pc.xf(pc.teardrop_pts(0.16, 0.32), x, y + h + 0.05), wax, z + 0.08, 0.04, name='drip')
    L(pc.xf(pc.teardrop_pts(0.26, 0.6), x, y + h + 0.28), glow('flame', '#ffb347', 12.0), z + 0.12, 0.04, name='flame')
    L(pc.xf(pc.teardrop_pts(0.12, 0.3), x, y + h + 0.22), glow('flame_in', '#fff1b0', 16.0), z + 0.16, 0.03, name='flame_in')
    pc.point('candle', (x, y + h + 0.5, (z + 0.6) * pc.ZK), light, '#ffb35c', 0.3)


def shelf(x0, x1, y, z, mat):
    L(R(x0, y - 0.32, x1, y), mat, z, 0.2, name='shelf')
    for x in (x0 + 0.5, x1 - 0.5):
        L([(x - 0.1, y - 0.32), (x + 0.1, y - 0.32), (x + 0.1, y - 1.0), (x - 0.5, y - 0.32)], mat, z - 0.05, 0.08, name='bracket')


def jar(x, y, z, w, h, glass, liquid, cork, label=None, glow_k=0.0, fill=0.6):
    L(R(x - w / 2, y, x + w / 2, y + h, w * 0.25), glass, z, 0.1, name='jar')
    liq = glow('liq_' + liquid, liquid, glow_k) if glow_k else paper('liq_' + liquid, liquid)
    L(R(x - w / 2 + 0.08, y + 0.08, x + w / 2 - 0.08, y + h * fill, w * 0.2), liq, z + 0.1, 0.04, name='liquid')
    L(R(x - w * 0.22, y + h, x + w * 0.22, y + h + 0.28, 0.06), glass, z, 0.1, name='neck')
    L(R(x - w * 0.18, y + h + 0.22, x + w * 0.18, y + h + 0.5, 0.06), cork, z + 0.12, 0.06, name='cork')
    if label:
        L(R(x - w * 0.32, y + h * 0.25, x + w * 0.32, y + h * 0.5, 0.03), label, z + 0.16, 0.02, name='label')


def clouds(rnd, y0, y1, z, n=8):
    cloud = paper('cloud', '#fbfaf6', 'white')
    for i in range(n):
        cx = X0 + 3 + i * (X1 - X0 - 6) / max(1, n - 1) + rnd.uniform(-1, 1)
        cy = rnd.uniform(y0, y1)
        for j in range(3):
            L(pc.xf(pc.blob_pts(rnd.uniform(1.2, 2.2), rnd.uniform(0.7, 1.1), 0.08, rnd.randint(0, 99)), cx + (j - 1) * 1.3, cy + (0.4 if j == 1 else 0)),
              cloud, z + j * 0.05, 0.08, name='cloud')


# ------------------------------------------------------------------ 1. the forge
def forge():
    sc, rnd = begin('#2a1a16', 0.25, 0.9)
    L(R(X0, FLOOR_Y - 1, X1, Y1), paper('mortar', '#4a2f27'), 0.0, 0.1, name='mortar')
    bricks(rnd, FLOOR_Y - 1, Y1, ['#9c5038', '#8a4632', '#a65e42', '#7c3f2d'])
    soot = paper('soot', '#2b1d1a')
    # the hearth: an arched mouth with coals and flames, a hood and chimney above (centre-left, behind the vendor)
    hx = -8.0
    arch = [(hx - 4.2, FLOOR_Y)] + [(hx + 4.2 * math.cos(math.radians(a)), 3.6 + 3.2 * math.sin(math.radians(a))) for a in range(180, -1, -10)] + [(hx + 4.2, FLOOR_Y)]
    L(arch, paper('hearth_stone', '#6d5a4e'), 0.4, 0.3, name='hearth_rim')
    inner = [(hx - 3.3, FLOOR_Y)] + [(hx + 3.3 * math.cos(math.radians(a)), 3.4 + 2.5 * math.sin(math.radians(a))) for a in range(180, -1, -10)] + [(hx + 3.3, FLOOR_Y)]
    L(inner, soot, 0.75, 0.05, name='hearth_mouth')
    for i in range(14):
        L(pc.xf(pc.blob_pts(rnd.uniform(0.4, 0.8), rnd.uniform(0.25, 0.45), 0.15, i), hx + rnd.uniform(-2.6, 2.6), FLOOR_Y + rnd.uniform(0.2, 1.0)),
          glow('coal%d' % (i % 3), ['#ff5a1f', '#ff8c2a', '#c7301a'][i % 3], 6.0), 0.85 + i * 0.01, 0.06, name='coal')
    for i, (dx, w, h, col) in enumerate(((-1.2, 1.3, 2.4, '#ff6a1f'), (0.6, 1.5, 3.0, '#ff8c2a'), (1.8, 1.0, 1.9, '#ff6a1f'), (0.1, 0.8, 1.6, '#ffd36a'), (-0.6, 0.6, 1.2, '#ffe9a0'))):
        L(pc.xf(pc.teardrop_pts(w, h), hx + dx, FLOOR_Y + 1.2 + h * 0.35), glow('fire%d' % i, col, 10.0), 1.0 + i * 0.04, 0.04, name='fire')
    pc.point('hearth', (hx, FLOOR_Y + 2.5, 2.5 * pc.ZK), 2600, '#ff7a2a', 1.5)
    pc.point('hearth_floor', (hx + 2, FLOOR_Y - 1.0, 5.0 * pc.ZK), 900, '#ff8a3a', 2.0)   # its glow on the flagstones
    L([(hx - 5.6, 7.4), (hx + 5.6, 7.4), (hx + 2.8, 11.5), (hx + 2.8, Y1), (hx - 2.8, Y1), (hx - 2.8, 11.5)], paper('hood', '#5a4740'), 1.2, 0.2, name='hood')
    L(R(hx - 5.9, 7.0, hx + 5.9, 7.6, 0.1), M('iron_d'), 1.45, 0.1, name='hood_rim')
    # a rack of weapons on the right wall: the kit's own swords, axes and spears
    rack = board('rack', '#6e5236', rot=0.0)
    for y in (3.4, 9.6):
        L(R(6.0, y - 0.35, 25.5, y + 0.35, 0.1), rack, 1.0, 0.18, name='rack_bar')
    for i, (fam, t) in enumerate((('sword', 3), ('axe', 4), ('sword', 6), ('spear', 5), ('sword', 8), ('axe', 7), ('sword', 9))):
        build = {'sword': weapons.SWORDS, 'axe': weapons.AXES, 'spear': weapons.SPEARS}[fam][t]
        place(build, 7.6 + i * 2.85, 2.2, 1.3 + i * 0.02, s=1.55 if fam != 'spear' else 1.05, rot=math.pi / 2)
    # tongs and hammers hanging left of the hearth
    for i, x in enumerate((-20.5, -18.8)):
        L(R(x - 0.09, 6.0, x + 0.09, 10.0, 0.05), M('iron_d'), 0.6, 0.05, name='tong')
        L(R(x - 0.5, 9.8, x + 0.5, 10.3, 0.1), M('iron'), 0.65, 0.08, name='hook')
    L(R(X0, -3.2, X1, FLOOR_Y + 0.1), paper('skirting', '#3d2620'), 3.9, 0.1, name='skirting')
    # stone floor
    L(R(X0, Y0, X1, FLOOR_Y - 0.6), paper('flag_gap', '#2e211d'), 4.0, 0.08, name='floor_base')
    stones = [paper('flag%d' % i, c) for i, c in enumerate(('#5e5048', '#54473f', '#665850'))]
    for row, (ya, yb) in enumerate(((-3.2, -5.6), (-5.7, -8.8), (-8.9, -12.5))):
        x = X0 - rnd.uniform(0, 2)
        while x < X1:
            w = rnd.uniform(3.0, 5.0) * (1 + row * 0.25)
            L(sl.torn(R(x + 0.08, yb, x + w - 0.08, ya, 0.2), 0.04, int(x * 7 + row)), rnd.choice(stones), 4.08, 0.06, name='flag')
            x += w
    # standing: a quench barrel left, a whetstone right; foreground: the anvil, blurred
    L(R(-24.5, -6.0, -20.5, -0.5, 0.4), board('barrel', '#6e4b30', rot=1.5708), 5.0, 0.3, name='barrel')
    for y in (-4.8, -1.6):
        L(R(-24.7, y - 0.25, -20.3, y + 0.25, 0.1), M('iron_d'), 5.35, 0.06, name='hoop')
    L(E(1.9, 0.35, -22.5, -0.55), paper('water', '#3f5d6e'), 5.4, 0.04, name='water')
    anvil = M('iron_d')
    ax, ay = 15.5, -9.0
    L([(ax - 4.6, ay + 3.0), (ax + 3.0, ay + 3.0), (ax + 3.4, ay + 3.6), (ax - 3.2, ay + 3.6), (ax - 5.6, ay + 3.3)], M('iron'), 10.2, 0.25, name='anvil_top')
    L([(ax - 2.2, ay + 3.0), (ax + 1.8, ay + 3.0), (ax + 1.2, ay + 1.4), (ax + 2.4, ay - 1.5), (ax - 2.8, ay - 1.5), (ax - 1.6, ay + 1.4)], anvil, 10.0, 0.25, name='anvil')
    L(R(ax - 3.5, ay - 3.5, ax + 3.1, ay - 1.4, 0.2), board('stump', '#5e4530'), 9.8, 0.3, name='stump')
    shoot(sc, 'forge')


# ------------------------------------------------------------------ 2. the armoury
def armoury():
    sc, rnd = begin('#f0e4d0', 0.45, 2.2)
    L(R(X0, FLOOR_Y - 1, X1, Y1), paper('plaster', '#cdb89a', 'water', 0.1), 0.0, 0.1, name='plaster')
    for i in range(30):   # patches where the plaster has worn
        L(pc.xf(pc.blob_pts(rnd.uniform(0.6, 1.6), rnd.uniform(0.3, 0.8), 0.15, i), rnd.uniform(X0, X1), rnd.uniform(FLOOR_Y, Y1)), paper('plaster_lo', '#bda685', 'water', 0.1), 0.12, 0.03, name='patch')
    beam = board('beam', '#6e5236', rot=1.5708)
    beam_h = board('beam_h', '#6e5236')
    for x in (-21.0, -4.0, 13.0):
        L(R(x - 0.6, FLOOR_Y - 1, x + 0.6, Y1), beam, 0.3, 0.25, name='post')
    L(R(X0, 15.8, X1, 17.0), beam_h, 0.55, 0.25, name='beam')
    # a barred window high in the middle bay, daylight falling in
    L(R(1.5, 9.0, 9.5, 14.6, 0.2), paper('sky_win', '#a9cdec', 'water'), 0.2, 0.05, name='window')
    for x in (3.5, 5.5, 7.5):
        L(R(x - 0.12, 9.0, x + 0.12, 14.6), M('iron_d'), 0.3, 0.06, name='bar')
    L(R(1.2, 8.6, 9.8, 9.1, 0.05), paper('sill', '#b39b7a'), 0.32, 0.08, name='sill')
    pc.area('daylight', (5.5, 11.0, 6.0), (0, 0, 0), 900, 8.0, '#fff4e0')
    # helmets on the shelves of the left and right bays
    plank = board('shelf', '#7d5e3e')
    for y, tiers in ((12.4, (2, 4, 6)), (7.6, (5, 7, 3))):
        shelf(-19.8, -5.2, y, 0.5, plank)
        for i, t in enumerate(tiers):
            place(getattr(armor, f'helmet{t}'), -17.0 + i * 4.6, y - 0.95, 0.7 + i * 0.02, s=1.05)   # helmets are built round the head: rest the rim on the shelf
    shelf(14.2, 27.0, 12.4, 0.5, plank)
    for i, t in enumerate((8, 9)):
        place(getattr(armor, f'helmet{t}'), 17.0 + i * 5.0, 12.4 - 0.95, 0.7, s=1.05)
    # shields hung on the right bay
    for i, (t, x, y) in enumerate(((3, 16.0, 6.8), (6, 20.6, 6.2), (10, 25.2, 6.6))):
        place(shields.SHIELDS[t], x, y, 0.8 + i * 0.03, s=0.9)
    # armour on stands (torso + skirt) on the floor, the middle one in focus
    post = board('stand', '#5e4530', rot=1.5708)
    for i, (t, x, z) in enumerate(((4, -12.5, 5.0), (8, 2.0, 5.6), (6, 21.0, 5.2))):
        L(R(x - 0.18, -6.0, x + 0.18, 3.8), post, z - 0.3, 0.12, name='stand')
        L(R(x - 1.6, -6.3, x + 1.6, -5.7, 0.1), post, z - 0.25, 0.12, name='stand_foot')
        L(R(x - 1.9, 3.5, x + 1.9, 3.9, 0.1), post, z - 0.25, 0.12, name='stand_arms')
        place(getattr(armor, f'armor{t}_torso'), x, 0.0, z, s=1.15)
        if hasattr(armor, f'armor{t}_skirt'):
            place(getattr(armor, f'armor{t}_skirt'), x, 0.45, z + 0.4, s=1.15)
    planks_floor(rnd, ['#8a6a48', '#7d5e3e', '#94744f'])
    # foreground: an open crate of greaves, blurred
    L(R(-27.0, -12.5, -16.5, -6.5, 0.2), board('crate', '#8a6a48'), 10.0, 0.3, name='crate')
    for y in (-11.0, -8.0):
        L(R(-27.0, y - 0.3, -16.5, y + 0.3), board('crate_d', '#6e5236'), 10.32, 0.06, name='slat')
    shoot(sc, 'armoury')


# ------------------------------------------------------------------ 3. the enchantress's workshop
def enchanter():
    sc, rnd = begin('#2a2545', 0.45, 0.5)
    pc.area('room_glow', (0.0, 8.0, 12.0), (0, 0, 0), 1800, 30.0, '#b9a8e8')   # soft violet fill: dark, but readable
    L(R(X0, FLOOR_Y - 1, X1, Y1), pc.pattern_mat('indigo', 'polka', '#2e2645', '#383058', freq=1.2, ratio=0.18, grit=0.4), 0.0, 0.1, name='wall')
    # a round window with the moon, top middle
    win = E(4.6, 4.6, 3.0, 13.0, 64)
    L(E(5.2, 5.2, 3.0, 13.0, 64), paper('win_rim', '#4c3d6b'), 0.25, 0.2, holes=[list(reversed(win))], name='win_rim')
    L(win, paper('night', '#22305a', 'water'), 0.1, 0.05, name='night')
    L(E(1.4, 1.4, 4.6, 14.2), glow('moon', '#f6efc8', 1.1), 0.15, 0.04, name='moon')
    for i in range(12):
        L(E(0.06, 0.06, 3.0 + rnd.uniform(-3.8, 3.8), 13.0 + rnd.uniform(-3.8, 3.8), 8), glow('star', '#fff6d0', 3.0), 0.14, 0.02, name='star')
    for k in (-1, 1):
        L(R(3.0 + k * 2.4 - 0.08, 8.4, 3.0 + k * 2.4 + 0.08, 17.6), paper('mullion', '#4c3d6b'), 0.3, 0.05, name='mullion')
    # shelves of jars, left and right
    wood = board('dark_wood', '#4a3426')
    glass = paper('glass', '#cfe3e0', 'white')
    cork = board('cork', '#a07a50', 'craft')
    lab = paper('label', '#efe3c4', 'white')
    cols = ['#7a2a6e', '#2a6e7a', '#c8a02a', '#b8401f', '#3f8a4a', '#5b2c83']
    for y in (14.0, 9.4, 4.8):
        for x0, x1 in ((-26.5, -11.5), (12.5, 27.5)):
            shelf(x0, x1, y, 0.6, wood)
            left = x0 < 0
            x = x0 + (0.9 if left else 1.6)            # room for a candle at the inner end of each shelf
            while x < x1 - (1.7 if left else 1.0):
                w, h = rnd.uniform(0.8, 1.3), rnd.uniform(1.2, 2.4)
                jar(x + w / 2, y, 0.75 + rnd.uniform(0, 0.1), w, h, glass, rnd.choice(cols), cork, lab if rnd.random() < 0.6 else None,
                    glow_k=1.2 if rnd.random() < 0.35 else 0.0)
                x += w + rnd.uniform(0.25, 0.7)
    # dried herbs hanging from a beam at the top
    L(R(X0, 19.4, X1, 20.4), wood, 1.5, 0.2, name='herb_beam')
    herb = [paper('herb%d' % i, c) for i, c in enumerate(('#6f8a3a', '#8a7a3a', '#5a6e3a'))]
    for i in range(16):
        x = X0 + 2 + i * 3.6 + rnd.uniform(-0.5, 0.5)
        ln = rnd.uniform(0.9, 1.6)
        L(R(x - 0.04, 18.8, x + 0.04, 19.4), paper('twine', '#c9b48a'), 1.6, 0.02, name='twine')
        for j in range(5):
            L(pc.xf(pc.teardrop_pts(0.5, ln), x + (j - 2) * 0.18, 18.9 - ln * 0.5, math.pi + (j - 2) * 0.12), herb[j % 3], 1.7 + j * 0.02, 0.03, name='herb')
    # floating paper glyphs
    gold = glow('glyph', '#f2c860', 2.0)   # glowing paper runes: no hard shadows on the wall
    for i in range(10):
        x, y = rnd.uniform(-10, 12), rnd.uniform(2, 8)
        kind = i % 3
        pts = E(0.35, 0.35, x, y, 3, rnd.uniform(0, 3)) if kind == 0 else E(0.3, 0.3, x, y, 5, rnd.uniform(0, 3)) if kind == 1 else E(0.32, 0.32, x, y, 24)
        L(pts, gold, 0.9 + i * 0.03, 0.03, name='glyph')
    # candles on the shelves' ends and the counter
    for x, y in ((-12.2, 9.4), (13.2, 4.8), (-12.2, 14.0)):
        candle(x, y, 0.9, 1.0, 0.18, 25.0)
    planks_floor(rnd, ['#3d2a20', '#4a3426', '#35251c'])
    # the counter front, with an open book, ink pots and a quill
    L(R(-6.0, -9.5, 22.0, -1.0, 0.2), board('counter', '#5e4530'), 6.0, 0.3, name='counter')
    L(R(-6.4, -1.3, 22.4, -0.4, 0.15), board('counter_top', '#7d5e3e'), 6.35, 0.15, name='counter_top')
    for i in range(5):
        L(R(-4.0 + i * 5.5, -8.0, -1.0 + i * 5.5, -3.0, 0.2), board('panel', '#4a3426'), 6.32, 0.04, name='panel')
    L([(4.0, -0.4), (6.8, -0.1), (6.8, 0.4), (4.0, 0.1)], paper('page_l', '#f2ead8', 'white'), 6.5, 0.04, name='page')
    L([(6.8, -0.1), (9.6, -0.4), (9.6, 0.1), (6.8, 0.4)], paper('page_r', '#ebe1cb', 'white'), 6.52, 0.04, name='page')
    ink = paper('ink', '#1b1620', None)
    for x in (12.0, 13.6):
        L(R(x - 0.5, -0.4, x + 0.5, 0.6, 0.2), ink, 6.5, 0.1, name='inkpot')
    L(pc.xf(pc.teardrop_pts(0.4, 3.0), 13.2, 1.6, -0.35), paper('quill', '#f4efe6', 'white'), 6.6, 0.03, name='quill')
    candle(19.5, -0.4, 6.5, 1.6, 0.25, 50.0)
    shoot(sc, 'enchanter')


# ------------------------------------------------------------------ 4. the Glue Temple
def temple():
    sc, rnd = begin('#f3e6d6', 0.5, 1.6)
    L(R(X0, FLOOR_Y - 1, X1, Y1), paper('temple_wall', '#e6d3b3', 'water', 0.1), 0.0, 0.1, name='wall')
    # an apse with a stained window behind the altar
    ap = [(-6.0, FLOOR_Y)] + [(6.0 * math.cos(math.radians(a)), 9.0 + 6.0 * math.sin(math.radians(a))) for a in range(180, -1, -10)] + [(6.0, FLOOR_Y)]
    L(ap, paper('apse', '#d4bd98', 'water', 0.1), 0.2, 0.08, name='apse')
    wa = [(-2.6, 7.0)] + [(2.6 * math.cos(math.radians(a)), 11.4 + 2.6 * math.sin(math.radians(a))) for a in range(180, -1, -10)] + [(2.6, 7.0)]
    L(wa, paper('lead', '#3d2f2a'), 0.3, 0.05, name='lead')
    panes = ['#d9a441', '#4f86b8', '#b8403a', '#e8d18a', '#5f9a5a']
    for i in range(5):
        for j in range(3):
            x0, y0 = -2.4 + i * 0.96, 7.2 + j * 1.5
            if x0 * x0 + max(0, y0 + 1.5 - 11.4) ** 2 > 6.2:
                continue
            L(R(x0 + 0.06, y0 + 0.06, x0 + 0.9, y0 + 1.44, 0.04), glow('pane%d' % ((i + j) % 5), panes[(i + j) % 5], 1.8), 0.36, 0.03, name='pane')
    L(E(1.0, 1.0, 0.0, 12.8, 40), glow('rose', '#f2d27a', 2.2), 0.4, 0.03, name='rose')
    pc.area('window_light', (0.0, 10.0, 4.0), (0, 0, 0), 700, 5.0, '#fff0d0')
    # columns either side, fluted, with a capital and a base
    col = paper('column', '#efe2c8', 'water', 0.1)
    col_d = paper('column_d', '#d9c6a2', 'water', 0.1)
    for x in (-15.0, 15.0, -25.5, 25.5):
        z = 1.0 if abs(x) < 20 else 0.6
        L(R(x - 1.6, FLOOR_Y - 1, x + 1.6, 17.0), col, z, 0.3, name='shaft')
        for k in range(-2, 3):
            L(R(x + k * 0.58 - 0.08, FLOOR_Y, x + k * 0.58 + 0.08, 16.6), col_d, z + 0.3, 0.03, name='flute')
        L(R(x - 2.3, 16.8, x + 2.3, 18.2, 0.2), col_d, z + 0.35, 0.15, name='capital')
        L(R(x - 2.1, FLOOR_Y - 1, x + 2.1, FLOOR_Y + 0.4, 0.1), col_d, z + 0.35, 0.15, name='base')
    L(R(X0, 18.2, X1, 20.0), col_d, 1.4, 0.2, name='architrave')
    # banners with the drop of Glue
    ban = paper('banner', '#7e1d17')
    drop = paper('glue_drop', '#f4efe6', 'white')
    for x in (-20.3, 20.3):
        L([(x - 1.5, 16.0), (x + 1.5, 16.0), (x + 1.5, 8.0), (x, 7.0), (x - 1.5, 8.0)], ban, 0.6, 0.06, name='banner')
        L(pc.xf(pc.teardrop_pts(1.2, 1.9), x, 11.2), drop, 0.7, 0.05, name='drop')
    # the altar with the great glue pot, glue running down its side
    stone = paper('altar', '#cdb894', 'water', 0.1)
    L(R(-5.5, -5.5, 5.5, 0.6, 0.15), stone, 5.0, 0.3, name='altar')
    L(R(-6.0, 0.4, 6.0, 1.2, 0.15), col_d, 5.3, 0.15, name='altar_top')
    pot = board('pot', '#8a6a48', 'craft')
    L([(-2.2, 1.2), (2.2, 1.2), (2.8, 3.4), (2.2, 5.4), (-2.2, 5.4), (-2.8, 3.4)], pot, 5.6, 0.3, name='pot')
    L(R(-2.5, 5.2, 2.5, 5.9, 0.2), board('pot_rim', '#6e5236', 'craft'), 5.9, 0.15, name='pot_rim')
    glue = pc.paper_mat('glue', '#f6f2e6', rough=0.25, sss=0.3)
    L(E(2.2, 0.35, 0.0, 5.95), glue, 6.0, 0.05, name='glue_top')
    for x, ln in ((-1.4, 1.6), (0.3, 2.6), (1.6, 1.1)):
        L(R(x - 0.2, 5.9 - ln, x + 0.2, 6.0, 0.18), glue, 6.0, 0.06, name='glue_run')
        L(E(0.3, 0.32, x, 5.9 - ln), glue, 6.02, 0.06, name='glue_bead')
    L(R(-6.0, 1.15, 6.0, 1.4), glue, 5.45, 0.03, name='glue_cloth')
    for x in (-4.6, 4.6):
        candle(x, 1.2, 5.6, 1.8, 0.28, 60.0)
    for x in (-11.0, -9.6, 9.6, 11.0, 12.4):
        candle(x, FLOOR_Y + 0.2, 3.5, rnd.uniform(1.0, 2.2), 0.22, 25.0)
    # floor: worn cream and terracotta tiles
    L(R(X0, Y0, X1, FLOOR_Y), paper('grout', '#8f7a5e'), 4.0, 0.08, name='grout')
    tiles = [paper('tile_a', '#e3cfae', 'water', 0.1), paper('tile_b', '#b9714f', 'water', 0.1)]
    for row, (ya, yb) in enumerate(((FLOOR_Y, -4.6), (-4.7, -7.4), (-7.5, -12.5))):
        x, k = X0, row
        while x < X1:
            w = 2.4 + row * 0.9
            L(R(x + 0.06, yb, x + w - 0.06, ya - 0.06, 0.05), tiles[k % 2], 4.08, 0.05, name='tile')
            x += w
            k += 1
    # foreground: the end of a pew, blurred
    L(R(-27.5, -12.5, -18.0, -7.0, 0.3), board('pew', '#6e5236'), 10.0, 0.3, name='pew')
    L(R(-27.5, -7.5, -17.5, -6.5, 0.2), board('pew_top', '#5e4530'), 10.3, 0.15, name='pew_top')
    shoot(sc, 'temple')


# ------------------------------------------------------------------ 5. the training yard
def training():
    sc, rnd = begin('#eef3f8', 0.6, 3.0)
    L(R(X0, 4.0, X1, Y1), paper('sky', '#7db3e2', 'water', 0.08), 0.0, 0.1, name='sky')
    L(R(X0, 4.0, X1, 11.0), paper('sky_lo', '#a9cdec', 'water', 0.08), 0.12, 0.06, name='sky_band')
    clouds(rnd, 15.5, 19.5, 0.3)
    # the arena in the distance, over the palisade
    stone = paper('far_stone', '#e7cfae', 'washi', 0.12)
    arches = []
    for i in range(9):
        ax = -14.0 + i * 3.4
        pts = [(ax - 1.0, 8.6), (ax + 1.0, 8.6)] + [(ax + 1.0 * math.cos(math.radians(a)), 10.6 + 1.0 * math.sin(math.radians(a))) for a in range(0, 181, 15)]
        arches.append(list(reversed(pts)))
    L(R(-15.8, 5.0, 15.8, 12.6), stone, 0.8, 0.12, holes=arches, name='far_arena')
    L(R(-15.8, 12.4, 15.8, 13.2), paper('far_cornice', '#d6b994'), 0.95, 0.08, name='far_cornice')
    for x in (-12.0, -3.0, 6.0, 13.0):
        L([(x, 13.2), (x, 15.6), (x + 1.6, 15.1), (x, 14.6)], paper('pennant', '#a7281f'), 0.95, 0.04, name='pennant')
    # a palisade of pointed stakes across the yard, a gate post here and there
    stake = [board('stake%d' % i, c, rot=1.5708) for i, c in enumerate(('#8a6a48', '#7d5e3e', '#94744f'))]
    x = X0
    while x < X1:
        w = rnd.uniform(0.9, 1.2)
        top = 7.6 + rnd.uniform(-0.4, 0.4)
        L([(x + 0.04, FLOOR_Y - 1), (x + w - 0.04, FLOOR_Y - 1), (x + w - 0.04, top), (x + w / 2, top + 0.8), (x + 0.04, top)], rnd.choice(stake), 2.0 + rnd.uniform(0, 0.05), 0.15, name='stake')
        x += w
    L(R(X0, 1.8, X1, 2.4), board('rail', '#5e4530'), 2.25, 0.1, name='rail')
    # sand
    sand = sl.tex_board('sand', 'craft', tint='#f0c987', tint_k=1.0, scale=0.06, nrm=0.5)
    L(R(X0, Y0, X1, FLOOR_Y), sand, 4.0, 0.12, name='sand')
    sand_lo = sl.tex_board('sand_lo', 'craft', tint='#ebc07f', scale=0.06, nrm=0.5)
    for i, y in enumerate((-3.6, -6.0, -9.5)):
        pts = pc.wave_pts(X1 - X0 + 2, 0.12, 0.3 + i * 0.1, i * 1.3, y, 160)
        L(pts + [(x_, y - 0.22 - 0.1 * i) for x_, _ in reversed(pts)], sand_lo, 4.14 + i * 0.01, 0.03, name='ripple')
    # straw dummies on posts: a stuffed sack body, a cross-bar for arms, a sack head with a painted face
    straw = board('straw', '#d9b46a', 'craft', 0.15)
    sack = board('sack', '#c2a073', 'craft', 0.2)
    rope = paper('rope', '#8a6a48')
    for i, (x, z, lean) in enumerate(((-11.0, 5.2, 0.05), (8.5, 5.6, -0.06), (19.5, 5.0, 0.03))):
        L(R(x - 0.22, -6.5, x + 0.22, 2.0), board('post', '#6e5236', rot=1.5708), z - 0.3, 0.15, name='post')
        L(R(x - 2.6, 3.8, x + 2.6, 4.3, 0.1), board('xbar', '#6e5236'), z - 0.25, 0.12, name='xbar')
        L(pc.xf(pc.blob_pts(1.6, 2.6, 0.06, 40 + i), x, 2.5, lean), straw, z, 0.3, name='dummy')
        for y in (1.2, 3.6):
            L(R(x - 1.65, y - 0.12, x + 1.65, y + 0.12, 0.05), rope, z + 0.3, 0.04, name='band')
        L(E(1.0, 1.1, x + 0.1, 6.0), sack, z + 0.05, 0.25, name='head')
        L(R(x - 0.2, 6.9, x + 0.4, 7.4, 0.1), rope, z + 0.3, 0.05, name='tie')
        L(R(x + 0.1, 5.5, x + 0.9, 5.65, 0.04), paper('paint', '#7e1d17'), z + 0.32, 0.02, name='mouth')
        L(E(0.12, 0.12, x + 0.55, 6.25, 12), paper('paint_d', '#2a1a16'), z + 0.32, 0.02, name='eye')
        for k in range(5):   # straw sticking out
            L(R(x - 1.4 + k * 0.6, -0.3, x - 1.3 + k * 0.6, 0.4, 0.02, ), straw, z + 0.31, 0.02, name='tuft')
    # a rack of wooden practice swords and a spear, left
    L(R(-25.5, -4.0, -17.5, -3.4, 0.1), board('rack', '#5e4530'), 4.8, 0.15, name='rack_foot')
    L(R(-25.5, 2.4, -17.5, 3.0, 0.1), board('rack', '#5e4530'), 5.3, 0.15, name='rack_top')
    for i in range(4):
        place(weapons.SWORDS[1], -24.4 + i * 1.9, -2.8, 5.0 + i * 0.02, s=1.1, rot=math.pi / 2)
    place(weapons.SPEARS[2], -16.6, -3.4, 5.1, s=0.8, rot=math.pi / 2 - 0.12)
    # foreground: a water barrel and a bucket, blurred
    L(R(14.5, -13.0, 21.0, -5.5, 0.5), board('fg_barrel', '#6e4b30', rot=1.5708), 10.0, 0.3, name='barrel')
    for y in (-11.5, -7.2):
        L(R(14.3, y - 0.3, 21.2, y + 0.3, 0.1), M('iron_d'), 10.35, 0.06, name='hoop')
    shoot(sc, 'training', fstop=0.28)


ROOMS = {'forge': forge, 'armoury': armoury, 'enchanter': enchanter, 'temple': temple, 'training': training}
if len(ONLY) == 1:
    ROOMS[ONLY[0]]()
else:
    # every room in a fresh Blender: sl.setup() clears the scene, and cached materials would point at removed data
    import subprocess
    for name in ONLY or ROOMS:
        subprocess.check_call([bpy.app.binary_path, '-b', '--disable-autoexec', '--python', os.path.abspath(__file__), '--', str(SAMPLES), name])
print('INTERIORS done')
