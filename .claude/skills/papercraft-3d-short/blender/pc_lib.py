"""Papercraft helpers for Blender (bpy, Cycles).
Use:  sys.path.insert(0, <this folder>); import pc_lib as pc
Units: 1 unit = 1 m, but think "paper units". Layers are 0.1-0.3 thick and 0.3-0.8 apart.
"""
import bpy, bmesh, math, random, os
from mathutils import Vector

# Z-compression: papercraft layers lie almost ON each other (reference shadows are tight contact shadows). All z offsets AND thicknesses
# are multiplied by ZK, so every stacking relation is preserved but gaps/shadow offsets shrink. 1.0 = floaty look, 0.4 = too glued; 0.65 is the value the user chose. Override: set PC_ZK env var.
ZK = float(os.environ.get('PC_ZK', '0.65'))


def lin(h):
    """sRGB hex -> linear rgba."""
    h = h.lstrip('#')
    r, g, b = [int(h[i:i + 2], 16) / 255 for i in (0, 2, 4)]
    f = lambda c: c / 12.92 if c <= 0.04045 else ((c + 0.055) / 1.055) ** 2.4
    return (f(r), f(g), f(b), 1.0)


def _set(node, name, val):
    if name in node.inputs:
        node.inputs[name].default_value = val


def _detail(nt, color_out, bsdf, grit=0.8, mottle=0.2, bump=0.7, scale=50.0, rib=0.0, rib_freq=0.0, rib_axis='x', glitter=0.0):
    """Texture detail shared by every paper material (tuned on 1080x1920 crops of the reference; speckle cell must be 1.5-2 px: scale 50 per unit at camera distance ~30 and 1080 px wide, anything finer vanishes in antialiasing):
    - grit: pixel-scale sandy speckle that multiplies the albedo (cardstock tooth; visible on faces, leather, mustache)
    - mottle: low-frequency blotchiness (paper never has a perfectly flat tone)
    - bump: same speckle as a height map so highlights catch it
    - rib / rib_freq: corrugated cardboard ribs (sine wave along an object axis, rib_freq ribs per unit)
    - glitter: sparse bright sparkles (gold buckle)
    Connects colour + normal into `bsdf`."""
    N = nt.nodes
    L = nt.links
    tc = N.new('ShaderNodeTexCoord')

    def M(op, a=None, b=None):
        n = N.new('ShaderNodeMath')
        n.operation = op
        for i, v in enumerate((a, b)):
            if v is None:
                continue
            if isinstance(v, (int, float)):
                n.inputs[i].default_value = v
            else:
                L.new(v, n.inputs[i])
        return n.outputs['Value']
    n1 = N.new('ShaderNodeTexNoise')
    n1.inputs['Scale'].default_value = scale
    n1.inputs['Detail'].default_value = 2
    n1.inputs['Roughness'].default_value = 0.65
    L.new(tc.outputs['Object'], n1.inputs['Vector'])
    n2 = N.new('ShaderNodeTexNoise')
    n2.inputs['Scale'].default_value = 2.2
    n2.inputs['Detail'].default_value = 2
    L.new(tc.outputs['Object'], n2.inputs['Vector'])
    v = M('ADD', 1.0, M('ADD', M('MULTIPLY', M('SUBTRACT', n1.outputs['Fac'], 0.5), 2.0 * grit), M('MULTIPLY', M('SUBTRACT', n2.outputs['Fac'], 0.5), 2.0 * mottle)))
    cc = N.new('ShaderNodeCombineColor')
    for ch in ('Red', 'Green', 'Blue'):
        L.new(v, cc.inputs[ch])
    mx = N.new('ShaderNodeMix')
    mx.data_type = 'RGBA'
    mx.blend_type = 'MULTIPLY'
    mx.inputs['Factor'].default_value = 1.0
    L.new(color_out, mx.inputs['A'])
    L.new(cc.outputs['Color'], mx.inputs['B'])
    out = mx.outputs['Result']
    if glitter > 0:
        vo = N.new('ShaderNodeTexVoronoi')
        vo.inputs['Scale'].default_value = 150.0
        L.new(tc.outputs['Object'], vo.inputs['Vector'])
        spm = M('MULTIPLY', M('LESS_THAN', vo.outputs['Distance'], 0.06), glitter)
        m2 = N.new('ShaderNodeMix')
        m2.data_type = 'RGBA'
        L.new(out, m2.inputs['A'])
        m2.inputs['B'].default_value = (1.0, 0.97, 0.78, 1.0)
        L.new(spm, m2.inputs['Factor'])
        out = m2.outputs['Result']
    L.new(out, bsdf.inputs['Base Color'])
    h = M('MULTIPLY', n1.outputs['Fac'], 1.0)
    if rib > 0 and rib_freq > 0:
        sep = N.new('ShaderNodeSeparateXYZ')
        L.new(tc.outputs['Object'], sep.inputs['Vector'])
        ax = sep.outputs['X' if rib_axis == 'x' else 'Y']
        rb = M('ADD', M('MULTIPLY', M('SINE', M('MULTIPLY', ax, rib_freq * 6.2832)), 0.5), 0.5)
        h = M('ADD', h, M('MULTIPLY', rb, rib * 2.5))
    bm = N.new('ShaderNodeBump')
    bm.inputs['Strength'].default_value = bump
    bm.inputs['Distance'].default_value = 0.012
    L.new(h, bm.inputs['Height'])
    L.new(bm.outputs['Normal'], bsdf.inputs['Normal'])


