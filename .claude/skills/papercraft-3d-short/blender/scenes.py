"""Papercraft set pieces rendered with Blender Cycles (headless).
Run:  D:\\blender\\blender.exe -b --python scenes.py -- <scene> <out.png> [width height samples]
Scenes: belt breakfast breakfast_stripes breakfast_gingham cave cave_hands town jars party family mito mito_ribbon pipes gym
Frame at z=0 depends on camera distance D (85 mm lens): width = D*36/85, height = width*16/9. +Y up, layers stack toward +Z (the camera).
Rendered with post.py afterwards (bloom, lifted blacks, vignette, grain).
"""
import sys, os, math, random
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import bpy
import pc_lib as pc
from pc_lib import layer, rrect, ellipse_pts, blob_pts, teardrop_pts, wave_pts, xf

argv = sys.argv[sys.argv.index('--') + 1:] if '--' in sys.argv else []
SCENE = argv[0] if argv else 'belt'
OUT = argv[1] if len(argv) > 1 else SCENE + '.png'
W = int(argv[2]) if len(argv) > 2 else 540
H = int(argv[3]) if len(argv) > 3 else 960
S = int(argv[4]) if len(argv) > 4 else 128

pc.clear()
sc = bpy.context.scene
_cache = {}
HND = {}          # handles to objects that animate.py moves (filled by the scene builders)


def P(color, **k):
    key = (color, tuple(sorted(k.items())))
    if key not in _cache:
        _cache[key] = pc.paper_mat('m%d' % len(_cache), color, **k)
    return _cache[key]


def G(color, strength=10.0):
    key = ('glow', color, strength)
    if key not in _cache:
        _cache[key] = pc.glow_mat('g%d' % len(_cache), color, strength)
    return _cache[key]


def cam(D=26.0, y=0.0, fstop=None, focus=None, x=0.0):
    HND['cam'] = pc.camera((x, y, D), (0, 0, 0), lens=85, focus=focus, fstop=fstop)
    HND['cam0'] = (x, y, D)


def disc(r, mat, h=0.2, z=0.0, loc=(0, 0), n=72, name='disc'):
    return layer(ellipse_pts(r, r, n), mat, h, z, loc=loc, name=name)


def cube(loc, rot, size=0.9):
    return pc.sugar_cube(loc, rot, size, P('#f6f2ec', rough=0.8, sss=0.25))


def strip(pts, width, h, z, mat, bevel=0.01, closed=False, name='strip'):
    v, f = pc.band_geo(pts, width, h, z, closed)
    return pc.mesh_from(name, v, f, mat, bevel=bevel)


def arc(cx, cy, r, a0, a1, n=16, sy=1.0):
    return [(cx + r * math.cos(a0 + (a1 - a0) * i / n), cy + r * sy * math.sin(a0 + (a1 - a0) * i / n)) for i in range(n + 1)]


# ------------------------------------------------------------------ scenes
def belt():
    pc.setup_cycles(sc, W, H, S, exposure=0.05, view='Standard')
    pc.world_color(sc, '#c3d3e2', 0.42)
    pc.sun('key', None, 2.1, '#fff4e6', 4.0)
    SY = 4.2
    sh, sw = 2.5, 0.72                                     # wider slit (half width at the widest point)
    slit_fn = lambda w, hh=sh: xf([(math.sin(i / 24 * math.tau) * w, math.cos(i / 24 * math.tau) * hh) for i in range(24)], 0, SY - 8.9)
    slit = [(math.sin(i / 24 * math.tau) * sw, math.cos(i / 24 * math.tau) * sh) for i in range(24)]
    layer(rrect(17, 24, 0.3), pc.pattern_mat('shirt', 'pinstripe', '#a8c6da', '#eef6fb', 1.0 / 0.5, ratio=0.5), 0.4, 0, holes=[xf(slit, 0, SY - 8.9)], loc=(0, 8.9), name='shirt')   # tall + wide: the belt clip starts zoomed OUT
    HND['shirt'] = sh_ob = bpy.data.objects['shirt']; HND['slit_fn'] = slit_fn
    HND['backdrop'] = layer(rrect(5, 9, 0.2), P('#4a1018'), 0.2, -1.2, loc=(0, SY))
    HND['ember_glow'] = layer(ellipse_pts(0.75, 1.4), G('#ff7a18', 5), 0.1, -0.95, loc=(0, SY - 1.9))
    HND['ember'] = pc.point('ember', (0, SY - 1.9, 1.2), 90, '#ff7a28', 0.4)
    for by in (SY + 2.8, SY - 2.8):
        disc(0.58, P('#f4f1ec'), 0.18, 0.4, (0, by))
        for k in range(2):                                 # X stitch
            a = 0.8 + k * 1.57
            strip([(math.cos(a) * 0.3, by + math.sin(a) * 0.3), (-math.cos(a) * 0.3, by - math.sin(a) * 0.3)], 0.05, 0.03, 0.58, P('#8a8a96'), 0.003)
    for sx in (-1, 1):
        for dy in (0.25, -0.3):
            pts = [(1.2 * sx, SY + 2.8 + dy), (2.8 * sx, SY + 3.05 + dy * 2.2), (4.0 * sx, SY + 3.0 + dy * 2.4)]
            strip(pts, 0.13, 0.05, 0.4, P('#8fb0cc'), 0.01)
    layer(rrect(15.5, 9, 0.1), pc.pattern_mat('denim', 'twill', '#3a4470', '#46517f', 9.0, ratio=0.5, grit=0.55, mottle=0.3), 0.4, 0.15, loc=(0, -7.8))
    for sx in (-1, 1):
        strip([(sx * 2.0, -4.5), (sx * 5.0, -11.5)], 0.08, 0.05, 0.55, P('#5a669e'), 0.005)
    # belt follows the belly: smile-shaped centre line
    yb = lambda x: -1.8 + 0.011 * x * x - 0.1 * x
    xs = [-8 + i * 0.4 for i in range(41)]
    strip([(x, yb(x)) for x in xs], 2.7, 0.45, 0.9, P('#b87846', grit=1.0, mottle=0.15, grain=1.0), 0.03, name='belt')
    for off in (0.75, -0.75):
        for i in range(32):
            x = -7.6 + i * 0.5
            slope = math.atan(0.022 * x - 0.1)
            layer(rrect(0.34, 0.09, 0.03, 3), P('#f1d9b4'), 0.03, 1.36, loc=(x, yb(x) + off), rot=slope, bevel=0.003)
    for x in (-5.6, -4.1, -2.6):
        disc(0.22, P('#241812'), 0.1, 1.3, (x, yb(x)), 20)
    layer(rrect(0.9, 3.0, 0.25), P('#a8683c'), 0.5, 1.15, loc=(5.6, yb(5.6)), rot=math.atan(0.022 * 5.6 - 0.1))
    layer(rrect(2.6, 2.2, 0.8), P('#b87846'), 0.4, 1.4, loc=(1.6, -2.0), rot=-0.05)                    # belt end overlapping the buckle
    gold = pc.gold_mat('gold', '#f4d03c')
    layer(rrect(4.6, 3.8, 0.8), gold, 0.45, 1.55, holes=[rrect(3.3, 2.5, 0.45)], loc=(0, -1.8), bevel=0.09)
    layer(rrect(2.7, 0.3, 0.14), gold, 0.25, 1.3, loc=(-0.3, -1.8), bevel=0.04)
    cam(26)


