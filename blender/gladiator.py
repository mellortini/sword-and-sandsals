"""Paper gladiator puppet: builds every body part as its own paper cut-out, renders each one (transparent PNG + pivot),
writes rig.json, then assembles the whole puppet in a test pose with true Cycles shadows (assembly.png) as the
reference for the in-game compositor.

Run (headless):
  python -I tools/blender.py blender/gladiator.py -- <out_dir> [samples] [parts|assembly|all]
"""
import bpy, sys, os, math, json
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import sprite_lib as sl  # noqa: E402
pc = sl.pc

argv = sys.argv[sys.argv.index('--') + 1:] if '--' in sys.argv else []
OUT = os.path.abspath(argv[0] if argv else os.path.join(sl.GAME, 'assets', 'chars', 'hero'))
SAMPLES = int(argv[1]) if len(argv) > 1 else 64
MODE = argv[2] if len(argv) > 2 else 'all'
os.makedirs(os.path.join(OUT, 'parts'), exist_ok=True)

# ------------------------------------------------------------------ palette (hero)
C = dict(skin='#e8a77c', skin_hi='#edaf86', skin_lo='#d8956c', skin_back='#c98b66', blush='#e2806a',
         hair='#4a2c20', eye='#f4efe6', pupil='#2a1a16', lid='#d48c66', nose='#ea9b74', mouth='#6a2a22',
         cloth='#b5302a', cloth_lo='#8e2420', wrap='#ebe2cf', bronze='#c8955a', steel='#c9ccd2', gold='#e2b64a')

sc = sl.setup(samples=SAMPLES)
HEAD_S = 1.12


def M_skin(c):
    return sl.tex_paper('skin_' + c, c, fiber='water', fiber_k=0.8, tooth=0.5, fibre_nrm=0.25)


def M_paper(c, fiber='washi', k=0.9):
    return sl.tex_paper('p_' + c, c, fiber=fiber, fiber_k=k)


def L(coll, pts, mat, z, h=0.1, name='l', holes=()):
    return pc.layer(pts, mat, h=h, z=z, holes=holes, coll=coll, name=name, bevel=0.01)


def E(rx, ry, x, y, n=48, rot=0.0):
    return pc.xf(pc.ellipse_pts(rx, ry, n), x, y, rot)


def R(w, h, r, x, y, rot=0.0):
    return pc.xf(pc.rrect(w, h, r), x, y, rot)


PARTS = {}      # name -> collection


def part(name):
    def deco(fn):
        PARTS[name] = fn
        return fn
    return deco


# ------------------------------------------------------------------ parts (built at the origin = pivot)
@part('pelvis')
def build_pelvis(c, back=False):
    cloth = M_paper(C['cloth'])
    L(c, [(-1.12, 0.06), (1.12, 0.06), (1.08, -0.72), (0.58, -0.95), (0.5, -1.72), (-0.36, -1.72), (-0.46, -0.95), (-1.08, -0.72)], cloth, 0.0, 0.12, 'cloth')
    L(c, [(0.5, -1.45), (0.5, -1.72), (-0.36, -1.72), (-0.36, -1.45)], M_paper(C['cloth_lo']), 0.12, 0.05, 'hem')
    L(c, [(-1.08, -0.62), (-0.46, -0.85), (-0.46, -0.95), (-1.08, -0.72)], M_paper(C['cloth_lo']), 0.12, 0.05, 'hem2')
    belt = sl.tex_board('belt', 'kraft', scale=0.35)
    L(c, R(2.42, 0.42, 0.12, 0, -0.06), belt, 0.12, 0.1, 'belt')
    g = sl.foil('gold', C['gold'], metal=0.65, rough=0.3, emit=0.3)
    L(c, R(0.5, 0.5, 0.1, 0.3, -0.06), g, 0.22, 0.08, 'buckle')
    for x in (-0.85, -0.45, 0.85):
        L(c, E(0.07, 0.07, x, -0.06, 16), g, 0.22, 0.05, 'stud')