def paper_mat(name, color, rough=0.88, grain=0.7, sss=0.12, emit=None, emit_strength=0.0, objcolor=False,
              grit=0.8, mottle=0.2, rib=0.0, rib_freq=0.0, rib_axis='x', glitter=0.0):
    """Matte paper: principled + visible cardstock grit and mottling (`_detail`) + subsurface (light bleeding through thin paper).
    `grain` is the bump strength. Set grit=0, mottle=0 for a perfectly smooth sheet."""
    m = bpy.data.materials.new(name)
    m.use_nodes = True
    nt = m.node_tree
    nt.nodes.clear()
    out = nt.nodes.new('ShaderNodeOutputMaterial')
    bsdf = nt.nodes.new('ShaderNodeBsdfPrincipled')
    nt.links.new(bsdf.outputs['BSDF'], out.inputs['Surface'])
    base = lin(color)
    if objcolor:
        oi = nt.nodes.new('ShaderNodeObjectInfo')
        mix = nt.nodes.new('ShaderNodeMix')
        mix.data_type = 'RGBA'
        mix.blend_type = 'MULTIPLY'
        mix.inputs['Factor'].default_value = 1.0
        mix.inputs['A'].default_value = base
        nt.links.new(oi.outputs['Color'], mix.inputs['B'])
        col_out = mix.outputs['Result']
    else:
        rgb = nt.nodes.new('ShaderNodeRGB')
        rgb.outputs['Color'].default_value = base
        col_out = rgb.outputs['Color']
    _set(bsdf, 'Roughness', rough)
    _set(bsdf, 'Specular IOR Level', 0.25)
    _set(bsdf, 'Subsurface Weight', sss)
    _set(bsdf, 'Subsurface Radius', (0.25, 0.08, 0.06))
    _set(bsdf, 'Subsurface Scale', 0.05)
    if emit:
        _set(bsdf, 'Emission Color', lin(emit))
        _set(bsdf, 'Emission Strength', emit_strength)
    if grain > 0 or grit > 0 or mottle > 0 or rib > 0 or glitter > 0:
        _detail(nt, col_out, bsdf, grit=grit, mottle=mottle, bump=grain, rib=rib, rib_freq=rib_freq, rib_axis=rib_axis, glitter=glitter)
    else:
        nt.links.new(col_out, bsdf.inputs['Base Color'])
    return m


def glow_mat(name, color, strength=8.0):
    m = bpy.data.materials.new(name)
    m.use_nodes = True
    nt = m.node_tree
    nt.nodes.clear()
    out = nt.nodes.new('ShaderNodeOutputMaterial')
    em = nt.nodes.new('ShaderNodeEmission')
    em.inputs['Color'].default_value = lin(color)
    em.inputs['Strength'].default_value = strength
    nt.links.new(em.outputs['Emission'], out.inputs['Surface'])
    return m


