"""Body damage stages (#284): wounds that appear on a fighter as health goes down, 10 % of HP at a time.

Stage 1 (91-100 % HP) is unhurt, stage 10 (10 % and below) is the worst. Every wound lives in the local coordinates of
one bone, so each (target, stage) pair renders into an overlay sprite that follows the paper puppet in any pose.
`build_kit.py` renders them as `wound_<target>_<first stage that looks like this>` and lists them in kit.json `wounds`.

Rules from the art review: only long cuts, soft bruises and flowing blood - nothing round or dotted (it read as
pimples) and no glint on the wounds (all wound paper is fully matte).
"""
import math
import random
import sprite_lib as sl

pc = sl.pc

# ------------------------------------------------------------------ wound materials
def paint(name, color, alpha=1.0, rough=0.85):
    m = sl.tex_paper(f'w_{name}', color, 'water', 0.5, tooth=0.3, fibre_nrm=0.2, rough=rough, sss=0.02)
    bsdf = next(n for n in m.node_tree.nodes if n.type == 'BSDF_PRINCIPLED')
    bsdf.inputs['Specular IOR Level'].default_value = 0.0   # no white glint on wounds
    bsdf.inputs['Roughness'].default_value = 1.0
    if alpha < 1.0:
        bsdf.inputs['Alpha'].default_value = alpha
    return m


def lay(c, pts, mat, z):
    pc.layer(pts, mat, h=0.012, z=z, coll=c, name='wound', bevel=0.002)


def lens(x, y, length, width, ang, jag=0.0, seed=0, n=22, bend=0.08):
    """tapered slash: pointed at both ends, slightly curved, optionally ragged"""
    rnd = random.Random(seed)
    top, bot = [], []
    for i in range(n + 1):
        t = i / n
        u = (t - 0.5) * length
        w = width / 2 * math.sin(math.pi * t) ** 0.75
        mid = bend * length * (math.sin(math.pi * t) - 0.5) * 0.5
        j = rnd.uniform(-jag, jag) if 0 < i < n else 0.0
        top.append((u, mid + w + j))
        bot.append((u, mid - w + j * 0.5))
    return pc.xf(top + list(reversed(bot))[1:-1], x, y, ang)


# ------------------------------------------------------------------ wound kinds: fn(coll, z, world_angle)
def scratch(x, y, length=0.5, ang=-0.6, count=3, gap=0.1, seed=1):
    def f(c, z, wa):
        rnd = random.Random(seed)
        nx, ny = -math.sin(ang), math.cos(ang)
        for k in range(count):
            o = (k - (count - 1) / 2) * gap
            ln = length * rnd.uniform(0.7, 1.1)
            s = rnd.uniform(-0.07, 0.07)
            px, py = x + nx * o + math.cos(ang) * s, y + ny * o + math.sin(ang) * s
            lay(c, lens(px, py, ln * 1.08, 0.065, ang, 0.006, seed + k), paint('scr_halo', '#d9604c', 0.45), z + 0.020)
            lay(c, lens(px, py, ln, 0.028, ang, 0.006, seed + k), paint('scr', '#a92c25'), z + 0.027)
    return f


def graze(x, y, r=0.22, seed=2):
    """scraped patch: dots and short ticks"""
    def f(c, z, wa):
        rnd = random.Random(seed)
        lay(c, pc.xf(pc.blob_pts(r, r * 0.65, 0.18, seed), x, y, 0.4), paint('graze', '#d4604e', 0.35), z + 0.006)
        for _ in range(11):
            px, py = x + rnd.uniform(-r, r) * 0.75, y + rnd.uniform(-r, r) * 0.45
            lay(c, lens(px, py, rnd.uniform(0.05, 0.14), 0.022, -0.5, seed=seed), paint('scr', '#a92c25'), z + 0.024)
    return f


