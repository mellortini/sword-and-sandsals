"""Sprite pipeline for the paper gladiator game (Blender Cycles, headless).

Builds on the papercraft skill's pc_lib (layers, shapes, ZK, sun) and adds:
- materials that use the BlenderKit paper scans in game/art_src/blenderkit (fibres + tooth + real normal maps)
- per-part orthographic renders with transparent background and a recorded pivot (joint) in pixels
- an "assembly" render of the whole puppet with true Cycles shadows, to judge the runtime compositor against

Coordinates: X right, Y up (the puppet plane), Z towards the camera (paper stacking). The camera looks down -Z.
1 unit ~ 1/10 of a gladiator's height. PPU = pixels per unit of the master (2x) sprites.
"""
import bpy, math, os, sys, json
from mathutils import Vector

# pc_lib (layers, shapes, sun, ZK) is vendored in blender/vendor so the pipeline works on any machine
sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), 'vendor'))
import pc_lib as pc  # noqa: E402

GAME = os.path.abspath(os.path.join(os.path.dirname(__file__), '..'))
BK = os.path.join(GAME, 'art_src', 'blenderkit')
STATS = json.load(open(os.path.join(BK, 'tex_stats.json')))
PPU = 90.0

TEX = {
    'washi_col': 'washi/tex/base_color.png',
    'washi_nrm': 'washi/tex/normal_png.png',
    'cold_nrm': 'cold_pressed/tex/Cold_Pressed_Paper_01_Image-normal_jpg.png',
    'cold_bump': 'cold_pressed/tex/Cold_Pressed_Paper_01_Image-bump_jpg.png',
    'water_col': 'watercolour_hot/tex/Watercolour_Paper_01-diffuse_jpg.png',
    'water_nrm': 'watercolour_hot/tex/Watercolour_Paper_01-normal_jpg.png',
    'kraft_col': 'kraft_cardboard/tex/hairy_cardboard_Base_Color_jpg.png',
    'kraft_nrm': 'kraft_cardboard/tex/hairy_cardboard_Normal_jpg.png',
    'brown_col': 'recycled_cardboard_brown/tex/Recycled_Brown_Cardboard_Color_jpg.png',
    'brown_nrm': 'recycled_cardboard_brown/tex/Recycled_Brown_Cardboard_NormalGL_jpg.png',
    'flute_col': 'corrugated_flute/tex/Cardboard_Stripes_Base_Color_jpg.png',
    'flute_nrm': 'corrugated_flute/tex/Cardboard_Stripes_Normal_jpg.png',
    'craft_col': 'craft_paper/tex/carftpaper_basecolor_tga.png',
    'craft_nrm': 'craft_paper/tex/carftpaper_normal_tga.png',
    'white_col': 'recycled_white/tex/Paper_Color_jpg.png',
    'white_nrm': 'recycled_white/tex/Paper_NormalGL_jpg.png',
}


def _img(key, data=False):
    p = os.path.join(BK, TEX[key])
    im = bpy.data.images.get(key) or bpy.data.images.load(p)
    im.name = key
    if data:
        im.colorspace_settings.name = 'Non-Color'
    return im


def _mean(key):
    return STATS[TEX[key]]['mean']