def gold_mat(name='gold', color='#e8c040'):
    """The reference gold is the only glossy object; it has sparse glitter and a sandy tooth."""
    m = bpy.data.materials.new(name)
    m.use_nodes = True
    nt = m.node_tree
    b = nt.nodes['Principled BSDF']
    rgb = nt.nodes.new('ShaderNodeRGB')
    rgb.outputs['Color'].default_value = lin(color)
    _set(b, 'Metallic', 0.6)
    _set(b, 'Roughness', 0.3)
    _set(b, 'Emission Color', lin(color))
    _set(b, 'Emission Strength', 0.35)   # no HDRI in the scene: a little emission keeps gold from turning olive
    _detail(nt, rgb.outputs['Color'], b, grit=0.18, mottle=0.1, bump=0.35, glitter=0.9)
    return m


def mesh_from(name, verts, faces, mat=None, bevel=0.012, coll=None):
    me = bpy.data.meshes.new(name)
    me.from_pydata(verts, [], faces)
    me.update()
    bm = bmesh.new()
    bm.from_mesh(me)
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    bm.to_mesh(me)
    bm.free()
    for p in me.polygons:
        p.use_smooth = False
    if mat:
        me.materials.append(mat)
    ob = bpy.data.objects.new(name, me)
    (coll or bpy.context.scene.collection).objects.link(ob)
    if bevel:
        md = ob.modifiers.new('bevel', 'BEVEL')
        md.width = bevel
        md.segments = 2
        md.limit_method = 'ANGLE'
    return ob


def band_geo(pts, width, h, z0=0.0, closed=False):
    """Paper strip of `width` along a 2D polyline `pts`, standing `h` tall (a wall / a quilling strip)."""
    z0, h = z0 * ZK, h * ZK
    n = len(pts)
    L = []
    R = []
    for i in range(n):
        a = pts[(i - 1) % n] if closed else pts[max(0, i - 1)]
        b = pts[(i + 1) % n] if closed else pts[min(n - 1, i + 1)]
        dx, dy = b[0] - a[0], b[1] - a[1]
        l = math.hypot(dx, dy) or 1
        dx /= l
        dy /= l
        L.append((pts[i][0] - dy * width / 2, pts[i][1] + dx * width / 2))
        R.append((pts[i][0] + dy * width / 2, pts[i][1] - dx * width / 2))
    v = []
    for i in range(n):
        v += [(L[i][0], L[i][1], z0), (R[i][0], R[i][1], z0), (L[i][0], L[i][1], z0 + h), (R[i][0], R[i][1], z0 + h)]
    f = []
    rng = range(n) if closed else range(n - 1)
    for i in rng:
        j = (i + 1) % n
        a, b = 4 * i, 4 * j
        f += [(a + 2, a + 3, b + 3, b + 2), (a + 1, a, b, b + 1), (a, a + 2, b + 2, b), (a + 3, a + 1, b + 1, b + 3)]
    if not closed:
        e = 4 * (n - 1)
        f += [(0, 1, 3, 2), (e + 1, e, e + 2, e + 3)]
    return v, f


def disc_geo(r, h, z0=0.0, seg=96, rx=None, ry=None):
    z0, h = z0 * ZK, h * ZK
    rx = rx or r
    ry = ry or r
    v = []
    f = []
    for i in range(seg):
        a = i / seg * math.tau
        v += [(math.cos(a) * rx, math.sin(a) * ry, z0), (math.cos(a) * rx, math.sin(a) * ry, z0 + h)]
    for i in range(seg):
        j = (i + 1) % seg
        f.append((2 * i, 2 * j, 2 * j + 1, 2 * i + 1))
    f.append(tuple(2 * i + 1 for i in range(seg)))
    f.append(tuple(2 * i for i in reversed(range(seg))))
    return v, f


def spiral_pts(turns, radius, r0=0.05, steps_per_turn=24):
    pitch = (radius - r0) / (turns * math.tau)
    n = int(turns * steps_per_turn)
    pts = []
    for i in range(n + 1):
        a = i / n * turns * math.tau
        r = r0 + pitch * a
        pts.append((r * math.cos(a), r * math.sin(a)))
    return pts