BRUISE = {  # layers: (size, colour, alpha) - many faint sheets read as a soft, blotchy mark
    'fresh': [(1.08, '#d0786a', 0.20), (0.9, '#b8566a', 0.22), (0.72, '#9a4066', 0.26), (0.52, '#7c3060', 0.28),
              (0.30, '#5e2552', 0.32)],
    'deep': [(1.2, '#b09a50', 0.18), (1.04, '#8f6a62', 0.22), (0.88, '#7d4078', 0.30), (0.70, '#5e2c6c', 0.34),
             (0.50, '#45205a', 0.38), (0.28, '#2e1540', 0.45)],
}


def bruise(x, y, rx=0.3, ry=0.22, rot=0.0, kind='fresh', seed=5):
    def f(c, z, wa):
        rnd = random.Random(seed)
        for i, (s, col, a) in enumerate(BRUISE[kind]):
            dx, dy = rnd.uniform(-0.2, 0.2) * rx * (i > 0), rnd.uniform(-0.2, 0.2) * ry * (i > 0)
            pts = pc.xf(pc.blob_pts(rx * s, ry * s, 0.17, seed + i * 3), x + dx, y + dy, rot + rnd.uniform(-0.4, 0.4))
            lay(c, pts, paint(f'br_{kind}{i}', col, a), z + 0.001 + i * 0.0022)
    return f


def drip(x, y, length=0.5, seed=7, width=0.055):
    """blood running with gravity from (x, y), whatever the bone's angle"""
    def f(c, z, wa):
        rnd = random.Random(seed)
        n = 16
        a, b = [], []
        ph = rnd.uniform(0, 6)
        for i in range(n + 1):
            t = i / n
            wob = math.sin(t * 7 + ph) * 0.025 * t
            w = width / 2 * (1.0 - 0.55 * math.sin(math.pi * t * 0.9))
            a.append((wob + w, -t * length))
            b.append((wob - w, -t * length))
        end = a[-1][0] - width / 2
        rot = -wa
        mat = paint('blood', '#97101a', 1.0, rough=0.45)
        lay(c, pc.xf(a + list(reversed(b)), x, y, rot), mat, z + 0.040)
        dx, dy = pc.xf([(end, -length)], x, y, rot)[0]
        lay(c, pc.xf(pc.teardrop_pts(width * 1.7, width * 2.6), *pc.xf([(0, -width * 0.9)], dx, dy, rot)[0], rot), mat, z + 0.043)
    return f


def cut(x, y, length=0.7, width=0.11, ang=-0.5, drips=(), seed=9):
    """sword cut: inflamed rim, open red flesh, dark centre, blood running from it"""
    def f(c, z, wa):
        lay(c, lens(x, y, length * 1.14, width * 2.1, ang, 0.012, seed), paint('cut_rim', '#d4665a', 0.55), z + 0.028)
        lay(c, lens(x, y, length, width, ang, 0.016, seed + 1), paint('cut_red', '#b3161d', rough=0.55), z + 0.036)
        lay(c, lens(x, y, length * 0.78, width * 0.4, ang, 0.012, seed + 2), paint('cut_dark', '#4d050b', rough=0.5), z + 0.044)
        for i, (t, ln) in enumerate(drips):
            u = (t - 0.5) * length
            sx, sy = x + math.cos(ang) * u, y + math.sin(ang) * u - width * 0.2
            drip(sx, sy, ln, seed + i)(c, z, wa)
    return f


def ribbon(path, widths):
    """closed strip along a polyline with its own width at every point"""
    top, bot = [], []
    n = len(path)
    for i, (px, py) in enumerate(path):
        ax, ay = path[max(0, i - 1)]
        bx, by = path[min(n - 1, i + 1)]
        d = math.hypot(bx - ax, by - ay) or 1.0
        nx, ny = -(by - ay) / d, (bx - ax) / d
        w = widths[i] / 2
        top.append((px + nx * w, py + ny * w))
        bot.append((px - nx * w, py - ny * w))
    return top + bot[::-1]


def curve_path(x, y, length, ang, bend=0.12, n=28):
    return pc.xf([((i / n - 0.5) * length, bend * length * (math.sin(math.pi * i / n) - 0.6)) for i in range(n + 1)], x, y, ang)