class _NT:
    """tiny node-tree helper"""

    def __init__(self, mat):
        mat.use_nodes = True
        self.nt = mat.node_tree
        self.nt.nodes.clear()
        self.N, self.L = self.nt.nodes, self.nt.links
        self.out = self.N.new('ShaderNodeOutputMaterial')
        self.bsdf = self.N.new('ShaderNodeBsdfPrincipled')
        self.L.new(self.bsdf.outputs['BSDF'], self.out.inputs['Surface'])
        self.tc = self.N.new('ShaderNodeTexCoord')

    def coords(self, scale, rot=0.0, offset=(0, 0, 0)):
        mp = self.N.new('ShaderNodeMapping')
        mp.inputs['Scale'].default_value = (scale, scale, scale)
        mp.inputs['Rotation'].default_value = (0, 0, rot)
        mp.inputs['Location'].default_value = offset
        self.L.new(self.tc.outputs['Object'], mp.inputs['Vector'])
        return mp.outputs['Vector']

    def tex(self, key, vec, data=False):
        t = self.N.new('ShaderNodeTexImage')
        t.image = _img(key, data)
        t.interpolation = 'Cubic'
        self.L.new(vec, t.inputs['Vector'])
        return t.outputs['Color']

    def mix(self, a, b, fac=1.0, mode='MULTIPLY'):
        m = self.N.new('ShaderNodeMix')
        m.data_type = 'RGBA'
        m.blend_type = mode
        m.inputs['Factor'].default_value = fac
        for sock, v in (('A', a), ('B', b)):
            if isinstance(v, tuple):
                m.inputs[sock].default_value = v
            else:
                self.L.new(v, m.inputs[sock])
        return m.outputs['Result']

    def normal(self, col, strength):
        nm = self.N.new('ShaderNodeNormalMap')
        nm.inputs['Strength'].default_value = strength
        self.L.new(col, nm.inputs['Color'])
        return nm.outputs['Normal']

    def bump(self, height, strength, normal=None, dist=0.01):
        b = self.N.new('ShaderNodeBump')
        b.inputs['Strength'].default_value = strength
        b.inputs['Distance'].default_value = dist
        self.L.new(height, b.inputs['Height'])
        if normal is not None:
            self.L.new(normal, b.inputs['Normal'])
        return b.outputs['Normal']

    def basics(self, rough=0.86, sss=0.08):
        pc._set(self.bsdf, 'Roughness', rough)
        pc._set(self.bsdf, 'Specular IOR Level', 0.22)
        pc._set(self.bsdf, 'Subsurface Weight', sss)
        pc._set(self.bsdf, 'Subsurface Radius', (0.25, 0.08, 0.06))
        pc._set(self.bsdf, 'Subsurface Scale', 0.04)


def _inv(mean):
    return (1.0 / mean[0], 1.0 / mean[1], 1.0 / mean[2], 1.0)


_cache = {}


def tex_paper(name, color, fiber='washi', fiber_k=0.9, tooth=0.45, fibre_nrm=0.35, scale=0.22, rot=0.0, rough=0.86, sss=0.08, seed=0.0):
    """Coloured paper sheet: tint x (normalised BlenderKit fibre scan) + washi fibre normal + cold-pressed tooth bump.
    fiber: 'washi' (visible fibres) | 'water' (soft cloudy) | 'white' (smooth recycled) | None.
    scale = texture repeats per unit (0.22 -> one 2K tile per ~4.5 units = ~400 px at PPU 90)."""
    key = (name, color, fiber, fiber_k, tooth, scale, rot)
    if key in _cache:
        return _cache[key]
    m = bpy.data.materials.new(name)
    t = _NT(m)
    t.basics(rough, sss)
    v = t.coords(scale, rot, (seed * 0.37, seed * 0.61, 0))
    col = pc.lin(color)
    if fiber:
        fc = t.tex(fiber + '_col', v)
        norm = t.mix(fc, _inv(_mean(fiber + '_col')))            # mean -> 1.0
        detail = t.mix((1, 1, 1, 1), norm, fiber_k, 'MIX')
        base = t.mix(col, detail)
    else:
        rgb = t.N.new('ShaderNodeRGB')
        rgb.outputs['Color'].default_value = col
        base = rgb.outputs['Color']
    t.L.new(base, t.bsdf.inputs['Base Color'])
    nrm_key = {'washi': 'washi_nrm', 'water': 'water_nrm', 'white': 'white_nrm'}.get(fiber, 'washi_nrm')
    n0 = t.normal(t.tex(nrm_key, v, True), fibre_nrm)
    vb = t.coords(scale * 1.6, rot + 0.7)
    h = t.tex('cold_bump', vb, True)
    sep = t.N.new('ShaderNodeSeparateColor')
    t.L.new(h, sep.inputs['Color'])
    t.L.new(t.bump(sep.outputs['Red'], tooth, n0, 0.006), t.bsdf.inputs['Normal'])
    _cache[key] = m
    return m