@part('torso')
def build_torso(c, back=False):
    skin = M_skin(C['skin'])
    L(c, R(0.82, 0.95, 0.3, 0.12, 3.2), M_skin(C['skin_lo']), 0.0, 0.1, 'neck')
    side = [(1.0, 0.0), (1.08, 0.8), (1.38, 1.7), (1.62, 2.3)]
    side += [(1.22 + 0.48 * math.cos(math.radians(a)), 2.62 + 0.48 * math.sin(math.radians(a))) for a in range(-35, 91, 12)]
    side += [(0.55, 3.1)]
    pts = side + [(-x + 0.0, y) for x, y in reversed(side)]
    pts = [(x * (1.04 if x > 0 else 1.0), y) for x, y in pts]
    L(c, pts, skin, 0.1, 0.12, 'torso')
    hi = M_skin(C['skin_hi'])
    L(c, pc.xf(pc.blob_pts(0.74, 0.48, 0.05, 2), -0.6, 2.18), hi, 0.22, 0.07, 'pec_l')
    L(c, pc.xf(pc.blob_pts(0.8, 0.5, 0.05, 5), 0.74, 2.18), hi, 0.3, 0.07, 'pec_r')
    lo = M_skin(C['skin_lo'])
    for row, y in enumerate((1.42, 0.98, 0.55)):
        for x in (-0.24, 0.42):
            L(c, R(0.52, 0.36, 0.14, x, y), lo, 0.22, 0.06, 'ab')


def _limb(c, length, prof, mat, z=0.0, h=0.12, name='limb'):
    return L(c, sl.limb_pts(length, prof), mat, z, h, name)


@part('arm_up')
def build_arm_up(c, back=False):
    s = M_skin(C['skin_back'] if back else C['skin'])
    _limb(c, 1.9, [(0, 0.5, 0.5), (0.35, 0.5, 0.56), (0.8, 0.36, 0.38), (1, 0.32, 0.32)], s)
    hi = M_skin(C['skin'] if back else C['skin_hi'])
    L(c, E(0.5, 0.42, 0.02, -0.12), hi, 0.12, 0.07, 'delt')
    L(c, E(0.3, 0.42, 0.14, -0.88), hi, 0.12, 0.06, 'bicep')


@part('arm_lo')
def build_arm_lo(c, back=False):
    s = M_skin(C['skin_back'] if back else C['skin'])
    _limb(c, 1.65, [(0, 0.32, 0.33), (0.25, 0.38, 0.37), (0.75, 0.27, 0.27), (1, 0.25, 0.25)], s)
    w = M_paper('#d9cfbb' if back else C['wrap'], 'washi', 1.0)
    L(c, R(0.66, 0.78, 0.08, 0.0, -1.2), w, 0.12, 0.06, 'wrap')
    wl = M_paper('#c9bea8' if back else '#d8ccb4', 'washi', 1.0)
    for y in (-0.98, -1.2, -1.42):
        L(c, R(0.7, 0.06, 0.03, 0.0, y, 0.35), wl, 0.18, 0.03, 'wrapline')


@part('hand')
def build_hand(c, back=False):
    s = M_skin(C['skin_back'] if back else C['skin'])
    hi = M_skin(C['skin'] if back else C['skin_hi'])
    L(c, R(0.62, 0.7, 0.22, 0.04, -0.36), s, 0.0, 0.12, 'fist')
    for i, y in enumerate((-0.16, -0.36, -0.56)):
        L(c, R(0.3, 0.2, 0.09, 0.27, y), hi, 0.12, 0.06, 'finger')
    L(c, R(0.22, 0.44, 0.1, -0.1, -0.3, -0.5), hi, 0.12, 0.06, 'thumb')


@part('leg_up')
def build_leg_up(c, back=False):
    s = M_skin(C['skin_back'] if back else C['skin'])
    _limb(c, 2.15, [(0, 0.55, 0.55), (0.3, 0.58, 0.6), (0.85, 0.42, 0.42), (1, 0.4, 0.4)], s)
    hi = M_skin(C['skin'] if back else C['skin_hi'])


