"""Weapon pictures and the card paper for the weaponsmith's boards -> assets/ui/weapons/<id>.png, assets/ui/weapon-card.jpg

  python -I tools/blender.py blender/weapon_icons.py -- [samples] [only_prefix,...]

Layered cut paper: the shapes come from weapon_shapes.py (pictures only; the puppet's sprites in assets/chars/kit are
built by weapons.py and are not touched). Each piece is a thin matte layer, so the shadows between layers are real.
No textures from outside: the paper grain is procedural. Blades lie flat (hilt left) and the boards stand them up, so the
camera is rolled a quarter turn and the sun stays at the upper left of the upright picture.
"""
import math
import os
import sys
import time

import bmesh
import bpy

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
import weapon_shapes as shapes  # noqa: E402

argv = sys.argv[sys.argv.index('--') + 1:] if '--' in sys.argv else []
SAMPLES = int(argv[0]) if argv else 96
ONLY = [p for p in (argv[1].split(',') if len(argv) > 1 else []) if p]
UI = os.path.join(HERE, '..', 'assets', 'ui')
OUT = os.path.join(UI, 'weapons')
S = 0.01        # shape units -> blender units
PPU = 1.15      # pixels per shape unit
PAD = 14
THICK = 7.0

# the two tones of each paper's grain
PAPER = {
    'scrap': ('#a57c4d', '#b28958'), 'scrap_s': ('#76532f', '#815d37'), 'scrap_hi': ('#c9a574', '#d3b080'),
    'rag': ('#bfb095', '#cabca2'), 'rag_d': ('#8d7e66', '#988971'),
    'pulp': ('#b3a997', '#beb4a2'), 'pulp_s': ('#8c8372', '#968d7c'), 'pulp_hi': ('#d2c9b8', '#dcd3c2'),
    'linen': ('#dccfae', '#e5d9ba'), 'linen_d': ('#ad9c78', '#b8a783'),
    'card': ('#d9c8a0', '#e2d2ac'), 'card_s': ('#b49f74', '#bea97e'), 'white': ('#efe6cf', '#f6eeda'),
    'hide': ('#b57a48', '#c08552'), 'hide_s': ('#925f34', '#9c683c'), 'hide_hi': ('#d29c68', '#dca773'),
    'wood': ('#9a6435', '#a8713f'), 'wood_s': ('#7c4e29', '#885830'),
    'wood_d': ('#70462a', '#7b5032'), 'wood_dd': ('#4f301d', '#593824'),
    'leather': ('#823f26', '#8f4a2f'), 'leather_d': ('#522619', '#5d2e20'),
    'bronze': ('#c08046', '#cc8c51'), 'bronze_s': ('#905a2e', '#9b6437'), 'bronze_hi': ('#e6b57c', '#efc08a'),
    'iron': ('#767982', '#81848d'), 'iron_s': ('#6d7078', '#787b83'), 'iron_d': ('#484952', '#52535c'), 'iron_hi': ('#9a9ea8', '#a5a9b3'),
    'steel': ('#bcc5cc', '#c8d0d6'), 'steel_s': ('#8a949f', '#97a1ab'), 'steel_hi': ('#e3e8ec', '#edf1f4'),
    'chain': ('#454a54', '#4f545e'),
    'brass': ('#cf9a3c', '#dba84a'), 'brass_s': ('#a5762a', '#b08032'),
    'gold': ('#e0ac38', '#ecb946'), 'gold_s': ('#f4d476', '#fadd88'),
    'red': ('#ae372a', '#b94134'), 'red_d': ('#7e2420', '#8a2c27'),
    'purple': ('#5b3580', '#663f8c'), 'purple_d': ('#43265f', '#4c2d6a'),
    'laurel': ('#6d8a3a', '#789644'),
    'cardstock': ('#e9dfc9', '#f1e9d6'),
}


def lin(hexs):
    def c(v):
        v /= 255
        return v / 12.92 if v <= 0.04045 else ((v + 0.055) / 1.055) ** 2.4
    return (c(int(hexs[1:3], 16)), c(int(hexs[3:5], 16)), c(int(hexs[5:7], 16)), 1)