def tex_board(name, kind='kraft', tint=None, tint_k=1.0, scale=0.25, rot=0.0, nrm=0.6, rough=0.9):
    """Cardboard / kraft (leather straps, sandals, grips, shields): the scan's own colour, optionally re-tinted
    (tint x normalised scan). kind: kraft | brown | flute (corrugated) | craft."""
    key = (name, kind, tint, tint_k, scale, rot)
    if key in _cache:
        return _cache[key]
    m = bpy.data.materials.new(name)
    t = _NT(m)
    t.basics(rough, 0.04)
    v = t.coords(scale, rot)
    c = t.tex(kind + '_col', v)
    if tint:
        norm = t.mix(c, _inv(_mean(kind + '_col')))
        c = t.mix(t.mix((1, 1, 1, 1), norm, tint_k, 'MIX'), pc.lin(tint))
    t.L.new(c, t.bsdf.inputs['Base Color'])
    t.L.new(t.normal(t.tex(kind + '_nrm', v, True), nrm), t.bsdf.inputs['Normal'])
    _cache[key] = m
    return m


def foil(name, color='#c9ccd2', metal=0.75, rough=0.32, emit=0.18, scale=0.3):
    """Metallic foil paper (blades, helmets, buckles). No HDRI in sprite renders -> a little emission keeps it from going black."""
    key = (name, color, metal, rough)
    if key in _cache:
        return _cache[key]
    m = bpy.data.materials.new(name)
    t = _NT(m)
    c = pc.lin(color)
    pc._set(t.bsdf, 'Metallic', metal)
    pc._set(t.bsdf, 'Roughness', rough)
    pc._set(t.bsdf, 'Emission Color', c)
    pc._set(t.bsdf, 'Emission Strength', emit)
    v = t.coords(scale)
    fc = t.tex('water_col', v)
    norm = t.mix(fc, _inv(_mean('water_col')))
    t.L.new(t.mix(c, t.mix((1, 1, 1, 1), norm, 0.8, 'MIX')), t.bsdf.inputs['Base Color'])
    h = t.tex('cold_bump', t.coords(scale * 1.5, 0.4), True)
    sep = t.N.new('ShaderNodeSeparateColor')
    t.L.new(h, sep.inputs['Color'])
    n0 = t.normal(t.tex('water_nrm', v, True), 0.5)
    t.L.new(t.bump(sep.outputs['Red'], 0.25, n0, 0.006), t.bsdf.inputs['Normal'])
    _cache[key] = m
    return m


# ------------------------------------------------------------------ shapes
def limb_pts(length, prof, n=10):
    """Limb hanging DOWN from its pivot (0,0) to (0,-length). prof = [(t, wl, wr), ...] half-widths on the
    left (-x) and right (+x) side at fraction t of the length. Round caps at both ends (radius = local half width)."""
    def at(t):
        for i in range(len(prof) - 1):
            a, b = prof[i], prof[i + 1]
            if a[0] <= t <= b[0]:
                k = (t - a[0]) / max(1e-6, b[0] - a[0])
                k = k * k * (3 - 2 * k)
                return a[1] + (b[1] - a[1]) * k, a[2] + (b[2] - a[2]) * k
        return prof[-1][1], prof[-1][2]
    right, left = [], []
    steps = 24
    for i in range(steps + 1):
        t = i / steps
        wl, wr = at(t)
        y = -t * length
        right.append((wr, y))
        left.append((-wl, y))
    # bottom cap
    wl, wr = at(1.0)
    r = (wl + wr) / 2
    cx = (wr - wl) / 2
    bot = [(cx + r * math.cos(-a), -length + r * math.sin(-a)) for a in [i / n * math.pi for i in range(1, n)]]
    wl, wr = at(0.0)
    r = (wl + wr) / 2
    cx = (wr - wl) / 2
    top = [(cx + r * math.cos(a), r * math.sin(a)) for a in [i / n * math.pi for i in range(1, n)]]
    return right + bot + list(reversed(left)) + list(reversed(top))


def poly_scale(pts, sx, sy=None, cx=0.0, cy=0.0):
    sy = sx if sy is None else sy
    return [((x - cx) * sx + cx, (y - cy) * sy + cy) for x, y in pts]