@part('leg_lo')
def build_leg_lo(c, back=False):
    s = M_skin(C['skin_back'] if back else C['skin'])
    _limb(c, 2.05, [(0, 0.38, 0.38), (0.3, 0.5, 0.36), (0.8, 0.28, 0.28), (1, 0.27, 0.27)], s)
    hi = M_skin(C['skin'] if back else C['skin_hi'])
    L(c, E(0.22, 0.2, 0.06, -0.08), hi, 0.12, 0.05, 'knee')
    strap = sl.tex_board('strap', 'brown', scale=0.4)
    for i, y in enumerate((-1.35, -1.62, -1.88)):
        L(c, R(0.7, 0.13, 0.05, 0.0, y, 0.35 if i % 2 else -0.35), strap, 0.12, 0.05, 'strap')


@part('foot')
def build_foot(c, back=False):
    s = M_skin(C['skin_back'] if back else C['skin'])
    L(c, [(-0.28, 0.12), (-0.4, -0.05), (-0.38, -0.33), (1.02, -0.33), (1.12, -0.18), (0.95, -0.06), (0.38, 0.06), (0.22, 0.16)], s, 0.0, 0.12, 'foot')
    sole = sl.tex_board('sole', 'kraft', scale=0.4)
    L(c, R(1.62, 0.15, 0.06, 0.36, -0.38), sole, 0.12, 0.06, 'sole')
    strap = sl.tex_board('strap', 'brown', scale=0.4)
    L(c, R(0.16, 0.5, 0.05, 0.5, -0.12, -0.3), strap, 0.12, 0.05, 'strapf')
    L(c, R(0.6, 0.13, 0.05, -0.02, 0.0, 0.1), strap, 0.12, 0.05, 'straph')


@part('head')
def build_head(c, back=False):
    skin = M_skin(C['skin'])
    lo = M_skin(C['skin_lo'])
    L(c, E(0.27, 0.36, -0.86, 1.05), lo, 0.0, 0.1, 'ear')
    L(c, E(0.12, 0.18, -0.88, 1.05), M_skin(C['lid']), 0.1, 0.03, 'ear_in')
    L(c, R(2.0, 2.25, 0.78, 0.12, 1.15), skin, 0.1, 0.12, 'head')
    L(c, R(1.55, 0.78, 0.36, 0.2, 0.46), M_skin('#c98a64'), 0.22, 0.04, 'stubble')
    hair = M_paper(C['hair'], 'washi', 1.0)
    cap = [(0.1 + 1.14 * math.cos(math.radians(a)), 1.72 + 0.86 * math.sin(math.radians(a))) for a in range(200, -11, -6)]
    fringe = [(1.0, 1.94), (0.78, 1.84), (0.52, 1.99), (0.24, 1.88), (-0.06, 2.0), (-0.38, 1.88), (-0.62, 1.72), (-0.72, 1.3), (-0.98, 1.22)]
    L(c, cap + fringe, hair, 0.22, 0.1, 'hair')
    L(c, R(0.55, 0.16, 0.07, -0.06, 1.66, 0.12), hair, 0.35, 0.05, 'brow_l')
    L(c, R(0.44, 0.15, 0.07, 0.74, 1.68, -0.1), hair, 0.35, 0.05, 'brow_r')
    eye = M_paper(C['eye'], 'white', 0.6)
    pup = M_paper(C['pupil'], None)
    lid = M_skin(C['lid'])
    for x, rx in ((-0.02, 0.26), (0.72, 0.22)):
        L(c, E(rx, 0.21, x, 1.36), eye, 0.24, 0.04, 'sclera')
        L(c, E(0.085, 0.085, x + rx * 0.35, 1.32, 24), pup, 0.285, 0.03, 'pupil')
        top = [(x + rx * 1.06 * math.cos(math.radians(a)), 1.36 + 0.23 * math.sin(math.radians(a))) for a in range(0, 181, 10)]
        L(c, top, lid, 0.32, 0.04, 'lid')
    L(c, E(0.26, 0.24, -0.26, 0.92), M_skin(C['blush']), 0.265, 0.04, 'cheek_l')
    L(c, E(0.22, 0.22, 1.0, 0.95), M_skin(C['blush']), 0.265, 0.04, 'cheek_r')
    L(c, R(0.3, 0.08, 0.04, 0.45, 0.36), M_paper(C['mouth'], None), 0.27, 0.03, 'mouth')
    L(c, sl.arc_pts(0.42, 0.5, 0.14, 0.5, 18, 162), hair, 0.36, 0.08, 'mustache')
    L(c, pc.xf(pc.teardrop_pts(0.56, 0.78), 0.42, 0.66), M_skin(C['nose']), 0.46, 0.1, 'nose')