def breakfast(kind='polka'):
    pc.setup_cycles(sc, W, H, S, exposure=-0.35, view='Standard')
    pc.world_color(sc, '#e6ece6', 0.5)
    pc.sun('key', None, 2.2, '#fff4e6', 4.0)
    spec = {'polka': ('polka', '#b8d8bc', '#eef4ec', 0.8, 0.24), 'stripes': ('hstripes', '#f3c24a', '#f8d97a', 0.42, 0.5), 'gingham': ('gingham', '#b9d3ef', '#7fa9d8', 0.42, 0.5)}[kind]
    layer(rrect(16, 26, 0), pc.pattern_mat('cloth', spec[0], spec[1], spec[2], spec[3], ratio=spec[4]), 0.2, -0.5)
    W_ = P('#f8f5f0')
    disc(4.5, W_, 0.25, 0.2, (0, 0.3))
    disc(3.7, P('#fdfbf8'), 0.03, 0.45, (0, 0.3))
    for sx in (-1, 1):
        layer(blob_pts(1.2, 0.98, 0.07, 3 + sx), P('#fffaf0'), 0.12, 0.49, loc=(sx * 1.5, 1.4))
        disc(0.5, P('#f2a31b', rough=0.4), 0.14, 0.61, (sx * 1.5, 1.35))
        disc(0.1, P('#fff1c0'), 0.03, 0.75, (sx * 1.35, 1.55), 16)
        rnd = random.Random(sx + 9)
        for k in range(7):                                  # pepper specks on the white
            disc(0.035, P('#3a2a22'), 0.02, 0.62, (sx * 1.5 + rnd.uniform(-1.0, 1.0), 1.4 + rnd.uniform(-0.7, 0.7)), 8)
    pts = [(math.cos(a) * 2.2, math.sin(a) * 1.5 - 0.7 + 0.1 * math.sin(i * 0.8)) for i, a in enumerate([math.pi * (1.12 + 0.76 * i / 23) for i in range(24)])]
    strip(pts, 0.55, 0.12, 0.49, P('#c2453d'), 0.02, name='bacon')
    strip([(x, y + 0.05) for x, y in pts], 0.1, 0.03, 0.62, P('#f1c2bc'), 0.003)          # fat stripe
    # fork + napkin, knife
    layer(rrect(1.7, 6.4, 0.2), P('#efe6cf'), 0.1, 0.0, loc=(-6, 0))
    layer(rrect(0.45, 3.6, 0.2), P('#9ea6b0', rough=0.5), 0.1, 0.12, loc=(-6, -1.2))
    layer(rrect(1.2, 2.0, 0.3), P('#9ea6b0', rough=0.5), 0.1, 0.12, loc=(-6, 1.4))
    for i in range(4):
        layer(rrect(0.1, 1.2, 0.04), P('#e7e1d4'), 0.03, 0.25, loc=(-6.4 + i * 0.27, 1.9))
    layer([(-0.3, -2.9), (0.3, -2.9), (0.4, 1.8), (0.05, 3.0), (-0.3, 2.0)], P('#c3cbd6', rough=0.5), 0.1, 0.1, loc=(6, 0))
    # coffee: saucer, cup, coffee, handle, steam, spoon
    disc(2.1, W_, 0.2, 0.1, (4.6, 8.4)); disc(1.5, W_, 0.3, 0.3, (4.6, 8.4))
    layer(ellipse_pts(0.75, 0.55), W_, 0.25, 0.3, holes=[ellipse_pts(0.45, 0.28)], loc=(6.0, 8.9), rot=0.5)
    disc(1.25, P('#3a2418', rough=0.4), 0.05, 0.6, (4.6, 8.4))
    strip(arc(4.6, 8.4, 0.7, 3.4, 5.6), 0.14, 0.03, 0.66, P('#6a4630'), 0.003)
    strip([(4.4 + 0.45 * math.sin(i * 0.7), 9.8 + i * 0.33) for i in range(10)], 0.2, 0.02, 0.9, P('#ffffff', rough=1.0, sss=0.0), 0.002, name='steam')
    # juice on a doily
    disc(1.9, P('#f1e2a0'), 0.1, 0.0, (-4.4, 8.6)); disc(1.5, P('#e9e2d3'), 0.2, 0.1, (-4.4, 8.6)); disc(1.15, P('#f2a31b', rough=0.35), 0.08, 0.3, (-4.4, 8.6))
    # newspaper
    layer(rrect(11, 6, 0.2), P('#f4f1ea'), 0.1, -0.1, loc=(1.2, -9.8), rot=0.03)
    layer(rrect(6.4, 0.8, 0.1), P('#2b2b2e'), 0.03, 0.05, loc=(-0.8, -8.3))
    layer(rrect(3, 2.6, 0.1), P('#c9494a'), 0.03, 0.05, loc=(-3.6, -10.2))
    for i in range(4):
        layer(rrect(4.4, 0.2, 0.05), P('#8d8d90'), 0.02, 0.05, loc=(3.2, -9.4 - i * 0.6))
    cam(32)


def hand(cx, cy, rot, tone, cuff, s=1.0, nail=None, z=2.4):
    """Chunky blocky paper hand pointing along local +Y: big fist, thick index finger, three curled knuckle blocks, thumb, cuff."""
    sk = P(tone, sss=0.3)

    objs = []

    def piece(poly, zz, dx=0, dy=0, mat=sk, h=0.35, bev=0.07):
        p = xf(poly, dx * s, dy * s, 0, s)
        p = xf(p, 0, 0, rot)
        objs.append(layer([(px + cx, py + cy) for px, py in p], mat, h, zz, bevel=bev))
    piece(rrect(3.2, 2.8, 0.9), z, 0, 0, sk, 0.6)                          # fist
    piece(rrect(1.15, 4.2, 0.55), z + 0.12, 0.7, 2.7, sk, 0.5)             # thick index finger
    for k, x in enumerate((-1.2, -0.4)):
        piece(rrect(0.85, 1.25, 0.35), z + 0.55, x, 1.25, sk, 0.35)        # curled fingers (knuckle blocks)
        piece(rrect(0.85, 0.12, 0.05), z + 0.9, x, 1.0, P('#6a4630'), 0.04, 0.005)   # finger crease
    piece(rrect(0.95, 1.5, 0.4), z + 0.4, -1.65, -0.15, sk, 0.4)           # thumb
    piece(rrect(3.3, 1.9, 0.25), z - 0.05, 0, -2.3, P(cuff), 0.7, 0.05)    # cuff
    if nail:
        piece(rrect(0.65, 0.75, 0.2), z + 0.64, 0.7, 4.55, P(nail), 0.05, 0.01)
    return objs