def reset(width, height):
    bpy.ops.wm.read_factory_settings(use_empty=True)
    sc = bpy.context.scene
    sc.render.engine = 'CYCLES'
    sc.cycles.samples = SAMPLES
    sc.cycles.use_denoising = True
    if os.environ.get('CYCLES_DEVICE', '').upper() != 'CPU':
        prefs = bpy.context.preferences.addons['cycles'].preferences
        for kind in ('OPTIX', 'CUDA', 'HIP', 'METAL', 'ONEAPI'):
            try:
                prefs.compute_device_type = kind
            except TypeError:
                continue
            prefs.get_devices()
            if any(d.type == kind for d in prefs.devices):
                for d in prefs.devices:
                    d.use = d.type == kind
                sc.cycles.device = 'GPU'
                break
    sc.render.resolution_x, sc.render.resolution_y = width, height
    sc.view_settings.view_transform = 'Standard'
    sc.view_settings.exposure = -0.08
    world = bpy.data.worlds.new('w')
    sc.world = world
    world.use_nodes = True
    bg = world.node_tree.nodes['Background']
    bg.inputs['Color'].default_value = (1, 1, 1, 1)
    bg.inputs['Strength'].default_value = 0.55
    light = bpy.data.lights.new('sun', 'SUN')
    light.energy, light.angle, light.color = 2.2, math.radians(24), (1.0, 0.96, 0.9)
    sun = bpy.data.objects.new('sun', light)
    sun.rotation_euler = (math.radians(-36), math.radians(-34), 0)
    sc.collection.objects.link(sun)
    return sc


def camera(sc, cx, cy, scale, roll):
    cam = bpy.data.cameras.new('cam')
    cam.type = 'ORTHO'
    cam.ortho_scale = scale * S
    o = bpy.data.objects.new('cam', cam)
    o.location = (cx * S, cy * S, 40)
    o.rotation_euler = (0, 0, roll)
    sc.collection.objects.link(o)
    sc.camera = o


MATS = {}


def mat(name):
    if name in MATS:
        return MATS[name]
    low, high = PAPER[name]
    m = bpy.data.materials.new(name)
    m.use_nodes = True
    nt = m.node_tree
    p = nt.nodes['Principled BSDF']
    p.inputs['Roughness'].default_value = 0.92
    coords = nt.nodes.new('ShaderNodeTexCoord')
    blotch = nt.nodes.new('ShaderNodeTexNoise')
    blotch.inputs['Scale'].default_value = 3.0
    blotch.inputs['Detail'].default_value = 6.0
    blotch.inputs['Roughness'].default_value = 0.62
    ramp = nt.nodes.new('ShaderNodeValToRGB')
    ramp.color_ramp.elements[0].position, ramp.color_ramp.elements[0].color = 0.42, lin(low)
    ramp.color_ramp.elements[1].position, ramp.color_ramp.elements[1].color = 0.58, lin(high)
    fibre = nt.nodes.new('ShaderNodeTexNoise')
    fibre.inputs['Scale'].default_value = 32.0
    fibre.inputs['Detail'].default_value = 3.0
    bump = nt.nodes.new('ShaderNodeBump')
    bump.inputs['Strength'].default_value = 0.45
    bump.inputs['Distance'].default_value = 0.02
    nt.links.new(coords.outputs['Object'], blotch.inputs['Vector'])
    nt.links.new(blotch.outputs['Fac'], ramp.inputs['Fac'])
    nt.links.new(ramp.outputs['Color'], p.inputs['Base Color'])
    nt.links.new(coords.outputs['Object'], fibre.inputs['Vector'])
    nt.links.new(fibre.outputs['Fac'], bump.inputs['Height'])
    nt.links.new(bump.outputs['Normal'], p.inputs['Normal'])
    MATS[name] = m
    return m


def prism(pts, name, z, thick=THICK):
    """one flat paper piece: the outline `pts`, its middle at height z"""
    clean = [p for i, p in enumerate(pts) if math.dist(p, pts[i - 1]) > 0.05]
    bm = bmesh.new()
    low = [bm.verts.new((x * S, y * S, -thick / 2 * S)) for x, y in clean]
    top = [bm.verts.new((x * S, y * S, thick / 2 * S)) for x, y in clean]
    n = len(clean)
    bm.faces.new(low[::-1])
    bm.faces.new(top)
    for i in range(n):
        bm.faces.new((low[i], low[(i + 1) % n], top[(i + 1) % n], top[i]))
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    mesh = bpy.data.meshes.new('paper')
    bm.to_mesh(mesh)
    bm.free()
    mesh.materials.append(mat(name))
    o = bpy.data.objects.new('paper', mesh)
    o.location.z = z * S
    bevel = o.modifiers.new('edge', 'BEVEL')
    bevel.width, bevel.segments, bevel.limit_method, bevel.use_clamp_overlap = 1.1 * S, 2, 'ANGLE', True
    bpy.context.scene.collection.objects.link(o)


