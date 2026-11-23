"""Quilled-paper cell macro in Cycles.
Run:  D:\\blender\\blender.exe -b --python cell.py -- out.png [width height samples]
"""
import sys, os, math, random
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import bpy
import pc_lib as pc

argv = sys.argv[sys.argv.index('--') + 1:] if '--' in sys.argv else []
OUT = argv[0] if argv else 'cell.png'
W = int(argv[1]) if len(argv) > 1 else 540
H = int(argv[2]) if len(argv) > 2 else 960
S = int(argv[3]) if len(argv) > 3 else 96

pc.clear()
sc = bpy.context.scene
pc.setup_cycles(sc, W, H, S, exposure=-0.9)
pc.world_color(sc, '#4a2530', 0.25)
R = 10.0
rnd = random.Random(7)


def M(n, c, **k):
    return pc.paper_mat(n, c, **k)


def disc(name, r, h, z, mat, seg=128):
    v, f = pc.disc_geo(r, h, z, seg)
    return pc.mesh_from(name, v, f, mat, bevel=0.015)


disc('rim', R + 1.6, 0.3, 0.0, M('rimM', '#d98f86'))
disc('goldbed', R + 1.0, 0.2, 0.3, M('goldM', '#e2b840'))
disc('plate', R - 1.0, 0.2, 0.5, M('plateM', '#f0cabe', sss=0.3))

# tiny cream spirals on the gold ring
tiny = pc.mesh_from('tinyc', *pc.band_geo(pc.spiral_pts(3.2, 0.36, 0.04, 16), 0.06, 0.2), M('tinyM', '#f3ecc8'), bevel=0.01)
for row, (rr, nn) in enumerate(((R - 0.05, 62), (R + 0.5, 70))):
    for i in range(nn):
        a = i / nn * math.tau + row * 0.04
        o = tiny.copy()
        o.location = (math.cos(a) * rr, math.sin(a) * rr, 0.5 * pc.ZK)
        o.rotation_euler[2] = i * 1.7
        sc.collection.objects.link(o)

# white walls: pinwheel + ring + centre coil
wall = M('wallM', '#f1ebe6', sss=0.25)
for i in range(5):
    pts = []
    for k in range(25):
        r = 1.5 + (k / 24) * (R - 2.5)
        a = i / 5 * math.tau + 0.3 + 0.55 * k / 24
        pts.append((r * math.cos(a), r * math.sin(a)))
    pc.mesh_from('wall%d' % i, *pc.band_geo(pts, 0.24, 0.75, 0.7), wall, bevel=0.02)
ring = [((R - 1.05) * math.cos(k / 128 * math.tau), (R - 1.05) * math.sin(k / 128 * math.tau)) for k in range(128)]
pc.mesh_from('ringwall', *pc.band_geo(ring, 0.3, 0.75, 0.7, closed=True), wall, bevel=0.02)
pc.mesh_from('centre', *pc.band_geo(pc.spiral_pts(9, 2.0, 1.05, 48), 0.085, 0.55, 0.7), wall, bevel=0.008)
disc('goldcore', 1.0, 0.3, 0.7, M('core', '#f0b83a'))
for k in range(36):
    a = k * 2.4; rr = 0.78 * math.sqrt((k + 0.5) / 36)
    dv, df = pc.disc_geo(0.07, 0.05, 1.0, 10)
    pc.mesh_from('dot', [(vx + rr * math.cos(a), vy + rr * math.sin(a), vz) for vx, vy, vz in dv], df, M('dotM', '#c8902a'), bevel=0)

# coil field (shared meshes, per-object colour)
cm = M('coilM', '#ffffff', rough=0.8, objcolor=True, sss=0.2)
variants = []
for k in range(3):
    o = pc.mesh_from('coilv%d' % k, *pc.band_geo(pc.spiral_pts(8 + k, 0.5 - 0.02 * k, 0.03, 20), 0.034, 0.34), cm, bevel=0.006)
    variants.append(o.data)
    bpy.data.objects.remove(o)
sp = 1.04
col = bpy.data.collections.new('coils')
sc.collection.children.link(col)
j = 0
y = -R
while y <= R:
    x = -R + (sp / 2 if j % 2 else 0)
    while x <= R:
        px, py = x + rnd.uniform(-.11, .11), y + rnd.uniform(-.11, .11)
        r = math.hypot(px, py)
        if 2.3 < r < R - 1.6 and rnd.random() > 0.1:
            ob = bpy.data.objects.new('c', rnd.choice(variants))
            col.objects.link(ob)
            s = rnd.uniform(0.85, 1.12)
            ob.location = (px, py, 0.7 * pc.ZK)
            ob.rotation_euler = (rnd.uniform(-.03, .03), rnd.uniform(-.03, .03), rnd.uniform(0, 6.28))
            ob.scale = (s, s, rnd.uniform(0.7, 1.7))
            v = rnd.uniform(0.62, 1.0) * (0.55 if rnd.random() < 0.08 else 1)
            ob.color = (0.56 * v, 0.11 * v, 0.17 * v, 1)
        x += sp
    y += sp * 0.866
    j += 1

# red + blue rings
for (x, y, c) in [(2.6, -5.2, '#c0283a'), (4.3, -5.8, '#4a3f9a')]:
    rg = [(x + 0.6 * math.cos(k / 48 * math.tau), y + 0.6 * math.sin(k / 48 * math.tau)) for k in range(48)]
    pc.mesh_from('hole', *pc.band_geo(rg, 0.2, 0.6, 0.7, closed=True), M('h' + c, c), bevel=0.01)

# light + camera
pc.sun('key', (38, 0, 38), 3.0, '#fff0e0', 3.0)
pc.point('ember', (4.3, -5.4, 1.6), 90, '#ff7a28', 0.25)
pc.camera((0, -5.5, 34), (8, 0, 0), lens=85, focus=33.0, fstop=0.5)
sc.render.filepath = OUT
bpy.ops.render.render(write_still=True)
print('RENDERED', OUT)
