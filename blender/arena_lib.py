"""Shared parts of the fight arenas (#272): frame, camera and the crowd sprites.

Every arena keeps the geometry of blender/arena.py: the same camera, the stands on y 1..13.4 and the floor ending at
y 1.35. The game softens everything above that line (src/scenes/backdrop.ts, SAND_TOP) and the fighters' feet, the
crowd arms and thrown gifts are placed on it, so a new arena may change what is drawn but not where it ends.
"""
import bpy, sys, os, math, random, json
from mathutils import Vector
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import sprite_lib as sl  # noqa: E402
pc = sl.pc

X0, X1, Y0, Y1 = -27.0, 27.0, -10.5, 20.5          # build a little wider than the frame
FLOOR_TOP = 1.35
TIERS = 5
SKIN = ['#f2c29b', '#e8a77c', '#c98b66', '#9a6646', '#f6d3b5']
HAIR = ['#3b2418', '#1f1a17', '#c8a26a', '#7a3b1e', '#f0efe9']


def args(default_name):
    """`-- <out.png> [W H samples]`"""
    argv = sys.argv[sys.argv.index('--') + 1:] if '--' in sys.argv else []
    out = os.path.abspath(argv[0] if argv else os.path.join(sl.GAME, 'assets', 'bg', default_name))
    w = int(argv[1]) if len(argv) > 1 else 1920
    h = int(argv[2]) if len(argv) > 2 else 1080
    s = int(argv[3]) if len(argv) > 3 else 96
    os.makedirs(os.path.dirname(out), exist_ok=True)
    return out, w, h, s


def setup(w, h, samples, world, world_strength, sun_strength):
    sc = sl.setup(samples=samples, world=world, world_strength=world_strength, sun_strength=sun_strength)
    sc.render.film_transparent = False
    sc.render.resolution_x, sc.render.resolution_y = w, h
    return sc


def L(pts, mat, z, h=0.15, holes=(), name='l'):
    return pc.layer(pts, mat, h=h, z=z, holes=holes, name=name, bevel=0.015)


def R(x0, y0, x1, y1, r=0.0):
    return pc.xf(pc.rrect(x1 - x0, y1 - y0, r), (x0 + x1) / 2, (y0 + y1) / 2)


def ellipse(x, y, rx, ry, n=32):
    return pc.xf(pc.ellipse_pts(rx, ry, n), x, y)


def tint(ob, hex_colour):
    ob.color = (*pc.lin(hex_colour)[:3], 1)
    return ob


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


def tier_top(t):
    return 13.4 - t * 1.85


def tier_z(t):
    return 1.6 + t * 0.9


BARRIER_Z = tier_z(TIERS) + 0.9
FLOOR_Z = BARRIER_Z + 1.0


def camera(sc, floor_z=FLOOR_Z):
    """perspective, DOF on the fighters plane: 50.5 x 28.4 units in frame, feet line around y = -4.5"""
    fz = floor_z * pc.ZK + 0.2
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
    return fz


PAD = 14          # px of clear space around a sprite: the game blurs the sheet, and the blur must not reach a neighbour
SHEET_W = 2048


def _screen_box(sc, cam, objs, w, h):
    from bpy_extras.object_utils import world_to_camera_view
    pts = [world_to_camera_view(sc, cam, o.matrix_world @ Vector(v)) for o in objs for v in o.bound_box]
    xs, ys = [p.x * w for p in pts], [(1 - p.y) * h for p in pts]
    return (max(0, int(min(xs)) - PAD), max(0, int(min(ys)) - PAD),
            min(w, int(math.ceil(max(xs))) + PAD), min(h, int(math.ceil(max(ys))) + PAD))


def _head(sc, cam, head, w, h):
    """where the head lands in the picture and how many px one unit is at that depth"""
    from bpy_extras.object_utils import world_to_camera_view
    # pc.layer keeps the outline in absolute xy (the object sits at 0, 0, z): take the middle of its bounds
    p = sum((head.matrix_world @ Vector(v) for v in head.bound_box), Vector()) / 8
    a = world_to_camera_view(sc, cam, p)
    b = world_to_camera_view(sc, cam, p + Vector((1.0, 0.0, 0.0)))
    return round(a.x * w, 1), round((1 - a.y) * h, 1), round((b.x - a.x) * w, 2)


def _hex(col):
    srgb = [round(255 * (1.055 * c ** (1 / 2.4) - 0.055 if c > 0.0031308 else 12.92 * c)) for c in col[:3]]
    return '#%02x%02x%02x' % tuple(max(0, min(255, v)) for v in srgb)


def _render(sc, path):
    sc.render.filepath = path
    bpy.ops.render.render(write_still=True)