@part('helmet')
def build_helmet(c, back=False):
    br = sl.foil('bronze', C['bronze'], metal=0.6, rough=0.36, emit=0.22)
    brd = sl.foil('bronze_d', '#a9784a', metal=0.6, rough=0.4, emit=0.18)
    cap = [(0.1 + 1.24 * math.cos(math.radians(a)), 1.62 + 1.02 * math.sin(math.radians(a))) for a in range(192, -13, -6)]
    L(c, cap, br, 0.0, 0.12, 'cap')
    L(c, R(2.6, 0.3, 0.12, 0.12, 1.52), brd, 0.12, 0.06, 'brim')
    L(c, R(0.24, 0.85, 0.1, -0.78, 1.15, 0.05), brd, 0.12, 0.06, 'cheekguard')
    red = M_paper(C['cloth'])
    for i in range(13):
        a = math.radians(160 - i * 11)
        cx, cy = 0.1 + 1.05 * math.cos(a), 1.75 + 0.95 * math.sin(a)
        L(c, R(0.17, 0.85, 0.08, cx + 0.32 * math.cos(a), cy + 0.32 * math.sin(a), a - math.pi / 2), red, -0.1 + (i % 2) * 0.04, 0.05, 'crest')
    for x in (-0.6, 0.1, 0.8):
        L(c, E(0.07, 0.07, x, 1.52, 16), sl.foil('gold', C['gold'], metal=0.65, rough=0.3, emit=0.3), 0.18, 0.04, 'rivet')


@part('gladius')
def build_gladius(c, back=False):
    L(c, R(0.78, 0.26, 0.1, 0.0, 0.0), sl.tex_board('grip', 'flute', scale=0.9, rot=1.5708), 0.0, 0.1, 'grip')
    g = sl.foil('gold', C['gold'], metal=0.65, rough=0.3, emit=0.3)
    L(c, E(0.19, 0.19, -0.46, 0.0, 32), g, 0.02, 0.1, 'pommel')
    L(c, R(0.2, 0.64, 0.07, 0.44, 0.0), sl.foil('bronze', C['bronze'], metal=0.6, rough=0.36, emit=0.22), 0.1, 0.08, 'guard')
    st = sl.foil('steel', C['steel'], metal=0.75, rough=0.3, emit=0.16)
    L(c, [(0.5, 0.16), (1.9, 0.19), (2.55, 0.15), (3.05, 0.0), (2.55, -0.15), (1.9, -0.19), (0.5, -0.16)], st, 0.04, 0.06, 'blade')
    L(c, R(1.9, 0.06, 0.03, 1.55, 0.0), sl.foil('steel_d', '#9fa3ab', metal=0.7, rough=0.35, emit=0.12), 0.1, 0.02, 'fuller')