def arc_pts(cx, cy, r0, r1, a0, a1, n=24):
    """crescent / band between radii r0..r1 from angle a0 to a1 (degrees)"""
    o = [(cx + r1 * math.cos(math.radians(a0 + (a1 - a0) * i / n)), cy + r1 * math.sin(math.radians(a0 + (a1 - a0) * i / n))) for i in range(n + 1)]
    i_ = [(cx + r0 * math.cos(math.radians(a1 - (a1 - a0) * i / n)), cy + r0 * math.sin(math.radians(a1 - (a1 - a0) * i / n))) for i in range(n + 1)]
    return o + i_


# ------------------------------------------------------------------ scene / rendering
def setup(samples=64, world='#f3e6d6', world_strength=0.55, sun_strength=3.2):
    pc.clear()
    sc = bpy.context.scene
    pc.setup_cycles(sc, 64, 64, samples=samples, exposure=0.0, view='Standard')
    sc.render.film_transparent = True
    sc.render.image_settings.color_mode = 'RGBA'
    sc.cycles.use_denoising = True
    try:
        sc.cycles.denoising_input_passes = 'RGB_ALBEDO_NORMAL'
    except Exception:
        pass
    pc.world_color(sc, world, world_strength)
    pc.sun('sun', strength=sun_strength, frm=(-6.0, 9.0, 16.0), angle_deg=8.0)
    cd = bpy.data.cameras.new('cam')
    cd.type = 'ORTHO'
    cam = bpy.data.objects.new('cam', cd)
    sc.collection.objects.link(cam)
    sc.camera = cam
    cam.location = (0, 0, 40)
    return sc


def new_coll(name):
    c = bpy.data.collections.new(name)
    bpy.context.scene.collection.children.link(c)
    return c


def bbox_xy(objs):
    dg = bpy.context.evaluated_depsgraph_get()
    xs, ys = [], []
    for o in objs:
        oe = o.evaluated_get(dg)
        try:
            me = oe.to_mesh()
        except Exception:
            continue
        mw = oe.matrix_world
        for v in me.vertices:
            w = mw @ v.co
            xs.append(w.x)
            ys.append(w.y)
        oe.to_mesh_clear()
    return min(xs), min(ys), max(xs), max(ys)


def render_coll(coll, out_png, pad=0.12, ppu=PPU, origin=(0.0, 0.0)):
    """Render one collection alone (everything else hidden) with an ortho camera fitted to it.
    Returns pivot of `origin` (world xy) in image pixels (x right, y down) and the image size."""
    sc = bpy.context.scene
    for c in sc.collection.children:
        c.hide_render = c is not coll
    x0, y0, x1, y1 = bbox_xy(coll.all_objects)
    x0 -= pad
    y0 -= pad
    x1 += pad
    y1 += pad
    W = max(8, int(math.ceil((x1 - x0) * ppu)))
    H = max(8, int(math.ceil((y1 - y0) * ppu)))
    x1 = x0 + W / ppu
    y1 = y0 + H / ppu
    cam = sc.camera
    cam.data.ortho_scale = max(W, H) / ppu
    cam.data.sensor_fit = 'AUTO'
    cam.location = ((x0 + x1) / 2, (y0 + y1) / 2, 40)
    cam.rotation_euler = (0, 0, 0)
    sc.render.resolution_x = W
    sc.render.resolution_y = H
    sc.render.filepath = out_png
    bpy.ops.render.render(write_still=True)
    piv = ((origin[0] - x0) * ppu, (y1 - origin[1]) * ppu)
    return {'w': W, 'h': H, 'pivot': [round(piv[0], 2), round(piv[1], 2)]}


# ------------------------------------------------------------------ helpers for the modular kit
def clip_y(pts, y0, y1):
    """clip a closed polygon to the horizontal band y0 <= y <= y1 (Sutherland-Hodgman, two passes)"""
    def clip(poly, keep, inter):
        out = []
        n = len(poly)
        for i in range(n):
            a, b = poly[i], poly[(i + 1) % n]
            ka, kb = keep(a), keep(b)
            if ka:
                out.append(a)
            if ka != kb:
                out.append(inter(a, b))
        return out

    def at_y(y):
        return lambda a, b: (a[0] + (b[0] - a[0]) * (y - a[1]) / ((b[1] - a[1]) or 1e-9), y)
    p = clip(pts, lambda q: q[1] >= y0, at_y(y0))
    return clip(p, lambda q: q[1] <= y1, at_y(y1))