def cave(hands=False, far=1.0):
    """far = camera distance multiplier. far=1: close framing (static still). far=1.5: reference-like framing (flame ~37 % of the frame width, ring fills the frame, hands arranged on the axes: left/right horizontal, top/bottom vertical)."""
    pc.setup_cycles(sc, W, H, S, exposure=0.15, view='Standard')   # Standard keeps the flame yellow (AgX would desaturate it to cream)
    pc.world_color(sc, '#5a3a3a', 0.55)
    pc.area('fill', (-5, 7, 15), (0, 0, 0), 260, 9, '#f0c8c0')
    cx0 = 0.6
    plum = ['#4a2a2c', '#3a2024', '#512e30', '#2c181c']
    for i in range(5):
        sc_ = (1 - i * 0.17) * far
        nx = (1 - (i + 1) * 0.17) * far                    # rings scale with `far` so they keep filling the frame (the reference ring touches the frame edges, flame only ~37 % of the width)
        outer = blob_pts(4.9 * sc_, 8.0 * sc_, 0.06, 4 + i)
        x, z = cx0 + i * 0.2, -2.4 + i * 0.7
        layer(outer, P(plum[i % 4]), 0.3, z, holes=[blob_pts(4.9 * nx, 8.0 * nx, 0.06, 5 + i)] if i < 4 else [], loc=(x, -0.3), bevel=0.02)
        if i < 4:                                           # thin pale-pink rim line on every layer
            ob_ = strip(blob_pts(4.9 * sc_, 8.0 * sc_, 0.06, 4 + i), 0.09, 0.05, z + 0.3, P('#d98aa6'), 0.004, closed=True, name='rim')
            ob_.location = (x, -0.3, 0)
    # pedestal
    layer(ellipse_pts(4.4, 1.5), P('#3d1c30'), 0.35, 0.7, loc=(cx0 + 0.3, -3.5))
    layer(ellipse_pts(4.2, 1.35), P('#b04a78'), 0.15, 1.05, loc=(cx0 + 0.3, -3.35))
    layer(ellipse_pts(3.2, 0.95), P('#8e3560'), 0.1, 1.2, loc=(cx0 + 0.3, -3.3))
    # logs with cream ring ends
    for rz, x, y in ((0.25, -0.2, 0.0), (-0.22, 0.2, 0.3)):
        for r_, d_, c_, off in ((0.52, 3.1, '#d98a4e', 0.0), (0.46, 0.08, '#f1d9a2', 1.56)):
            for sx in ((-1, 1) if off else (0,)):
                bpy.ops.mesh.primitive_cylinder_add(radius=r_, depth=d_, location=(cx0 + 0.3 + x + math.cos(rz) * sx * off, -2.7 + y + math.sin(rz) * sx * off, 1.95 * pc.ZK), rotation=(0, math.pi / 2, rz))
                bpy.context.active_object.data.materials.append(P(c_, rough=0.8))
    # flame hero: yellow body, pale core, worried face
    fx, fy = cx0 + 0.3, -2.4
    HND['flame_o'] = layer(teardrop_pts(4.0, 5.2), G('#ffc400', 1.25), 0.12, 1.7, loc=(fx, fy), bevel=0.02)
    HND['flame_i'] = layer(xf(teardrop_pts(2.3, 3.0), 0, 0.15), G('#ffee70', 1.4), 0.1, 1.85, loc=(fx, fy), bevel=0.02)
    for sx in (-1, 1):
        disc(0.42, P('#9a5230'), 0.05, 2.0, (fx + sx * 0.85, fy + 1.55), 24)
        disc(0.1, G('#ffffff', 3), 0.03, 2.07, (fx + sx * 0.85 - 0.12 * sx, fy + 1.72), 10)
        strip([(fx + sx * 0.5, fy + 2.25 - sx * 0.1), (fx + sx * 1.25, fy + 2.1 + sx * 0.15)], 0.08, 0.03, 2.05, P('#9a5230'), 0.003)   # worried brows
    layer(ellipse_pts(0.3, 0.45), G('#fffaf0', 2.6), 0.04, 2.0, loc=(fx, fy + 0.5))
    HND['flame_light'] = pc.point('flame', (fx, fy + 1.4, 4.5), 320, '#ff9a3a', 0.6)
    door = [(-1.2, -2)] + [(math.cos(a) * 1.2, 1.2 + math.sin(a) * 1.2) for a in [math.pi * i / 16 for i in range(17)]][::-1] + [(1.2, -2)]
    HND['door'] = layer(door, G('#fff6ea', 3), 0.2, 0.3, loc=(-7.8, -1.0))
    HND['door_light'] = pc.point('door', (-6.6, -0.8, 2.4), 100, '#ffd9b0', 0.5)
    if hands:
        tones = ['#d99b72', '#c98a5e', '#8a5a3a', '#f0c7a0', '#b9784c', '#6e4630', '#e1a77d', '#d29b6e']
        cuffs = ['#59606e', '#7a4d3a', '#c9c2b0', '#3f4a58', '#59606e', '#7a4d3a', '#3f4a58', '#c9c2b0']
        for i in range(8):
            a = i / 8 * math.tau + (0.2 if far == 1.0 else 0.0)
            hx, hy = fx + math.cos(a) * 5.2 * (far * 0.92 if far != 1.0 else 1.0), -0.9 + math.sin(a) * 7.2 * (far * 1.0 if far != 1.0 else 1.0)
            rot = math.atan2(fy + 0.8 - hy, fx - hx) - math.pi / 2
            objs = hand(hx, hy, rot, tones[i], cuffs[i], 0.62 * (1.0 if far == 1.0 else far * 0.78), '#c0392b' if i in (2, 5) else None)
            dxv, dyv = fx - hx, fy + 0.8 - hy
            ln = math.hypot(dxv, dyv) or 1.0
            HND.setdefault('hands', []).append((objs, (dxv / ln, dyv / ln)))
    cam(23 * far)