# ------------------------------------------------------------------ skeleton (rest pose, joints in parent space)
# name, parent, x, y, part, back?   (order = draw order back -> front)
BONES = [
    ('pelvis', None, 0.0, 4.75, 'pelvis', False),
    ('torso', 'pelvis', 0.0, 0.0, 'torso', False),
    ('head', 'torso', 0.12, 3.35, 'head', False),
    ('helmet', 'head', 0.0, 0.0, 'helmet', False),
    ('arm_b_up', 'torso', -1.35, 2.6, 'arm_up', True),
    ('arm_b_lo', 'arm_b_up', 0.0, -1.85, 'arm_lo', True),
    ('hand_b', 'arm_b_lo', 0.0, -1.6, 'hand', True),
    ('arm_f_up', 'torso', 1.42, 2.6, 'arm_up', False),
    ('arm_f_lo', 'arm_f_up', 0.0, -1.85, 'arm_lo', False),
    ('hand_f', 'arm_f_lo', 0.0, -1.6, 'hand', False),
    ('weapon', 'hand_f', 0.06, -0.38, 'gladius', False),
    ('leg_b_up', 'pelvis', -0.52, -0.55, 'leg_up', True),
    ('leg_b_lo', 'leg_b_up', 0.0, -2.1, 'leg_lo', True),
    ('foot_b', 'leg_b_lo', 0.0, -2.0, 'foot', True),
    ('leg_f_up', 'pelvis', 0.55, -0.55, 'leg_up', False),
    ('leg_f_lo', 'leg_f_up', 0.0, -2.1, 'leg_lo', False),
    ('foot_f', 'leg_f_lo', 0.0, -2.0, 'foot', False),
]
DRAW = ['hand_b', 'arm_b_lo', 'arm_b_up', 'foot_b', 'leg_b_lo', 'leg_b_up', 'foot_f', 'leg_f_lo', 'leg_f_up',
        'torso', 'pelvis', 'head', 'helmet', 'arm_f_lo', 'arm_f_up', 'weapon', 'hand_f']
# test pose (degrees, counter-clockwise) - a ready stance like the reference idle
POSE = {'pelvis': 0, 'torso': 3, 'head': -3, 'arm_b_up': -18, 'arm_b_lo': 35, 'hand_b': 0,
        'arm_f_up': 22, 'arm_f_lo': 62, 'hand_f': -10, 'weapon': -40,
        'leg_b_up': -14, 'leg_b_lo': 4, 'foot_b': 10, 'leg_f_up': 16, 'leg_f_lo': -6, 'foot_f': -10}

# ------------------------------------------------------------------ build + render each part
sprite_of = {}           # bone -> sprite key  (shared sprites: arm_up front/back etc.)
built = {}
for name, parent, x, y, partname, back in BONES:
    key = partname + ('_b' if back else '')
    sprite_of[name] = key
    if key in built:
        continue
    coll = sl.new_coll(key)
    PARTS[partname](coll, back)
    if partname in ('head', 'helmet'):
        for o in coll.objects:
            o.location.x *= HEAD_S
            o.location.y *= HEAD_S
            o.scale = (HEAD_S, HEAD_S, 1.0)
    built[key] = coll

meta = {}
if MODE in ('parts', 'all'):
    for key, coll in built.items():
        meta[key] = sl.render_coll(coll, os.path.join(OUT, 'parts', key + '.png'))
        print('PART', key, meta[key])
    rig = {'ppu': sl.PPU, 'sprites': meta,
           'bones': [{'name': n, 'parent': p, 'x': x, 'y': y, 'sprite': sprite_of[n]} for n, p, x, y, _, _ in BONES],
           'draw': DRAW, 'pose_test': POSE,
           'sun_dir': [6.0 / 16.0, -9.0 / 16.0], 'zk': pc.ZK}
    json.dump(rig, open(os.path.join(OUT, 'rig.json'), 'w'), indent=1)

# ------------------------------------------------------------------ assembly in the test pose (true shadows)
if MODE in ('assembly', 'all'):
    DZ = 0.32
    emp = {}
    for name, parent, x, y, partname, back in BONES:
        e = bpy.data.objects.new('j_' + name, None)
        sc.collection.objects.link(e)
        if parent:
            e.parent = emp[parent]
        e.location = (x, y, 0)
        e.rotation_euler[2] = math.radians(POSE.get(name, 0))
        emp[name] = e
    asm = sl.new_coll('assembly')
    for i, name in enumerate(DRAW):
        src = built[sprite_of[name]]
        for o in src.objects:
            d = o.copy()
            d.data = o.data
            asm.objects.link(d)
            d.parent = emp[name]
            d.location = (o.location.x, o.location.y, o.location.z + i * DZ * pc.ZK)
    bpy.context.view_layer.update()
    info = sl.render_coll(asm, os.path.join(OUT, 'assembly.png'), pad=0.4, origin=(0.0, 0.0))
    json.dump({'dz': DZ, **info}, open(os.path.join(OUT, 'assembly.json'), 'w'))
    print('ASSEMBLY', info)