def taper(n, w, sharp=0.7, skew=1.0):
    return [max(0.004, w * max(0.0, math.sin(math.pi * (i / (n - 1)) ** skew)) ** sharp) for i in range(n)]


def slice_cut(x, y, length=1.0, ang=-0.3, bend=0.12, beads=(0.4,), width=0.05, seed=100):
    """quick shallow slice: one thin curved line, trailing off at one end, a short trickle or two"""
    def f(c, z, wa):
        path = curve_path(x, y, length, ang, bend)
        n = len(path)
        lay(c, ribbon(path, taper(n, width * 2.4, 0.8, 0.7)), paint('sl_halo', '#d96a58', 0.36), z + 0.026)
        lay(c, ribbon(path, taper(n, width, 0.6, 0.7)), paint('sl_line', '#a3121a', rough=0.5), z + 0.036)
        lay(c, ribbon(path, taper(n, width * 0.34, 0.8, 0.7)), paint('sl_deep', '#4d050b', rough=0.5), z + 0.043)
        for k, t in enumerate(beads):
            px, py = path[int(t * (n - 1))]
            drip(px, py, 0.18 + 0.14 * k, seed + k, 0.04)(c, z, wa)
    return f


def stream(x, y, length=0.9, width=0.2, seed=170, tails=2):
    """a sheet of blood running down from a wound: wide at the top, wavy, breaking into thin trickles"""
    def f(c, z, wa):
        rnd = random.Random(seed)
        rot = -wa
        n = 22
        ph = rnd.uniform(0, 6)
        path = [(math.sin(i / n * 5 + ph) * 0.035 * (i / n), -length * 0.62 * i / n) for i in range(n + 1)]
        wid = [width * (1.0 - 0.8 * (i / n) ** 0.8) * (1 + 0.16 * math.sin(i * 1.3 + ph)) * min(1.0, 0.12 + i / 5) for i in range(n + 1)]
        mat = paint('flow', '#97101a', 0.88, rough=0.45)
        lay(c, pc.xf(ribbon(path, wid), x, y, rot), mat, z + 0.0385)
        for k in range(tails):
            sx, sy = path[int(n * (0.55 + 0.35 * k / max(1, tails - 1)))]
            off = (k - (tails - 1) / 2) * width * 0.34
            px, py = pc.xf([(sx + off, sy)], x, y, rot)[0]
            drip(px, py, length * rnd.uniform(0.35, 0.55), seed + 3 + k, 0.045)(c, z, wa)
    return f


def shut_eye(c, z, wa):
    """swollen shut: purple puffy lid over the near eye"""
    lay(c, pc.xf(pc.blob_pts(0.28, 0.25, 0.05, 3), 0.72, 1.36), paint('swell0', '#9a4a66'), z + 0.03)
    lay(c, pc.xf(pc.blob_pts(0.25, 0.14, 0.05, 4), 0.72, 1.43), paint('swell1', '#7a355c'), z + 0.04)
    lay(c, pc.xf(pc.blob_pts(0.23, 0.08, 0.05, 5), 0.72, 1.23), paint('swell2', '#b05c70'), z + 0.042)
    lay(c, lens(0.72, 1.31, 0.42, 0.055, 0.16, 0.008, 3, bend=-0.07), paint('lash', '#2a0c18'), z + 0.055)


def swollen_lip(c, z, wa):
    lay(c, pc.xf(pc.blob_pts(0.13, 0.085, 0.06, 6), 0.55, 0.34), paint('lip', '#c0525a'), z + 0.025)
    lay(c, lens(0.58, 0.34, 0.2, 0.04, 1.35), paint('cut_dark', '#4d050b'), z + 0.04)


def missing_tooth_blood(c, z, wa):
    lay(c, pc.xf(pc.blob_pts(0.1, 0.05, 0.15, 8), 0.5, 0.29), paint('blood', '#97101a', rough=0.45), z + 0.045)


# ------------------------------------------------------------------ the 10 stages
# (bone, first stage, wound, last stage). Wounds accumulate; `last` lets one be replaced by a worse one.
W = []


def add(stage, bone, fn, last=10):
    W.append((bone, stage, fn, last))