def town():
    pc.setup_cycles(sc, W, H, S, exposure=0.0)
    pc.world_color(sc, '#8a3a4a', 0.5)
    pc.sun('key', None, 2.6, '#ffe8d8', 5.0)
    layer(rrect(30, 40, 0), pc.pattern_mat('bg', 'polka', '#5c2430', '#66293a', 0.5, ratio=0.4), 0.1, -3)
    for k, (x, y, rx, ry, c) in enumerate(((-7, 9.5, 4.2, 3.4, '#6e2c3d'), (6.5, 8, 5.0, 3.8, '#5e2536'), (0, 6.5, 3.4, 2.8, '#7a3345'))):
        layer(ellipse_pts(rx, ry), P(c), 0.2, -2.2 + 0.25 * k, loc=(x, y))       # each disc on its own level: coincident faces render black
    rnd = random.Random(9)
    BH, BW = 11.8, 4.4
    for bi, bx in enumerate((-5.9, 0.0, 5.9)):
        by = 1.3
        layer(rrect(BW, BH, 0.8), pc.pattern_mat('bld%d' % bi, 'pinstripe', '#e8505a', '#d63f4d', 1.0 / 0.33, ratio=0.25, rib=0.5, rib_freq=3.0, rib_axis='x', grit=0.5), 1.0, 0, loc=(bx, by), name='bld')
        for i in range(6):
            k = 1 - i * 0.15
            layer(ellipse_pts(2.2 * k, 0.6 * k), P('#ee5f68'), 0.1, 1.0 + i * 0.06, holes=[ellipse_pts(2.2 * k - 0.16, 0.6 * k - 0.05)], loc=(bx, by + BH / 2 + 0.05), bevel=0.004)
        for sx in (-1, 1):
            for dy in (3.1, 0.3, -2.7):
                wm = pc.paper_mat('win', '#fff0b8', emit='#ffd98a', emit_strength=2.6, grain=0)
                layer(rrect(0.55, 1.75, 0.2), wm, 0.14, 1.05, loc=(bx + sx * 1.05, by + dy))
    pc.point('wins', (0, 1.3, 4.0), 700, '#ff9a60', 1.2)
    cols = ['#9c2a44', '#b22f4c', '#c23a58', '#d04664']
    for i in range(4):
        top = [(x, y - 4.9 - i * 2.7) for x, y in wave_pts(30, 1.1, 0.78, i * 1.7)]
        layer(top + [(15, -20), (-15, -20)], P(cols[i]), 0.3, 1.4 + i * 0.5, bevel=0.015)
        strip(top, 0.2, 0.05, 1.72 + i * 0.5, P('#f0b0bc'), 0.005, name='crest')
    for i in range(10):
        cube((-6 + rnd.random() * 12, -7.5 + rnd.random() * 6.5, 3.6 + rnd.random() * 0.4), (rnd.random(), rnd.random(), rnd.random() * 3), 1.4)
    cam(34)


def jars():
    pc.setup_cycles(sc, W, H, S, exposure=0.0)
    pc.world_color(sc, '#8a3a4a', 0.5)
    pc.sun('key', None, 2.8, '#ffe8d8', 5.0)
    layer(rrect(30, 40, 0), pc.pattern_mat('bg', 'polka', '#6a2a3a', '#74303f', 0.5, ratio=0.4), 0.1, -1.2)
    for k, (x, y, rx, ry, c) in enumerate(((-5.5, 9, 5.0, 3.6, '#7a2f45'), (4.2, 7.5, 4.2, 3.0, '#5c2430'), (6.5, 10, 3.0, 2.4, '#8a3550'))):
        layer(ellipse_pts(rx, ry), P(c), 0.2, -0.9 + 0.25 * k, loc=(x, y))
    layer(rrect(16, 1.4, 0.2), P('#a23a60'), 0.3, -0.5, loc=(0, -4.6))           # pink shelf
    gold_p = P('#f6d278', rough=0.5, sss=0.5)
    lid_m = pc.pattern_mat('lid', 'pinstripe', '#e8aa3a', '#c88a2a', 3.0, ratio=1.4)
    brass = P('#b8862c', rough=0.5)

    def jar(x, y, s, face):
        zt = 0.8 + 0.8 * s

        def L_(poly, z, mat, h=0.3, dx=0, dy=0):
            layer([(px * s + x + dx * s, py * s + y + dy * s) for px, py in poly], mat, h * s, z, bevel=0.01)
        L_(rrect(5.0, 4.6, 1.7), 0.8, gold_p, 0.8)
        L_(rrect(0.45, 2.4, 0.22), zt, P('#fff6cc'), 0.05, -1.9, 0.3)
        L_(rrect(5.4, 1.0, 0.3), zt - 0.3, lid_m, 0.6, 0, 2.6)
        for sx in (-1, 1):
            L_(ellipse_pts(0.2, 0.2, 16), zt, P('#4a2b1d'), 0.05, sx * 0.85, 0.5)
            L_(ellipse_pts(0.32, 0.32, 20), zt, P('#f0907a'), 0.04, sx * 1.45, -0.2)
        for bx_, by_, br in ((1.2, -1.4, 0.2), (1.8, -0.9, 0.14), (0.5, -1.5, 0.12), (-1.0, -1.6, 0.16)):   # glass bubbles
            ring = ellipse_pts(br, br, 20)
            L_(ring, zt, P('#fff0b8'), 0.04, bx_, by_) if False else layer(xf(ring, x + bx_ * s, y + by_ * s, 0, s), P('#fff0b8'), 0.04 * s, zt, holes=[xf(ellipse_pts(br * 0.7, br * 0.7, 20), x + bx_ * s, y + by_ * s, 0, s)], bevel=0.004)
        if face == 'o':
            L_(ellipse_pts(0.2, 0.28, 16), zt, P('#4a2b1d'), 0.05, 0, -0.45)
        else:
            pts = [(math.cos(a) * 0.5, math.sin(a) * 0.5) for a in [math.pi * (1.1 + 0.8 * i / 12) for i in range(13)]]
            strip([(px * s + x, py * s + y - 0.1 * s) for px, py in pts], 0.07 * s, 0.05, zt, P('#4a2b1d'), 0.004, name='smile')
        L_(rrect(0.95, 0.85, 0.2), zt + 0.3, brass, 0.3, 0, 2.6)
        L_(ellipse_pts(0.07, 0.07, 10), zt + 0.62, P('#3a2810'), 0.03, 0, 2.62)
        sh = [(math.cos(a) * 0.4, 3.15 + math.sin(a) * 0.4) for a in [math.pi * i / 16 for i in range(17)]]
        strip([(px * s + x, py * s + y) for px, py in sh], 0.14 * s, 0.2 * s, zt + 0.3, P('#c9c9cf', rough=0.5), 0.01, name='shackle')
    jar(-1.5, -1.6, 1.2, 'smile')
    jar(3.6, 2.4, 0.88, 'o')
    jar(3.7, -2.5, 0.8, 'smile')
    for i in range(3):
        top = [(x, y - 6.2 - i * 2.4) for x, y in wave_pts(30, 0.6, 0.8, i * 1.3)]
        layer(top + [(15, -20), (-15, -20)], P(['#a1293c', '#b22f4c', '#c23a58'][i]), 0.3, 2.2 + i * 0.4, bevel=0.015)
        strip(top, 0.16, 0.05, 2.52 + i * 0.4, P('#f0b0bc'), 0.005, name='crest')
    gold = pc.gold_mat('key', '#e0b040')

    def key(x, y, rot, ln=3.0):
        ring = ellipse_pts(0.55, 0.55, 28)
        layer(xf(ring, x, y), gold, 0.2, 3.0, holes=[xf(ellipse_pts(0.32, 0.32, 20), x, y)], bevel=0.03)
        c, s_ = math.cos(rot), math.sin(rot)

        def at(px, py):
            return (x + px * c - py * s_, y + px * s_ + py * c)
        layer([at(0.4, -0.13), at(0.4 + ln, -0.13), at(0.4 + ln, 0.13), at(0.4, 0.13)], gold, 0.2, 3.0, bevel=0.03)
        for dx_, hh in ((ln - 0.1, 0.55), (ln + 0.35, 0.8)):
            layer([at(0.4 + dx_ - 0.13, 0.1), at(0.4 + dx_ + 0.13, 0.1), at(0.4 + dx_ + 0.13, -hh + 0.1), at(0.4 + dx_ - 0.13, -hh + 0.1)], gold, 0.2, 3.0, bevel=0.03)
    key(-5.1, 1.52, 0.0, 2.45)           # shaft ends in the keyhole of the big jar
    key(-6.2, 5.8, 0.55, 2.2)
    key(0.8, 7.6, -0.35, 2.2)
    rnd = random.Random(4)
    for i in range(5):
        cube((-5 + rnd.random() * 12, -8.2 + rnd.random() * 1.5, 3.9), (rnd.random(), rnd.random(), rnd.random() * 3), 1.1)
    cam(34)