def export_people(sc, people, base, w, h):
    """The stands without anybody (<base>_empty.png) and every spectator on its own, so the game can sway them
    (<base>_people.png + .json, read by src/ui/crowdFx.ts).

    `people` = dicts {objs, head, colour, tier}. Spectators whose boxes do not touch are rendered together in one
    pass; everything else is a holdout in that pass, so steps and the barrier cut each sprite as they cover it.
    """
    import tempfile
    import numpy as np
    bpy.context.view_layer.update()
    cam = sc.camera
    mine = {o for p in people for o in p['objs']}
    scenery = [o for o in sc.collection.all_objects if o.type in ('CURVE', 'MESH') and o not in mine]

    for o in mine:
        o.hide_render = True
    sc.render.film_transparent = False
    sc.render.image_settings.color_mode = 'RGB'
    _render(sc, base + '_empty.png')

    for p in people:
        p['box'] = _screen_box(sc, cam, p['objs'], w, h)
        p['z'] = p['head'].location.z
    passes = []
    for p in people:
        x0, y0, x1, y1 = p['box']
        if x1 <= x0 or y1 <= y0:
            continue
        for group in passes:
            if all(x1 <= q['box'][0] or x0 >= q['box'][2] or y1 <= q['box'][1] or y0 >= q['box'][3] for q in group):
                group.append(p)
                break
        else:
            passes.append([p])
    print('PEOPLE', len(people), 'in', len(passes), 'passes', flush=True)

    for o in scenery:
        o.is_holdout = True
    sc.render.film_transparent = True
    sc.render.image_settings.color_mode = 'RGBA'
    tmp = tempfile.mkdtemp(prefix='crowd_')
    for n, group in enumerate(passes):
        for p in group:
            for o in p['objs']:
                o.hide_render = False
        path = os.path.join(tmp, 'pass%02d.png' % n)
        _render(sc, path)
        img = bpy.data.images.load(path)
        buf = np.empty(w * h * 4, dtype=np.float32)
        img.pixels.foreach_get(buf)
        buf = buf.reshape(h, w, 4)[::-1]           # top row first
        for p in group:
            x0, y0, x1, y1 = p['box']
            p['pix'] = buf[y0:y1, x0:x1].copy()
            for o in p['objs']:
                o.hide_render = True
        bpy.data.images.remove(img)
        os.remove(path)
    os.rmdir(tmp)

    # drop the transparent rows and columns beyond PAD, and anybody the scenery hides completely
    shown = []
    for p in people:
        pix = p.get('pix')
        if pix is None:
            continue
        ys, xs = np.nonzero(pix[:, :, 3] > 0.02)
        if len(xs) < 40:
            continue
        x0, y0 = p['box'][0], p['box'][1]
        l, t = max(0, xs.min() - PAD), max(0, ys.min() - PAD)
        r, b = min(pix.shape[1], xs.max() + 1 + PAD), min(pix.shape[0], ys.max() + 1 + PAD)
        p['pix'] = pix[t:b, l:r]
        p['at'] = (int(x0 + l), int(y0 + t))
        p['foot'] = int(y0 + ys.max() + 1)         # the lowest visible px: what the spectator sways around
        shown.append(p)

    # shelf packing, tallest first
    x = y = row = 0
    for p in sorted(shown, key=lambda q: -q['pix'].shape[0]):
        ph, pw = p['pix'].shape[:2]
        if x + pw > SHEET_W:
            x, y, row = 0, y + row, 0
        p['slot'] = (x, y)
        x, row = x + pw, max(row, ph)
    sheet_h = y + row
    sheet = np.zeros((sheet_h, SHEET_W, 4), dtype=np.float32)
    for p in shown:
        sx, sy = p['slot']
        ph, pw = p['pix'].shape[:2]
        sheet[sy:sy + ph, sx:sx + pw] = p['pix']
    out = bpy.data.images.new('people', SHEET_W, sheet_h, alpha=True)
    out.pixels.foreach_set(sheet[::-1].ravel())
    out.filepath_raw = base + '_people.png'
    out.file_format = 'PNG'
    out.save()

    rows = []
    for p in sorted(shown, key=lambda q: q['z']):   # back to front: the order the game draws them in
        hx, hy, k = _head(sc, cam, p['head'], w, h)
        ph, pw = p['pix'].shape[:2]
        rows.append({'x': hx, 'y': hy, 'k': k, 'tier': p['tier'], 'c': _hex(p['colour']),
                     'sheet': [p['slot'][0], p['slot'][1], int(pw), int(ph)], 'at': list(p['at']), 'foot': p['foot']})
    with open(base + '_people.json', 'w', newline='\n') as fh:
        json.dump({'size': [w, h], 'seats': rows}, fh, separators=(',', ':'))
    print('SHEET', SHEET_W, sheet_h, 'people', len(rows), base, flush=True)


def finish(sc, people, out, w, h):
    camera(sc)
    export_people(sc, people, os.path.splitext(out)[0], w, h)