# The upper arms follow the quarter turn (#280): the near arm (arm_b) is the one in view, so it carries the richer set;
# the sword shoulder sits behind the chest.
# 2 (90-81 %): a few scratches
add(2, 'torso', scratch(-0.55, 1.95, 0.62, -0.7, 3, seed=1), last=7)
add(2, 'face', scratch(-0.4, 0.98, 0.34, -0.8, 2, 0.09, seed=2))
add(2, 'arm_b_up', scratch(0.05, -0.85, 0.42, 0.5, 3, 0.09, seed=3))
add(2, 'leg_f_lo', graze(0.05, -0.28, 0.19, 4))
# 3 (80-71 %): more scratches, first light bruises
add(3, 'torso', scratch(0.35, 0.95, 0.55, 0.55, 3, seed=5), last=6)
add(3, 'torso', bruise(-0.82, 1.35, 0.3, 0.22, 0.3, 'fresh', 6), last=5)
add(3, 'arm_f_up', bruise(0.02, -0.75, 0.27, 0.34, 0.1, 'fresh', 7))
add(3, 'leg_f_up', scratch(0.06, -1.45, 0.5, -0.45, 3, 0.1, seed=8))
add(3, 'face', graze(0.62, 1.93, 0.19, 9))
add(3, 'arm_f_lo', scratch(0.0, -0.75, 0.34, -0.5, 2, 0.09, seed=10))
# 4 (70-61 %): bigger bruises, first shallow sword cut
add(4, 'torso', cut(-0.42, 2.3, 0.8, 0.075, -0.42, seed=20))
add(4, 'torso', bruise(0.78, 1.55, 0.34, 0.26, -0.4, 'fresh', 21))
add(4, 'face', bruise(-0.28, 0.9, 0.3, 0.24, 0.2, 'fresh', 22))
add(4, 'leg_b_up', bruise(-0.04, -1.5, 0.28, 0.34, 0.0, 'fresh', 23))
add(4, 'leg_f_lo', bruise(0.02, -1.0, 0.18, 0.3, 0.05, 'fresh', 24))
# 5 (60-51 %): black eye, split lip, cut on the arm
add(5, 'face_under', bruise(0.69, 1.35, 0.33, 0.31, 0.0, 'fresh', 30), last=6)
add(5, 'face', swollen_lip)
add(5, 'face', cut(0.80, 1.88, 0.34, 0.06, -0.2, seed=31))
add(5, 'arm_b_up', cut(0.0, -1.25, 0.6, 0.09, -0.65, drips=((0.7, 0.34),), seed=32))
add(5, 'torso', scratch(-0.2, 0.42, 0.5, -0.2, 3, seed=33), last=6)
# 6 (50-41 %): a real slash across the chest, blood starts running
add(6, 'torso', bruise(-0.8, 1.35, 0.42, 0.3, 0.3, 'deep', 6))
add(6, 'torso', cut(0.02, 1.62, 1.55, 0.16, -0.55, drips=((0.28, 0.4), (0.74, 0.62)), seed=40))
add(6, 'leg_f_up', cut(0.04, -1.0, 0.62, 0.09, 0.35, drips=((0.35, 0.55),), seed=41))
add(6, 'face', drip(0.86, 1.82, 0.38, 42, 0.05))
# 7 (40-31 %): nosebleed, a long thin slice under the ribs
add(7, 'face_under', bruise(0.66, 1.33, 0.38, 0.35, 0.0, 'deep', 30))
add(7, 'face', drip(0.34, 0.69, 0.36, 50, 0.065))
add(7, 'torso', slice_cut(-0.12, 0.86, 1.35, 0.24, -0.14, (0.3, 0.66), 0.062, 51))
add(7, 'arm_b_lo', slice_cut(0.0, -0.8, 0.46, 0.75, 0.14, (0.5,), 0.05, 52))
# 8 (30-21 %): a short deep cut by the shoulder, thigh and arm opened, blood starts to flow
add(8, 'face', slice_cut(-0.3, 1.0, 0.5, 0.62, 0.16, (0.28,), 0.05, 60))
add(8, 'torso', cut(0.5, 2.42, 0.7, 0.13, 0.5, drips=((0.25, 0.4),), seed=61))
add(8, 'torso', stream(0.3, 1.32, 0.95, 0.17, 62))
add(8, 'arm_b_up', cut(0.0, -0.55, 0.6, 0.11, 0.5, drips=((0.35, 0.6),), seed=63))
add(8, 'leg_f_lo', slice_cut(0.0, -0.6, 0.55, -0.6, 0.16, (0.55,), 0.055, 64))
# 9 (20-11 %): eye swollen shut, bleeding from the mouth, heavy flow from the chest
add(9, 'face', shut_eye)
add(9, 'face', missing_tooth_blood)
add(9, 'face', drip(0.5, 0.29, 0.34, 70, 0.07))
add(9, 'torso', stream(-0.28, 1.86, 1.35, 0.23, 71, 3))
add(9, 'leg_f_up', stream(0.0, -1.03, 1.0, 0.18, 72))
add(9, 'arm_b_up', stream(0.04, -0.62, 1.05, 0.14, 73))
add(9, 'arm_f_up', slice_cut(0.0, -1.15, 0.62, -0.55, 0.14, (0.45,), 0.055, 74))
# 10 (10-0 %): blood over half the face, the chest and the legs
add(10, 'face', stream(-0.64, 1.9, 1.15, 0.23, 80, 2))
add(10, 'torso', stream(-0.62, 2.28, 1.3, 0.2, 81))
add(10, 'torso', stream(0.55, 2.32, 1.1, 0.17, 82))
add(10, 'torso', stream(0.02, 0.84, 0.7, 0.22, 83))
add(10, 'leg_f_lo', stream(0.02, -0.66, 1.15, 0.17, 84))
add(10, 'leg_b_up', stream(-0.02, -0.95, 0.9, 0.14, 85))
add(10, 'arm_f_lo', stream(0.02, -0.3, 0.95, 0.13, 86))