def party():
    pc.setup_cycles(sc, W, H, S, exposure=0.55, view='Standard')   # Standard keeps candle flames yellow
    pc.world_color(sc, '#3a4668', 0.7)
    pc.sun('moon', None, 0.5, '#9fb4e0', 8.0, frm=(-6.0, 10.0, 14.0))
    layer(rrect(30, 40, 0), pc.pattern_mat('curtain', 'pinstripe', '#1b2236', '#2a3550', 0.7, ratio=3.0), 0.2, -4)
    bunt = ['#d8786e', '#6a96c8', '#e8c860', '#a07ac8', '#6ec090']
    pts = [(-8 + i * 1.0, 8.3 - 1.3 * math.sin(i / 16 * math.pi) * 1.0 + (i / 16) * 1.4) for i in range(17)]
    strip(pts, 0.05, 0.03, -2.4, P('#9aa0b0'), 0.002, name='string')
    for i in range(1, 16):
        x, y = pts[i]
        layer([(x - 0.55, y), (x + 0.55, y), (x, y - 1.1)], P(bunt[i % 5], rough=0.8, emit=bunt[i % 5], emit_strength=0.12), 0.05, -2.3, bevel=0.004)
    for x, y, c in ((-5.0, 2.2, '#d84a4a'), (4.9, 5.4, '#d8c040'), (5.3, 0.6, '#e45c9a')):
        layer(ellipse_pts(1.5, 1.85), P(c, rough=0.3), 0.3, -2.0, loc=(x, y))
        strip([(x, y - 1.85), (x + 0.2, y - 4.5), (x - 0.1, y - 7)], 0.05, 0.03, -2.0, P('#8a8a98'), 0.002, name='bstring')
    # man (bigger, lit from below)
    mx, my, s = 0, 3.0, 0.95

    def mp(poly, z, mat, h=0.3, dx=0, dy=0):
        layer([(px * s + mx + dx * s, py * s + my + dy * s) for px, py in poly], mat, h * s, z, bevel=0.012)
    skin, hair = P('#eaa07a', sss=0.35, grit=0.5), P('#4a2b22', grit=0.9, mottle=0.3)
    mp(rrect(9.4, 7.0, 1.5), -0.4, pc.pattern_mat('jumper', 'hstripes', '#6c7188', '#5e6379', 9.0, ratio=0.5, rib=0.6, rib_freq=9.0, rib_axis='y', grit=0.55), 0.3, 0, -5.0)
    mp(rrect(5.7, 5.8, 1.9), 0, skin, 0.45)
    mp(rrect(6.1, 3.2, 1.5), -0.12, hair, 0.5, 0, 2.15)
    mp(rrect(5.8, 1.5, 0.7), 0.25, hair, 0.3, 0, 2.45)
    for sx in (-1, 1):
        mp(ellipse_pts(0.5, 0.75, 20), -0.1, skin, 0.2, sx * 3.0, 0.1)
        mp(ellipse_pts(0.95, 0.95, 28), 0.4, P('#e88a66'), 0.12, sx * 2.2, -1.05)
        mp(ellipse_pts(0.78, 0.78, 28), 0.4, P('#e49a74'), 0.06, sx * 1.35, 1.05)
        mp(rrect(1.7, 0.45, 0.2), 0.4, hair, 0.2, sx * 1.4, 2.15)
    mp(blob_pts(0.62, 0.95, 0.04, 5), 0.5, skin, 0.4, 0, -0.2)
    must = [(-2.25 + 4.5 * i / 40, 0.0 - 1.6 * ((i - 20) / 20.0) ** 2) for i in range(41)] + [(2.25 - 4.5 * i / 40, -1.1 - 0.5 * ((i - 20) / 20.0) ** 2) for i in range(41)]   # thick arch crescent, ends point down
    mp(must, 0.75, hair, 0.3, 0, -0.45)
    mp(ellipse_pts(0.55, 0.7, 28), 0.38, P('#e08a62'), 0.05, 0, -2.15)       # lip rim
    mp(ellipse_pts(0.38, 0.5, 20), 0.46, P('#4a1f1f', grit=0.4), 0.05, 0, -2.15)
    for sx in (-1, 1):
        strip([(mx + (sx * 1.35 + dx_) * s, my + (1.0 + 0.2 * math.sin((dx_ + 0.5) * 3.14)) * s) for dx_ in [-0.5 + i / 8 for i in range(9)]], 0.08, 0.05, 0.5, P('#1b1313'), 0.004)
    # party hat: radial candy stripes + pompom
    hb = (mx + 1.0, my + 3.7 * s)
    ang = -0.12
    apex = (0.1, 3.6)
    for k in range(6):
        b0 = -1.3 + k * 0.433
        b1 = b0 + 0.433
        layer(xf([(b0, 0), (b1, 0), apex], hb[0], hb[1], ang, 1.0), P('#d6483f' if k % 2 else '#f1e4dc'), 0.2, 0.7, bevel=0.005)
    layer(xf(rrect(2.9, 0.4, 0.15), hb[0], hb[1], ang), P('#e0a82a'), 0.25, 0.7)
    disc(0.4, P('#e0a82a'), 0.2, 0.75, (hb[0] + 0.3, hb[1] + 3.75))
    # cake + striped candles + icing drips
    cx, cy = 0, -7.3
    layer(ellipse_pts(4.6, 0.55), P('#f3dcc4'), 0.2, 0.9, loc=(cx, cy - 2.2))
    layer(rrect(7.2, 3.8, 0.3), P('#f0a66a', sss=0.4), 0.8, 1.0, loc=(cx, cy))
    layer(rrect(7.2, 0.6, 0.1), P('#e0533a'), 0.1, 1.8, loc=(cx, cy - 0.3))
    for i in range(24):
        disc(0.09, P('#fff4e8'), 0.04, 1.9, (cx - 3.45 + i * 0.3, cy - 0.3), 10)
    layer(rrect(7.5, 0.7, 0.3), P('#fbe9c9'), 0.4, 1.8, loc=(cx, cy + 1.75))
    for i in range(9):
        layer([(cx - 3.6 + i * 0.9 - 0.3, cy + 1.45), (cx - 3.6 + i * 0.9 + 0.3, cy + 1.45), (cx - 3.6 + i * 0.9, cy + 0.65)], P('#fbe9c9'), 0.4, 1.8, bevel=0.01)
    stripe = ['#e56a5a', '#f1c24d', '#78b88a', '#e58bb0', '#f0e0d0']
    rnd = random.Random(2)
    for r in range(3):
        for i in range(9):
            x, y = cx - 3.2 + i * 0.8 + (r % 2) * 0.4 + rnd.uniform(-0.06, 0.06), cy + 2.3 + r * 0.55
            tilt = rnd.uniform(-0.1, 0.1)
            layer(xf(rrect(0.17, 1.5, 0.05), x, y + 0.75, tilt), P(stripe[(i + r) % 5]), 0.1, 1.9 - r * 0.1)
            layer(xf(teardrop_pts(0.4, 0.7), x - tilt * 1.5, y + 1.5, tilt * 0.5), G('#ffb81c', 1.5), 0.08, 2.0 - r * 0.1, bevel=0.01)
    pc.point('c1', (0, -4.2, 5.0), 700, '#ff9a3d', 1.0)
    pc.point('c2', (0, 0.5, 6.5), 900, '#ff8a30', 1.4)
    layer(rrect(14, 4.4, 0), pc.pattern_mat('cloth', 'gingham', '#f1b9a4', '#d9553f', 0.5, ratio=0.5), 0.3, 0.6, loc=(0, -11.8))
    layer(rrect(14, 0.7, 0), P('#f1c8b0'), 0.4, 0.8, loc=(0, -9.6))
    cam(30)