def setup_cycles(scene, w, h, samples=128, exposure=0.0, view='AgX'):
    scene.render.engine = 'CYCLES'
    c = scene.cycles
    c.samples = samples
    c.use_denoising = True
    try:
        c.denoiser = 'OPENIMAGEDENOISE'
    except Exception:
        pass
    prefs = bpy.context.preferences.addons['cycles'].preferences
    for t in ('OPTIX', 'CUDA'):
        try:
            prefs.compute_device_type = t
            prefs.get_devices()
            for d in prefs.devices:
                d.use = d.type != 'CPU'
            if any(d.use for d in prefs.devices):
                c.device = 'GPU'
                break
        except Exception:
            pass
    c.max_bounces = 8
    c.diffuse_bounces = 4
    c.glossy_bounces = 3
    c.transmission_bounces = 4
    scene.render.resolution_x = w
    scene.render.resolution_y = h
    scene.render.resolution_percentage = 100
    scene.view_settings.view_transform = view
    scene.view_settings.exposure = exposure
    scene.render.image_settings.file_format = 'PNG'
    scene.render.film_transparent = False


def world_color(scene, hexcol, strength=0.5):
    w = bpy.data.worlds.new('w')
    w.use_nodes = True
    scene.world = w
    bg = w.node_tree.nodes['Background']
    bg.inputs['Color'].default_value = lin(hexcol)
    bg.inputs['Strength'].default_value = strength


def sun(name, rot_deg=None, strength=3.0, color='#fff1de', angle_deg=6.0, frm=(-6.0, 9.0, 16.0)):
    """Sun placed FROM `frm` (default: upper left but close to overhead, so shadows are short and tight like the reference) shining at the origin: shadows fall lower right. `rot_deg` is ignored."""
    d = bpy.data.lights.new(name, 'SUN')
    d.energy = strength
    d.color = lin(color)[:3]
    d.angle = math.radians(angle_deg)
    ob = bpy.data.objects.new(name, d)
    bpy.context.scene.collection.objects.link(ob)
    ob.rotation_euler = Vector((-frm[0], -frm[1], -frm[2])).to_track_quat('-Z', 'Y').to_euler()
    return ob


def point(name, loc, watts, color='#ff8a3d', radius=0.3):
    d = bpy.data.lights.new(name, 'POINT')
    d.energy = watts
    d.color = lin(color)[:3]
    d.shadow_soft_size = radius
    ob = bpy.data.objects.new(name, d)
    bpy.context.scene.collection.objects.link(ob)
    ob.location = loc
    return ob


def area(name, loc, rot_deg, watts, size, color='#fff1de'):
    d = bpy.data.lights.new(name, 'AREA')
    d.energy = watts
    d.size = size
    d.color = lin(color)[:3]
    ob = bpy.data.objects.new(name, d)
    bpy.context.scene.collection.objects.link(ob)
    ob.location = loc
    ob.rotation_euler = [math.radians(x) for x in rot_deg]
    return ob


def camera(loc, rot_deg, lens=85, focus=None, fstop=None, sensor=36):
    cd = bpy.data.cameras.new('cam')
    cd.lens = lens
    cd.sensor_width = sensor
    cd.sensor_fit = 'HORIZONTAL'
    if focus and fstop:
        cd.dof.use_dof = True
        cd.dof.focus_distance = focus
        cd.dof.aperture_fstop = fstop
    ob = bpy.data.objects.new('cam', cd)
    bpy.context.scene.collection.objects.link(ob)
    ob.location = loc
    ob.rotation_euler = [math.radians(x) for x in rot_deg]
    bpy.context.scene.camera = ob
    return ob


def clear():
    bpy.ops.wm.read_factory_settings(use_empty=True)