def clip_x(pts, x0, x1):
    sw = [(y, x) for x, y in pts]
    return [(x, y) for y, x in clip_y(sw, x0, x1)]


def torn(pts, amp=0.04, seed=0, step=0.08):
    """ragged paper edge: resample the outline every `step` and jitter points along the normal"""
    import random as _r
    rnd = _r.Random(seed)
    out = []
    n = len(pts)
    for i in range(n):
        a, b = pts[i], pts[(i + 1) % n]
        L = math.hypot(b[0] - a[0], b[1] - a[1])
        k = max(1, int(L / step))
        nx, ny = (b[1] - a[1]) / (L or 1), -(b[0] - a[0]) / (L or 1)
        for j in range(k):
            t = j / k
            d = rnd.uniform(-amp, amp)
            out.append((a[0] + (b[0] - a[0]) * t + nx * d, a[1] + (b[1] - a[1]) * t + ny * d))
    return out


def band(length, prof, t0, t1, grow=0.05, curve=0.06, n=16):
    """piece wrapped around a limb (see limb_pts) between fractions t0..t1, `grow` wider on each side.
    Top/bottom edges bow downwards by `curve` (a cylinder edge seen from slightly above)."""
    def at(t):
        for i in range(len(prof) - 1):
            a, b = prof[i], prof[i + 1]
            if a[0] <= t <= b[0]:
                k = (t - a[0]) / max(1e-6, b[0] - a[0])
                k = k * k * (3 - 2 * k)
                return a[1] + (b[1] - a[1]) * k, a[2] + (b[2] - a[2]) * k
        return prof[-1][1], prof[-1][2]
    right, left = [], []
    for i in range(n + 1):
        t = t0 + (t1 - t0) * i / n
        wl, wr = at(t)
        right.append((wr + grow, -t * length))
        left.append((-wl - grow, -t * length))
    def edge(t, flip):
        wl, wr = at(t)
        xs = [(-wl - grow) + (wr + wl + 2 * grow) * i / 10 for i in range(11)]
        w = (wr + wl) / 2 + grow
        c = (wr - wl) / 2
        pts = [(x, -t * length - curve * (1 - ((x - c) / w) ** 2)) for x in xs]
        return pts if not flip else list(reversed(pts))
    bottom = edge(t1, True)
    top = edge(t0, False)
    return right[1:-1] + bottom + list(reversed(left))[1:-1] + top


def head_outline(cx=0.12, cy=1.15, a_top=1.0, b_top=1.125, n_top=3.0, a_low=1.0, b_low=1.125, n_low=3.0, steps=96):
    """superellipse head: fixed cranium (top half) + jaw with its own width / length / squareness"""
    pts = []
    for i in range(steps):
        th = i / steps * math.tau
        c, s = math.cos(th), math.sin(th)
        w = min(1.0, max(0.0, (s + 0.25) / 0.5))
        w = w * w * (3 - 2 * w)
        A = a_low + (a_top - a_low) * w
        B = b_low + (b_top - b_low) * w
        nn = n_low + (n_top - n_low) * w
        pts.append((cx + A * math.copysign(abs(c) ** (2 / nn), c), cy + B * math.copysign(abs(s) ** (2 / nn), s)))
    return pts


def scale_about(pts, sx, sy, cx, cy):
    return [((x - cx) * sx + cx, (y - cy) * sy + cy) for x, y in pts]


def clear_coll(coll):
    for o in list(coll.objects):
        d = o.data
        bpy.data.objects.remove(o, do_unlink=True)
        if d is not None and d.users == 0:
            if isinstance(d, bpy.types.Curve):
                bpy.data.curves.remove(d)
            elif isinstance(d, bpy.types.Mesh):
                bpy.data.meshes.remove(d)