def person(x, y, s, shirt='#5a5f78', hair='#4a2b22', skin_c='#eaa07a', mustache=True, glasses=False, bun=False, side=False,
           bald=False, legs=False, pants='#2f3a5a', candle=False, glow='#ff9a3d', watts=60, shirt_pat=None, sit=False, cheek='#e88a66',
           lid=True, pigtails=False, torso_h=6.2):
    """Deadpan paper person (head 5.7 wide, torso 8.4 wide). All depths scale with s. Returns nothing; builds layers in place."""
    skin, hr = P(skin_c, sss=0.35), P(hair)

    def mp(poly, z, mat, h=0.3, dx=0, dy=0):
        layer([(px * s + x + dx * s, py * s + y + dy * s) for px, py in poly], mat, h * s, z * s, bevel=0.012 * s + 0.004)
    tmat = pc.pattern_mat('sh%d' % len(_cache), shirt_pat[0], shirt_pat[1], shirt_pat[2], shirt_pat[3], ratio=0.3) if shirt_pat else P(shirt)
    if legs and not sit:
        for sx in (-1, 1):
            mp(rrect(2.7, 8.6, 0.5), -0.5, P(pants), 0.35, sx * 1.9, -12.0)
            mp(rrect(3.1, 1.2, 0.55), -0.3, P('#7a4a32'), 0.4, sx * 2.0, -16.6)
    mp(rrect(8.4, torso_h, 1.4), -0.4, tmat, 0.3, 0, -4.6)
    mp(rrect(5.7, 5.8, 1.9), 0, skin, 0.45)
    if not bald:
        mp(rrect(6.1, 3.2, 1.5), -0.12, hr, 0.5, 0, 2.15)
        mp(rrect(5.8, 1.5, 0.7), 0.25, hr, 0.3, 0, 2.45)
    else:
        mp(blob_pts(0.25, 0.55, 0.1, 2), 0.5, hr, 0.1, 0.2, 3.3)
    if side:
        for sx in (-1, 1):
            mp(rrect(1.5, 6.2, 0.7), -0.1, hr, 0.4, sx * 3.1, -0.6)
    if bun:
        mp(ellipse_pts(1.5, 1.5, 24), -0.2, hr, 0.5, 0, 4.4)
    if pigtails:
        for sx in (-1, 1):
            mp(ellipse_pts(0.9, 1.2, 20), -0.1, hr, 0.4, sx * 3.5, 1.2)
            mp(rrect(0.8, 0.35, 0.1), 0.2, P('#d8453d'), 0.1, sx * 3.0, 2.0)
    for sx in (-1, 1):
        mp(ellipse_pts(0.5, 0.75, 20), -0.1, skin, 0.2, sx * 3.0, 0.1)
        mp(ellipse_pts(0.95, 0.95, 28), 0.55, P(cheek), 0.12, sx * 2.2, -1.05)
        mp(ellipse_pts(0.78, 0.78, 28), 0.55, P('#e49a74'), 0.06, sx * 1.35, 1.05)
        mp(ellipse_pts(0.55, 0.55, 24), 0.65, P('#f4efe6'), 0.08, sx * 1.35, 1.05)
        mp(ellipse_pts(0.24, 0.24, 16), 0.75, P('#1b1313'), 0.05, sx * 1.35, 1.2)
        if lid:
            mp(rrect(1.5, 0.85, 0.4), 0.85, skin, 0.1, sx * 1.35, 1.45)
        if glasses:
            ring_ = ellipse_pts(0.95, 0.95, 28)
            layer([(px * s + x + sx * 1.35 * s, py * s + y + 1.05 * s) for px, py in ring_], P('#5a4a52'), 0.1 * s, 0.9 * s,
                  holes=[[(px * 0.82 * s + x + sx * 1.35 * s, py * 0.82 * s + y + 1.05 * s) for px, py in ring_]], bevel=0.005)
        mp(rrect(1.7, 0.45, 0.2), 0.55, hr, 0.2, sx * 1.4, 2.15)
    mp(blob_pts(0.62, 0.95, 0.04, 5), 0.6, skin, 0.4, 0, -0.2)
    if mustache:
        must = [(-2.4 + 4.8 * i / 40, -0.1 - 1.4 * ((i - 20) / 20.0) ** 2) for i in range(41)] + [(2.4 - 4.8 * i / 40, -0.95 - 0.55 * ((i - 20) / 20.0) ** 2) for i in range(41)]   # smooth crescent
        mp(must, 0.85, hr, 0.3, 0, -0.45)
    strip([(x - 0.55 * s, y - 2.15 * s), (x + 0.55 * s, y - 2.15 * s)], 0.13 * s, 0.05 * s, 0.6 * s, P('#7a3b30'), 0.003)
    if candle:
        mp(rrect(0.5, 2.8, 0.12), 0.9, P('#efe0d8'), 0.15, 0, -5.1)
        for k in range(3):
            mp(xf(rrect(0.5, 0.35, 0.05), 0, 0, 0.5), 1.0, P('#d9453d'), 0.05, 0, -4.4 - k * 0.85)
        mp(teardrop_pts(0.95, 1.7), 1.1, G('#ffc21e', 1.6), 0.1, 0, -3.65)
        mp(teardrop_pts(0.5, 0.95), 1.2, G('#fff0a0', 1.9), 0.08, 0, -3.62)
        mp(rrect(2.0, 1.6, 0.6), 1.0, skin, 0.35, 0, -6.3)
        pc.point('cand', (x, y - 3.5 * s, 3.5), watts, glow, 0.3)