# ---------------------------------------------------------------- shapes as polylines (2D) + layers via Curve objects
def rrect(w, h, r, n=8):
    r = min(r, w / 2, h / 2)
    pts = []
    for cx, cy, a0 in ((w / 2 - r, h / 2 - r, 0), (-w / 2 + r, h / 2 - r, 90), (-w / 2 + r, -h / 2 + r, 180), (w / 2 - r, -h / 2 + r, 270)):
        for i in range(n + 1):
            a = math.radians(a0 + 90 * i / n)
            pts.append((cx + r * math.cos(a), cy + r * math.sin(a)))
    return pts


def ellipse_pts(rx, ry, n=64):
    return [(rx * math.cos(i / n * math.tau), ry * math.sin(i / n * math.tau)) for i in range(n)]


def blob_pts(rx, ry, wob=0.06, seed=3, n=72):
    rnd = random.Random(seed)
    ph = [rnd.uniform(0, 6) for _ in range(3)]
    out = []
    for i in range(n):
        a = i / n * math.tau
        k = 1 + wob * (math.sin(2 * a + ph[0]) + 0.6 * math.sin(3 * a + ph[1]) + 0.4 * math.sin(5 * a + ph[2]))
        out.append((math.cos(a) * rx * k, math.sin(a) * ry * k))
    return out


def teardrop_pts(w, h, n=24):
    def bez(p0, p1, p2, p3):
        return [tuple((1 - t) ** 3 * p0[k] + 3 * (1 - t) ** 2 * t * p1[k] + 3 * (1 - t) * t * t * p2[k] + t ** 3 * p3[k] for k in (0, 1)) for t in [i / n for i in range(n)]]
    pts = []
    pts += bez((0, h), (w * .15, h * .62), (w * .62, h * .42), (w * .5, h * .16))
    pts += bez((w * .5, h * .16), (w * .42, -h * .04), (w * .18, 0), (0, 0))
    pts += bez((0, 0), (-w * .18, 0), (-w * .42, -h * .04), (-w * .5, h * .16))
    pts += bez((-w * .5, h * .16), (-w * .62, h * .42), (-w * .15, h * .62), (0, h))
    return pts


def wave_pts(width, amp, freq, phase, y0=0.0, n=120):
    return [(-width / 2 + i / n * width, y0 + math.sin((-width / 2 + i / n * width) * freq + phase) * amp) for i in range(n + 1)]


def xf(pts, x=0.0, y=0.0, rot=0.0, s=1.0):
    c, sn = math.cos(rot), math.sin(rot)
    return [((px * c - py * sn) * s + x, (px * sn + py * c) * s + y) for px, py in pts]


def layer(outer, mat, h=0.2, z=0.0, holes=(), bevel=0.012, name='layer', coll=None, loc=(0, 0), rot=0.0):
    """Cut-paper layer: closed polygon `outer` (+ optional `holes`) extruded to thickness h, bottom at z. Uses a Curve so holes work."""
    z, h = z * ZK, h * ZK
    cu = bpy.data.curves.new(name, 'CURVE')
    cu.dimensions = '2D'
    cu.fill_mode = 'BOTH'
    cu.extrude = h / 2
    cu.bevel_depth = bevel
    cu.bevel_resolution = 1
    for poly in [outer] + list(holes):
        sp = cu.splines.new('POLY')
        sp.points.add(len(poly) - 1)
        for i, (px, py) in enumerate(poly):
            sp.points[i].co = (px, py, 0, 1)
        sp.use_cyclic_u = True
    if mat:
        cu.materials.append(mat)
    ob = bpy.data.objects.new(name, cu)
    (coll or bpy.context.scene.collection).objects.link(ob)
    ob.location = (loc[0], loc[1], z + h / 2)
    ob.rotation_euler[2] = rot
    return ob


def sugar_cube(loc, rot, size=0.9, mat=None):
    loc = (loc[0], loc[1], loc[2] * ZK)
    bpy.ops.mesh.primitive_cube_add(size=size, location=loc, rotation=rot)
    ob = bpy.context.active_object
    md = ob.modifiers.new('b', 'BEVEL')
    md.width = size * 0.12
    md.segments = 3
    if mat:
        ob.data.materials.append(mat)
    return ob


def finish(scene, out):
    scene.render.filepath = out
    bpy.ops.render.render(write_still=True)
    print('RENDERED', out)


