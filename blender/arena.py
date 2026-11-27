"""Arena background (1920x1080) as a layered paper diorama: sky + clouds, colonnade with arches, crowd tiers,
barrier wall with banners, sand floor. Perspective camera with shallow DOF so the crowd softens like a busy backdrop.

  D:/blender/blender.exe -b --python blender/arena.py -- <out.png> [W H samples]

Frame at the fighters plane: 50.5 x 28.4 units (x -25.25..25.25, y -9.5..18.9), feet line around y = -4.5.
"""
import bpy, sys, os, math, random
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import sprite_lib as sl  # noqa: E402
pc = sl.pc

argv = sys.argv[sys.argv.index('--') + 1:] if '--' in sys.argv else []
OUT = os.path.abspath(argv[0] if argv else os.path.join(sl.GAME, 'assets', 'bg', 'arena.png'))
W = int(argv[1]) if len(argv) > 1 else 1920
H = int(argv[2]) if len(argv) > 2 else 1080
S = int(argv[3]) if len(argv) > 3 else 96
os.makedirs(os.path.dirname(OUT), exist_ok=True)

sc = sl.setup(samples=S, world='#eef3f8', world_strength=0.6, sun_strength=3.0)
sc.render.film_transparent = False
sc.render.resolution_x, sc.render.resolution_y = W, H
rnd = random.Random(7)
X0, X1, Y0, Y1 = -27.0, 27.0, -10.5, 20.5          # build a little wider than the frame


def L(pts, mat, z, h=0.15, holes=(), name='l'):
    return pc.layer(pts, mat, h=h, z=z, holes=holes, name=name, bevel=0.015)


def R(x0, y0, x1, y1, r=0.0):
    return pc.xf(pc.rrect(x1 - x0, y1 - y0, r), (x0 + x1) / 2, (y0 + y1) / 2)


def objcolor_paper(name, fiber='washi'):
    """paper whose tint comes from each object's colour (one material for hundreds of spectators)"""
    m = bpy.data.materials.new(name)
    t = sl._NT(m)
    t.basics(0.86, 0.06)
    v = t.coords(0.5)
    oi = t.N.new('ShaderNodeObjectInfo')
    fc = t.tex(fiber + '_col', v)
    norm = t.mix(fc, sl._inv(sl._mean(fiber + '_col')))
    t.L.new(t.mix(oi.outputs['Color'], t.mix((1, 1, 1, 1), norm, 0.9, 'MIX')), t.bsdf.inputs['Base Color'])
    t.L.new(t.normal(t.tex(fiber + '_nrm', v, True), 0.35), t.bsdf.inputs['Normal'])
    return m


# ---------------------------------------------------------------- sky
L(R(X0, 8, X1, Y1), sl.tex_paper('sky', '#7db3e2', 'water', 0.7, scale=0.08), 0.0, 0.1, name='sky')
L(R(X0, 8, X1, 15.5), sl.tex_paper('sky_lo', '#a9cdec', 'water', 0.7, scale=0.08), 0.12, 0.06, name='sky_band')
cloud = sl.tex_paper('cloud', '#fbfaf6', 'white', 0.6, scale=0.15)
for i in range(9):
    cx = X0 + 3 + i * 6.2 + rnd.uniform(-1, 1)
    cy = rnd.uniform(16.5, 19.5)
    for j in range(3):
        L(pc.xf(pc.blob_pts(rnd.uniform(1.2, 2.2), rnd.uniform(0.7, 1.1), 0.08, rnd.randint(0, 99)), cx + (j - 1) * 1.3, cy + (0.4 if j == 1 else 0)),
          cloud, 0.3 + j * 0.05, 0.08, name='cloud')

# ---------------------------------------------------------------- colonnade with arches (sky shows through)
stone = sl.tex_paper('stone', '#ecd6b4', 'washi', 0.9, scale=0.12)
stone_d = sl.tex_paper('stone_d', '#d8b98f', 'washi', 0.9, scale=0.12)
stone_r = sl.tex_paper('stone_r', '#e7b9a0', 'washi', 0.9, scale=0.12)
arches = []
for i in range(17):
    ax = X0 + 1.6 + i * 3.3
    pts = [(ax - 1.05, 14.2), (ax + 1.05, 14.2)]
    pts += [(ax + 1.05 * math.cos(math.radians(a)), 17.0 + 1.05 * math.sin(math.radians(a))) for a in range(0, 181, 10)]
    arches.append(list(reversed(pts)))
L(R(X0, 13.6, X1, 19.4), stone, 1.0, 0.18, holes=arches, name='colonnade')
L(R(X0, 19.2, X1, 20.3), stone_d, 1.3, 0.1, name='cornice')
L(R(X0, 13.4, X1, 14.2), stone_r, 1.3, 0.1, name='ledge')
for i in range(17):
    ax = X0 + 1.6 + i * 3.3
    L(R(ax - 1.3, 14.2, ax - 1.12, 17.2), stone_d, 1.3, 0.05, name='pilaster')