def family():
    pc.setup_cycles(sc, W, H, S, exposure=0.9, view='Standard')
    pc.world_color(sc, '#4a4a70', 0.8)
    pc.sun('moon', None, 0.35, '#9fa4d8', 8.0, frm=(-6.0, 10.0, 16.0))
    layer(rrect(80, 80, 0), P('#1c1a2c'), 0.2, -40)      # behind the crowd quads (which sit at z=-12; layers are Z-compressed, raw meshes are not)
    # thousands of tiny glowing candle people far behind, one mesh of quads -> bokeh through DOF
    rnd = random.Random(5)
    verts, faces = [], []
    n = 0
    for row in range(36):
        for col in range(50):
            px = -23 + col * 0.95 + (row % 2) * 0.45 + rnd.uniform(-0.15, 0.15)
            py = 17 - row * 0.62
            r_ = rnd.uniform(0.05, 0.095)
            b = len(verts)
            verts += [(px - r_, py - r_, -12.0), (px + r_, py - r_, -12.0), (px + r_, py + r_, -12.0), (px - r_, py + r_, -12.0)]
            faces.append((b, b + 1, b + 2, b + 3))
    pc.mesh_from('crowd', verts, faces, G('#ffd98a', 1.0), bevel=0)
    layer(rrect(40, 3.2, 0), P('#2a2230'), 0.4, -1.0, loc=(0, -9.8))                       # stage
    cast = [
        dict(x=-5.3, y=-2.6, s=0.30, shirt='#f4a2a6', shirt_pat=('polka', '#f4a2a6', '#fbe6e2', 1.1), hair='#2a1a18', pigtails=True, mustache=False, legs=True, pants='#e8584a', glow='#ff9a8a', candle=True, skin_c='#f2b090'),
        dict(x=-3.1, y=-2.3, s=0.34, shirt='#6fc08a', hair='#6b3a2a', side=True, mustache=False, legs=True, glow='#9cff9c', candle=True, skin_c='#eba684'),
        dict(x=0.2, y=-2.2, s=0.36, shirt='#f4f0ea', hair='#3d2a24', legs=True, glow='#fff1c8', candle=True),
        dict(x=3.6, y=-2.3, s=0.34, shirt='#a8744a', hair='#e9e6e2', glasses=True, legs=True, glow='#ffb86a', candle=True),
        dict(x=6.7, y=-2.5, s=0.31, shirt='#b08ad8', hair='#d9d6d6', glasses=True, bun=True, mustache=False, legs=True, pants='#6a5a8a', glow='#ff9ad0', candle=True),
    ]
    for c in cast:
        person(**c)
    # baby + cupcake in the corner
    person(-6.3, -6.3, 0.26, shirt='#d8e4f0', bald=True, mustache=False, sit=True, skin_c='#f2c4a8', cheek='#f0907a')
    disc(0.7, P('#e8a0c0'), 0.3, 0.6, (-4.6, -8.3))
    pc.point('cup', (-4.6, -7.3, 3.0), 30, '#ffb04a', 0.3)
    layer(teardrop_pts(0.5, 0.9), G('#ffc21e', 1.8), 0.08, 1.0, loc=(-4.6, -7.5), bevel=0.01)
    cam(34, fstop=0.12, focus=34)   # wide aperture: the far crowd melts into bokeh


def mito(ribbon=False):
    pc.setup_cycles(sc, W, H, S, exposure=0.1)
    pc.world_color(sc, '#4a2830', 0.45)
    pc.sun('key', None, 2.4, '#ffe8d8', 5.0)
    layer(rrect(40, 50, 0), P('#2e1b20'), 0.1, -3)
    layers_ = [(6.3, 9.9, '#b8c0c8', 0.3), (5.8, 9.4, '#e9a090', 0.3), (5.3, 8.9, '#d9a838', 0.3), (4.85, 8.45, '#a01f32', 0.3), (4.45, 8.05, '#4a1822', 0.3)]
    z = -2.0
    for rx, ry, col, h in layers_:
        layer(ellipse_pts(rx, ry, 96), P(col, rough=0.85), h, z, loc=(0, 0), bevel=0.02)
        z += 0.4
    for i in range(52):                                                  # gold beads in the gold ring
        a = i / 52 * math.tau
        disc(0.22, P('#e8c050', rough=0.5), 0.12, 0.2, (math.cos(a) * 5.08, math.sin(a) * 8.68), 16)
    layer(blob_pts(2.0, 1.8, 0.08, 4), P('#e07a8a'), 0.25, 0.4, loc=(-2.3, 5.6))
    layer(blob_pts(2.1, 1.7, 0.08, 7), P('#7a1f30'), 0.25, 0.4, loc=(2.5, 5.8))
    # long serpentine cristae tube: 5 runs joined by U-turns
    path = []
    for r in range(5):
        y0 = 2.9 - r * 1.75
        xs_ = [-3.4 + 6.8 * i / 40 for i in range(41)]
        if r % 2: xs_ = xs_[::-1]
        for x in xs_:
            path.append((x, y0 + 0.32 * math.sin(x * 2.2 + r)))
        if r < 4:
            end_x = xs_[-1]; sgn = 1 if end_x > 0 else -1
            for k in range(1, 9):
                a = -math.pi / 2 + math.pi * k / 9
                path.append((end_x + sgn * 0.55 * math.cos(a), y0 - 0.875 + 0.875 * -math.sin(a) * -1 - 0.0))
    strip(path, 1.0, 0.2, 0.5, P('#d98a9a'), 0.03, name='tube')
    rnd = random.Random(8)
    for i in range(34):
        disc(0.22, P('#e8c050', rough=0.5), 0.14, 0.85, (rnd.uniform(-3.5, 3.5), rnd.uniform(-5.2, 3.4)), 16)
    strip([(0, 9.2), (0, 3.5)], 0.8, 0.2, 0.6, P('#8a1a2c'), 0.02, name='pipe')                 # input pipe
    arrow = [(0, 0), (0.8, 0.7), (0.3, 0.7), (0.3, 1.8), (-0.3, 1.8), (-0.3, 0.7), (-0.8, 0.7)]
    layer(arrow, P('#7fd38a'), 0.12, 1.0, loc=(1.6, 7.4))
    if ribbon:
        gold = P('#c9a23c', rough=0.6)
        layer(rrect(1.6, 20.0, 0.8), gold, 0.3, 1.4, loc=(0, 0), bevel=0.04)
        layer(rrect(13.0, 1.5, 0.7), gold, 0.3, 1.5, loc=(0, 0.2), rot=0.0, bevel=0.04)
        layer(rrect(1.5, 17.0, 0.8), gold, 0.3, 1.7, loc=(0, 0), rot=math.pi / 3.4, bevel=0.04)
        for sx in (-1, 1):                                                                     # bow loops + knot
            layer(blob_pts(1.9, 1.2, 0.1, 3 + sx), gold, 0.3, 2.4, loc=(sx * 1.9, 0.4), rot=sx * 0.35)
        disc(0.75, P('#b8912e', rough=0.6), 0.35, 2.7, (0, 0.2), 24)
    cam(29)