def blade_layers(style, x, prof):
    """(material, outline, height step, thickness) of a blade's layers"""
    outer, face, ridge = shapes.BLADES[style]
    body = [(y, w) for y, w in prof if w > 0]
    tip, base = prof[-1][0], prof[0][0]
    full = [(x - w, y) for y, w in prof] + [(x + w, y) for y, w in reversed(body)]
    spine = body[:max(2, len(body) - max(1, len(body) // 8))]
    half = max(1.5, body[0][1] * 0.09)
    line = [(x - half, y) for y, _ in spine] + [(x + half, y) for y, _ in reversed(spine)]
    yield outer, full, 5.0, THICK
    if style == 'gilded':   # a gold rim all round: the steel core sits inside it, lit on one side
        core = [(x - w * 0.7, y) for y, w in body] + [(x, tip - 30)] + [(x + w * 0.7, y) for y, w in reversed(body)]
        yield 'steel_s', core, 2.5, 4
        yield face, [(x - w * 0.7, y) for y, w in body] + [(x, tip - 30), (x, base)], 2.0, 4
    else:
        yield face, [(x - w * 0.74, y) for y, w in body] + [(x, tip - 18), (x, base)], 3.0, 4
    yield ridge, line, 4.0, 4


def pieces(parts):
    """every part as flat layers: (material, outline, z, thickness)"""
    z = 20.0
    for part in parts:
        kind = part[0]
        if kind == 'rod':
            _, name, x, y0, y1, r, grain = part
            yield name, shapes.box(x - r, y0, x + r, y1, 4), z, THICK
            z += 4.5
            if grain:
                yield grain, shapes.box(x + r * 0.2, y0 + 3, x + r * 0.82, y1 - 3), z, 4
                z += 2.5
        elif kind == 'wraps':
            _, name, x, y0, y1, r, turns, lean = part
            pitch = (y1 - y0) / turns
            for i in range(turns):
                y = y0 + pitch * i
                band = [(x - r - 4, y), (x + r + 4, y + pitch * 0.45), (x + r + 4, y + pitch * 1.02), (x - r - 4, y + pitch * 0.57)]
                if lean < 0:
                    band = [(2 * x - bx, by) for bx, by in band][::-1]
                yield name, band, z + i * 0.25, 5
            z += 5.0 + turns * 0.25
        elif kind == 'blade':
            for name, outline, step, thick in blade_layers(part[1], part[2], part[3]):
                yield name, outline, z, thick
                z += step
        elif kind == 'poly':
            yield part[1], part[2], z, THICK
            z += 4.0
        elif kind == 'dots':
            for i, (x, y, r) in enumerate(part[2]):
                yield part[1], shapes.oval(x, y, r, r, n=36), z + i * 0.2, THICK
            z += 4.5


def render(path, fmt='PNG'):
    sc = bpy.context.scene
    sc.render.image_settings.file_format = fmt
    sc.render.image_settings.color_mode = 'RGBA' if fmt == 'PNG' else 'RGB'
    if fmt == 'JPEG':
        sc.render.image_settings.quality = 88
    sc.render.filepath = os.path.abspath(path)
    bpy.ops.render.render(write_still=True)


def picture(key, parts):
    layers = list(pieces(parts))
    xs = [x for _, outline, _, _ in layers for x, _ in outline]
    ys = [y for _, outline, _, _ in layers for _, y in outline]
    x0, x1, y0, y1 = min(xs) - PAD, max(xs) + PAD, min(ys) - PAD, max(ys) + PAD
    long_side, short_side = round((y1 - y0) * PPU), round((x1 - x0) * PPU)
    MATS.clear()
    sc = reset(long_side, short_side)
    sc.render.film_transparent = True
    camera(sc, (x0 + x1) / 2, (y0 + y1) / 2, y1 - y0, math.pi / 2)   # rolled: the point of the blade is to the right
    for name, outline, z, thick in layers:
        prism(outline, name, z, thick)
    render(os.path.join(OUT, key + '.png'))
    return long_side, short_side


def card_paper():
    """the cream card the weapons lie on, the same grain as the pieces"""
    MATS.clear()
    sc = reset(360, 960)
    camera(sc, 0, 400, 800, 0)
    prism(shapes.box(-400, -100, 400, 900), 'cardstock', 0, 8)
    render(os.path.join(UI, 'weapon-card.jpg'), 'JPEG')


os.makedirs(OUT, exist_ok=True)
start = time.time()
count = 0
for family in shapes.FAMILIES:
    for tier in range(1, 11):
        key = f'{family}{tier}'
        if ONLY and not any(key.startswith(p) for p in ONLY):
            continue
        w, h = picture(key, shapes.weapon(family, tier))
        count += 1
        print('ICON', key, w, h, f'{time.time() - start:.0f}s', flush=True)
if not ONLY or 'card' in ONLY:
    card_paper()
print('ICONS', count, 'rendered', f'{time.time() - start:.0f}s')