# ---------------------------------------------------------------- printed paper (procedural patterns, object coordinates)
def pattern_mat(name, kind, c1, c2, freq=1.0, rough=0.88, grain=0.7, sss=0.1, ratio=0.5,
                grit=0.8, mottle=0.2, rib=0.0, rib_freq=0.0, rib_axis='x', wobble=0.04):
    """Printed paper. kind: pinstripe | hstripes | gingham | polka | check | twill.  freq = repeats per unit.
    Stripe lines wobble slightly (`wobble`) like real printed paper; rib / rib_freq add corrugated-cardboard ribs."""
    m = bpy.data.materials.new(name)
    m.use_nodes = True
    nt = m.node_tree
    nt.nodes.clear()
    N = nt.nodes
    L = nt.links
    out = N.new('ShaderNodeOutputMaterial')
    bsdf = N.new('ShaderNodeBsdfPrincipled')
    L.new(bsdf.outputs['BSDF'], out.inputs['Surface'])
    tc = N.new('ShaderNodeTexCoord')
    sep = N.new('ShaderNodeSeparateXYZ')
    L.new(tc.outputs['Object'], sep.inputs['Vector'])

    def math(op, a=None, b=None):
        n = N.new('ShaderNodeMath')
        n.operation = op
        for i, v in enumerate((a, b)):
            if v is None:
                continue
            if isinstance(v, (int, float)):
                n.inputs[i].default_value = v
            else:
                L.new(v, n.inputs[i])
        return n.outputs['Value']
    wb = N.new('ShaderNodeTexNoise')
    wb.inputs['Scale'].default_value = 1.7
    L.new(tc.outputs['Object'], wb.inputs['Vector'])
    wob = math('MULTIPLY', math('SUBTRACT', wb.outputs['Fac'], 0.5), wobble * 2.0)
    X = math('MULTIPLY', math('ADD', sep.outputs['X'], wob), freq)
    Y = math('MULTIPLY', math('ADD', sep.outputs['Y'], wob), freq)
    fx = math('FRACT', X)
    fy = math('FRACT', Y)
    if kind == 'pinstripe':
        mask = math('GREATER_THAN', fx, 1.0 - ratio * 0.2)
    elif kind == 'hstripes':
        mask = math('GREATER_THAN', fy, ratio)
    elif kind == 'gingham':
        a_ = math('LESS_THAN', fx, ratio)
        b_ = math('LESS_THAN', fy, ratio)
        mask = math('MULTIPLY', math('ADD', a_, b_), 0.5)
    elif kind == 'check':
        a_ = math('LESS_THAN', fx, 0.5)
        b_ = math('LESS_THAN', fy, 0.5)
        mask = math('ABSOLUTE', math('SUBTRACT', a_, b_))
    elif kind == 'twill':       # diagonal weave (denim)
        d = math('FRACT', math('MULTIPLY', math('ADD', sep.outputs['X'], sep.outputs['Y']), freq))
        mask = math('LESS_THAN', d, ratio)
    else:  # polka
        dx = math('SUBTRACT', fx, 0.5)
        dy = math('SUBTRACT', fy, 0.5)
        d2 = math('ADD', math('MULTIPLY', dx, dx), math('MULTIPLY', dy, dy))
        mask = math('LESS_THAN', d2, ratio * ratio * 0.5)
    mix = N.new('ShaderNodeMix')
    mix.data_type = 'RGBA'
    mix.inputs['A'].default_value = lin(c1)
    mix.inputs['B'].default_value = lin(c2)
    L.new(mask, mix.inputs['Factor'])
    _set(bsdf, 'Roughness', rough)
    _set(bsdf, 'Specular IOR Level', 0.25)
    _set(bsdf, 'Subsurface Weight', sss)
    _set(bsdf, 'Subsurface Radius', (0.25, 0.08, 0.06))
    _set(bsdf, 'Subsurface Scale', 0.05)
    _detail(nt, mix.outputs['Result'], bsdf, grit=grit, mottle=mottle, bump=grain, rib=rib, rib_freq=rib_freq, rib_axis=rib_axis)
    return m