def pipes():
    pc.setup_cycles(sc, W, H, S, exposure=0.15)
    pc.world_color(sc, '#4a2830', 0.45)
    pc.sun('key', None, 2.5, '#ffe8d8', 5.0)
    layer(rrect(40, 50, 0), P('#2e1b20'), 0.1, -3)

    def arc_ring(r1, r2, a0, a1, n=48):
        o = [(math.cos(a0 + (a1 - a0) * i / n) * r1, math.sin(a0 + (a1 - a0) * i / n) * r1) for i in range(n + 1)]
        i_ = [(math.cos(a0 + (a1 - a0) * i / n) * r2, math.sin(a0 + (a1 - a0) * i / n) * r2) for i in range(n, -1, -1)]
        return o + i_
    cx, cy = -1.0, -9.0
    for (r1, r2, col, z) in ((16.0, 14.6, '#c8ccd0', -0.5), (14.6, 13.8, '#e4a08e', -0.1), (13.8, 12.2, '#e2b84a', 0.3), (12.2, 11.0, '#a21f32', 0.7)):
        layer([(px + cx, py + cy) for px, py in arc_ring(r1, r2, 0.2, 2.9)], P(col), 0.3, z, bevel=0.02)
    for i in range(30):
        a = 0.25 + i * 0.09
        disc(0.28, P('#e8c050', rough=0.5), 0.12, 0.62, (cx + math.cos(a) * 13.0, cy + math.sin(a) * 13.0), 16)
    layer(blob_pts(3.4, 3.0, 0.06, 9), P('#e07a8a'), 0.3, 0.2, loc=(-6.5, -9.5))
    strip([(3, 12), (3, -14)], 1.5, 0.3, 1.2, P('#7a1a28'), 0.03, name='pipe')
    strip([(3, 12), (3, -14)], 0.9, 0.1, 1.5, P('#a82438'), 0.02, name='pipe2')
    for i in range(8):
        disc(0.5, P('#f0c443', rough=0.5), 0.15, 1.65, (3, 11 - i * 3.1), 20)
    strip([(-10, -4), (3, -4)], 1.5, 0.3, 1.25, P('#7a1a28'), 0.03, name='branch')
    arrow = [(0, 0), (1.3, 1.0), (1.3, 0.4), (3.0, 0.4), (3.0, -0.4), (1.3, -0.4), (1.3, -1.0)]
    layer(arrow, P('#7fd38a'), 0.12, 1.8, loc=(0.3, 6.6))
    gate_pts = [(-8 + i * 0.5, 1.2 + (i * 0.5) * 0.55) for i in range(10)]
    layer(xf(rrect(5.2, 0.55, 0.2), -7.0, 1.2, 0.5), P('#f1ebe6'), 0.15, 2.0)
    for i in range(7):
        layer(xf(rrect(0.35, 0.55, 0.05), -7.0 + (-2.2 + i * 0.74) * math.cos(0.5), 1.2 + (-2.2 + i * 0.74) * math.sin(0.5), 0.5), P('#d9453d'), 0.05, 2.16)
    layer(rrect(0.5, 2.2, 0.1), P('#3a3a40'), 0.2, 1.9, loc=(-7, -0.2))
    rnd = random.Random(2)
    for i in range(6):
        px, py = -9 + rnd.random() * 6, -9 + rnd.random() * 4
        hexo = [(math.cos(k * math.pi / 3) * 0.9, math.sin(k * math.pi / 3) * 0.9) for k in range(6)]
        hexi = [(math.cos(k * math.pi / 3) * 0.72, math.sin(k * math.pi / 3) * 0.72) for k in range(6)]
        layer(xf(hexo, px, py, rnd.random() * 3), P('#8a6fbf'), 0.08, 2.0, holes=[xf(hexi, px, py, 0)], bevel=0.005)
    cam(40)


def gym():
    pc.setup_cycles(sc, W, H, S, exposure=-0.1, view='Standard')
    pc.world_color(sc, '#d6e6d6', 0.5)
    pc.sun('key', None, 2.2, '#fff4e6', 4.0)
    layer(rrect(30, 40, 0), pc.pattern_mat('wall', 'hstripes', '#bcdcbe', '#a8c8aa', 0.55, ratio=0.5), 0.2, -2)
    layer(rrect(30, 9, 0), P('#638e6d'), 0.2, -1.6, loc=(0, -13))
    layer(rrect(30, 3.2, 0), P('#8a5a3a'), 0.2, -1.4, loc=(0, -16.4))
    for i in range(7):                                                         # calendar tiles
        yel = i >= 5
        layer(rrect(1.7, 1.5, 0.1), P('#f4f4f2'), 0.2, -1.0, loc=(-5.4 + i * 1.8, 10.2))
        layer(rrect(1.7, 0.4, 0.05), P('#f0c040' if yel else '#d9453d'), 0.2, -0.8, loc=(-5.4 + i * 1.8, 10.85))
    layer(rrect(9, 0.8, 0.3), P('#2b3040'), 0.4, -1.2, loc=(0, -11.2))        # platform
    person(0, 3.6, 0.6, shirt='#cf5346', shirt_pat=('hstripes', '#cf5346', '#c24a3e', 2.0), hair='#3a2a22', legs=False, torso_h=8.2, cheek='#e58a66', lid=True)
    for sx in (-1, 1):
        layer(rrect(2.3, 7.4, 0.6), P('#2a3552'), 0.35, -0.5, loc=(sx * 1.3, -4.2))
        layer(rrect(2.8, 1.3, 0.6), P('#f4f4f2'), 0.4, -0.3, loc=(sx * 1.4, -8.9))
        layer(rrect(2.8, 0.36, 0.2), P('#d9453d'), 0.1, 0.1, loc=(sx * 1.4, -9.2))
        layer(rrect(1.2, 3.8, 0.5), P('#eaa07a'), 0.3, 0.9, loc=(sx * 3.9, 0.5))                 # forearms straight up
        disc(0.75, P('#eaa07a'), 0.3, 1.0, (sx * 3.9, 2.4), 24)                                    # fists on the bar
    layer(rrect(13.0, 0.28, 0.1), P('#c3cbd6', rough=0.4), 0.2, 0.05, loc=(0, 2.4))               # barbell across the shoulders
    for sx in (-1, 1):
        layer(rrect(0.8, 5.4, 0.3), P('#2a2a30'), 0.4, 0.4, loc=(sx * 5.7, 2.4))
        layer(rrect(0.5, 3.2, 0.2), P('#d9453d'), 0.4, 0.5, loc=(sx * 6.4, 2.4))
        layer(rrect(0.5, 4.2, 0.2), P('#2a2a30'), 0.4, 0.4, loc=(sx * 5.0, 2.4))
    cam(32)


FN = {
    'belt': belt, 'breakfast': lambda: breakfast('polka'), 'breakfast_stripes': lambda: breakfast('stripes'), 'breakfast_gingham': lambda: breakfast('gingham'),
    'cave': cave, 'cave_hands': lambda: cave(True), 'town': town, 'jars': jars, 'party': party,
    'family': family, 'mito': mito, 'mito_ribbon': lambda: mito(True), 'pipes': pipes, 'gym': gym,
}
if SCENE != '__lib__':
    FN[SCENE]()
    pc.finish(sc, OUT)