# ---------------------------------------------------------------- crowd tiers
body_m = objcolor_paper('crowd_body')
head_m = objcolor_paper('crowd_head', 'water')
CLOTH = ['#c0392b', '#2e86c1', '#f1c40f', '#27ae60', '#8e44ad', '#e67e22', '#ecf0f1', '#16a085', '#d35400', '#5d6d7e', '#e84393', '#f5cba7']
SKIN = ['#f2c29b', '#e8a77c', '#c98b66', '#9a6646', '#f6d3b5']
step = sl.tex_paper('step', '#d6bc95', 'washi', 0.9, scale=0.12)
step_d = sl.tex_paper('step_d', '#c3a47b', 'washi', 0.9, scale=0.12)
TIERS = 5
for t in range(TIERS):
    ytop = 13.4 - t * 1.85
    z = 1.6 + t * 0.9
    # spectators sit on this tier: heads/bodies poke above the next step band
    n = 46 + rnd.randint(-2, 2)
    for k in range(2 * n):
        row = k % 2
        x = X0 + (k // 2 + rnd.uniform(0.05, 0.95) + 0.5 * row) * (X1 - X0) / n
        y = ytop - 1.15 + 0.42 * (1 - row) + rnd.uniform(-0.1, 0.1)
        z = 1.6 + t * 0.9 + row * 0.22 + (k // 2) * 0.0035
        sc_ = rnd.uniform(1.0, 1.2)
        b = L(pc.xf(pc.rrect(0.95 * sc_, 1.3 * sc_, 0.38), x, y), body_m, z, 0.08, name='body')
        b.color = (*pc.lin(rnd.choice(CLOTH))[:3], 1)
        hd = L(pc.xf(pc.ellipse_pts(0.3 * sc_, 0.33 * sc_, 24), x + rnd.uniform(-0.05, 0.05), y + 0.85 * sc_), head_m, z + 0.08, 0.08, name='head')
        hd.color = (*pc.lin(rnd.choice(SKIN))[:3], 1)
        if rnd.random() < 0.22:          # a raised arm
            a = rnd.uniform(-0.5, 0.5)
            arm = L(pc.xf(pc.rrect(0.22, 1.1, 0.1), x + (0.45 if a > 0 else -0.45), y + 0.9, a), body_m, z - 0.04, 0.06, name='arm')
            arm.color = b.color
        if rnd.random() < 0.3:           # hair / hat
            hh = L(pc.xf(pc.ellipse_pts(0.31 * sc_, 0.16 * sc_, 20), x, y + 1.05 * sc_), head_m, z + 0.16, 0.05, name='hair')
            hh.color = (*pc.lin(rnd.choice(['#3b2418', '#1f1a17', '#c8a26a', '#7a3b1e', '#f0efe9']))[:3], 1)
    # the step band in front of this row (covers bodies' lower half)
    z = 1.6 + t * 0.9
    L(R(X0, ytop - 3.0, X1, ytop - 1.55), step if t % 2 == 0 else step_d, z + 0.6, 0.12, name='step')
    L(R(X0, ytop - 1.7, X1, ytop - 1.5), stone_r, z + 0.75, 0.05, name='step_edge')

# ---------------------------------------------------------------- barrier wall with banners
bz = 1.6 + TIERS * 0.9 + 0.9
L(R(X0, 1.2, X1, 4.4), sl.tex_paper('barrier', '#e2c9a4', 'washi', 0.9, scale=0.12), bz, 0.18, name='barrier')
L(R(X0, 4.1, X1, 4.7), stone_d, bz + 0.2, 0.1, name='barrier_cap')
L(R(X0, 1.0, X1, 1.4), stone_d, bz + 0.2, 0.1, name='barrier_foot')
ban = [sl.tex_paper('ban_r', '#a7281f', 'washi', 0.9, scale=0.2), sl.tex_paper('ban_p', '#5b2c83', 'washi', 0.9, scale=0.2)]
gold = sl.foil('gold', '#e2b64a', metal=0.65, rough=0.3, emit=0.3)
for i in range(8):
    bx = X0 + 3.4 + i * 6.8
    L([(bx - 0.9, 4.3), (bx + 0.9, 4.3), (bx + 0.9, 2.3), (bx, 1.7), (bx - 0.9, 2.3)], ban[i % 2], bz + 0.32, 0.06, name='banner')
    L(pc.xf(pc.ellipse_pts(0.32, 0.32, 32), bx, 3.2), gold, bz + 0.4, 0.05, name='emblem')

# ---------------------------------------------------------------- sand floor
sz = bz + 1.0
sand = sl.tex_board('sand', 'craft', tint='#f0c987', tint_k=1.0, scale=0.06, nrm=0.5)
L(R(X0, Y0, X1, 1.35), sand, sz, 0.12, name='sand')
L(R(X0, 0.55, X1, 1.35), sl.tex_board('sand_sh', 'craft', tint='#d9a868', scale=0.06, nrm=0.5), sz + 0.14, 0.04, name='sand_shadow')
sand_lo = sl.tex_board('sand_lo', 'craft', tint='#ebc07f', scale=0.06, nrm=0.5)
for i, y in enumerate((-1.2, -3.6, -7.8)):
    pts = pc.wave_pts(X1 - X0 + 2, 0.12, 0.3 + i * 0.1, i * 1.3, y, 160)
    band = pts + [(x, y - 0.22 - 0.1 * i) for x, _ in reversed(pts)]
    L(band, sand_lo, sz + 0.14 + i * 0.01, 0.03, name='ripple')
peb = sl.tex_paper('pebble', '#c9a87c', 'washi', 0.9, scale=0.3)
for i in range(26):
    x, y = rnd.uniform(X0, X1), rnd.uniform(-9.5, 0.2)
    L(pc.xf(pc.blob_pts(rnd.uniform(0.08, 0.2), rnd.uniform(0.06, 0.13), 0.1, i), x, y), peb, sz + 0.2, 0.05, name='pebble')

# ---------------------------------------------------------------- camera (perspective, DOF on the fighters plane)
fz = sz * pc.ZK + 0.2
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
cam.data.dof.aperture_fstop = float(os.environ.get('ARENA_FSTOP', '0.35'))
cam.data.clip_end = 1000
sc.render.filepath = OUT
bpy.ops.render.render(write_still=True)
print('ARENA', OUT, 'fighters plane z', fz)