# ------------------------------------------------------------------ overlay sprites
STAGES = 10
# target (kit.json `wounds` key, the layer's `piece`) -> bone it is drawn on
TARGETS = {t: t for t in ('torso', 'arm_f_up', 'arm_f_lo', 'arm_b_up', 'arm_b_lo',
                          'leg_f_up', 'leg_f_lo', 'leg_b_up', 'leg_b_lo')}
TARGETS.update(face_under='head', face='head')
# bone angles in the ready stance (degrees CCW, summed down the chain): blood runs "down" as seen in this stance
STANCE = {'torso': 3, 'head': 0, 'arm_f_up': 25, 'arm_f_lo': 87, 'arm_b_up': -15, 'arm_b_lo': 20,
          'leg_f_up': 16, 'leg_f_lo': 10, 'leg_b_up': -14, 'leg_b_lo': -10}
Z_TOP = {'torso': 0.38, 'face': 0.31, 'face_under': 0.27}


def active(target, stage):
    return tuple(i for i, w in enumerate(W) if w[0] == target and w[1] <= stage <= w[3])


def table():
    """target -> [sprite key or None for stage 1..10]; stages that look the same share one sprite"""
    out = {}
    for target in TARGETS:
        keys, seen = [], {}
        for stage in range(1, STAGES + 1):
            items = active(target, stage)
            keys.append(seen.setdefault(items, f'wound_{target}_{stage}') if items else None)
        out[target] = keys
    return out


def build(coll, target, stage):
    angle = math.radians(STANCE[TARGETS[target]])
    for n, i in enumerate(active(target, stage)):
        W[i][2](coll, Z_TOP.get(target, 0.2) + n * 0.0015, angle)


def jobs():
    """sprite key -> (builder(coll), is it a head sprite)"""
    out = {}
    for target, keys in table().items():
        for key in dict.fromkeys(k for k in keys if k):
            stage = int(key.rsplit('_', 1)[1])
            out[key] = ((lambda c, t=target, s=stage: build(c, t, s)), TARGETS[target] == 'head')
    return out
