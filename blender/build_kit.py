"""Render the whole modular gladiator kit -> game/assets/chars/kit/{sprites/*.png, kit.json}

  D:/blender/blender.exe -b --python game/blender/build_kit.py -- [samples] [only_prefix,...]

only_prefix limits the render to keys starting with any of the prefixes (kit.json is merged, not replaced).
At the end the production atlases are rebuilt (`npm run assets:atlas`), so the WebP pages never lag behind the PNGs.
Set KIT_NO_ATLAS=1 to skip that step (e.g. quick preview renders); then run `npm run assets:atlas` yourself before a commit.
"""
import bpy, sys, os, json, math, time, shutil, subprocess
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import sprite_lib as sl  # noqa: E402
import kit  # noqa: E402
import armor  # noqa: E402
import weapons  # noqa: E402

pc = sl.pc
argv = sys.argv[sys.argv.index('--') + 1:] if '--' in sys.argv else []
SAMPLES = int(argv[0]) if argv else 40
ONLY = [p for p in (argv[1].split(',') if len(argv) > 1 else []) if p]
OUT = os.path.join(sl.GAME, 'assets', 'chars', 'kit')
SPR = os.path.join(OUT, 'sprites')
os.makedirs(SPR, exist_ok=True)
HEAD_S = 1.12
SPRITE_ALPHA = {'beard1': 0.42}   # stubble: a thin shadow of hair, not a solid layer

sc = sl.setup(samples=SAMPLES)


def gladius(c):
    L, E, R = kit.L, kit.E, kit.R
    L(c, R(0.78, 0.26, 0.1, 0.0, 0.0), sl.tex_board('grip', 'flute', scale=0.9, rot=1.5708), 0.0, 0.1, 'grip')
    g = armor.M('brass')
    L(c, E(0.19, 0.19, -0.46, 0.0, 32), g, 0.02, 0.1, 'pommel')
    L(c, R(0.2, 0.64, 0.07, 0.44, 0.0), armor.M('bronze'), 0.1, 0.08, 'guard')
    L(c, [(0.5, 0.16), (1.9, 0.19), (2.55, 0.15), (3.05, 0.0), (2.55, -0.15), (1.9, -0.19), (0.5, -0.16)], armor.M('steel'), 0.04, 0.06, 'blade')
    L(c, R(1.9, 0.06, 0.03, 1.55, 0.0), armor.M('steel_d'), 0.1, 0.02, 'fuller')


# ------------------------------------------------------------------ job list: key -> (builder(coll), tint, head?)
jobs = {}
for part, fn in kit.BODY.items():
    jobs['body_' + part] = (fn, kit.BODY_TINT[part], False)
for part, (fn, tint) in kit.CUT.items():
    jobs['cut_' + part] = (fn, tint, False)
for i, f in enumerate(kit.FACES):
    jobs[f'face{i}_head'] = ((lambda c, f=f: kit.face_head(c, f)), 'skin', True)
    jobs[f'face{i}_eyes'] = ((lambda c, f=f: kit.face_eyes(c, f)), None, True)
    if f['lid'] >= 0.02:
        jobs[f'face{i}_lids'] = ((lambda c, f=f: kit.face_lids(c, f)), 'skin', True)
    jobs[f'face{i}_brows'] = ((lambda c, f=f: kit.face_brows(c, f)), 'hair', True)
    jobs[f'face{i}_nose'] = ((lambda c, f=f: kit.face_nose(c, f)), 'skin', True)
HAIR_PARTS = {}
for i, (name, fn) in enumerate(kit.HAIRS):
    jobs[f'hair{i}_front'] = ((lambda c, fn=fn: fn(c, sl.new_coll('_trash'))), 'hair', True)
    jobs[f'hair{i}_back'] = ((lambda c, fn=fn: fn(sl.new_coll('_trash'), c)), 'hair', True)
for i, (name, fn) in enumerate(kit.BEARDS):
    jobs[f'beard{i}'] = (fn, 'hair', True)
for key, (fn, bone, slot, piece, t) in armor.pieces().items():
    jobs[key] = (fn, None, bone == 'head')
jobs['weapon_gladius'] = (gladius, None, False)
for t, fn in weapons.SWORDS.items():
    jobs[f'weapon_sword{t}'] = (fn, None, False)
for fam, table in (('axe', weapons.AXES), ('spear', weapons.SPEARS), ('hammer', weapons.HAMMERS)):
    for t, fn in table.items():
        jobs[f'weapon_{fam}{t}'] = (fn, None, False)

meta_path = os.path.join(OUT, 'kit.json')
old = json.load(open(meta_path)) if (ONLY and os.path.exists(meta_path)) else {}
sprites = old.get('sprites', {})
t0 = time.time()
n = 0
for key, (fn, tint, head) in jobs.items():
    if ONLY and not any(key.startswith(p) for p in ONLY):
        continue
    coll = sl.new_coll('job')
    fn(coll)
    for c in list(bpy.data.collections):
        if c.name.startswith('_trash'):
            sl.clear_coll(c)
            bpy.data.collections.remove(c)
    if not coll.objects:
        sprites.pop(key, None)
        p = os.path.join(SPR, key + '.png')
        if os.path.exists(p):
            os.remove(p)
        bpy.data.collections.remove(coll)
        continue
    if head:
        for o in coll.objects:
            o.location.x *= HEAD_S
            o.location.y *= HEAD_S
            o.scale = (o.scale[0] * HEAD_S, o.scale[1] * HEAD_S, 1.0)
    info = sl.render_coll(coll, os.path.join(SPR, key + '.png'))
    info['tint'] = tint
    fam = key[len('weapon_'):].rstrip('0123456789') if key.startswith('weapon_') else None
    if fam in weapons.GRIP2:   # two-handed: where the back hand holds the haft (weapon-bone units)
        info['grip2'] = list(weapons.GRIP2[fam])
    if key in SPRITE_ALPHA:
        info['alpha'] = SPRITE_ALPHA[key]
    sprites[key] = info
    sl.clear_coll(coll)
    bpy.data.collections.remove(coll)
    n += 1
    print('SPRITE', key, info['w'], info['h'], f'{time.time() - t0:.0f}s', flush=True)

# ------------------------------------------------------------------ skeleton + layer order
BONES = [
    ('pelvis', None, 0.0, 4.75), ('torso', 'pelvis', 0.0, 0.0), ('head', 'torso', 0.12, 3.35),
    ('arm_b_up', 'torso', -1.35, 2.6), ('arm_b_lo', 'arm_b_up', 0.0, -1.85), ('hand_b', 'arm_b_lo', 0.0, -1.6),
    ('arm_f_up', 'torso', 1.42, 2.6), ('arm_f_lo', 'arm_f_up', 0.0, -1.85), ('hand_f', 'arm_f_lo', 0.0, -1.6),
    ('weapon', 'hand_f', 0.06, -0.38),
    ('leg_b_up', 'pelvis', -0.52, -0.55), ('leg_b_lo', 'leg_b_up', 0.0, -2.1), ('foot_b', 'leg_b_lo', 0.0, -2.0),
    ('leg_f_up', 'pelvis', 0.55, -0.55), ('leg_f_lo', 'leg_f_up', 0.0, -2.1), ('foot_f', 'leg_f_lo', 0.0, -2.0),
]


def limb(side):
    b = side == 'b'
    s = '_' + side
    return [
        dict(bone='foot' + s, slot='body', piece='foot', back=b), dict(bone='foot' + s, slot='boots', piece='foot', back=b),
        dict(bone='leg' + s + '_lo', slot='body', piece='leg_lo', back=b), dict(bone='leg' + s + '_lo', slot='boots', piece='cuff', back=b),
        dict(bone='leg' + s + '_lo', slot='greaves', piece='shin', back=b),
        dict(bone='leg' + s + '_up', slot='body', piece='leg_up', back=b),
        dict(bone='leg' + s + '_lo', slot='greaves', piece='knee', back=b),
    ]


LAYERS = [dict(bone='head', slot='hair', piece='back')]
LAYERS += [dict(bone='hand_b', slot='body', piece='hand', back=True),
           dict(bone='arm_b_lo', slot='body', piece='arm_lo', back=True), dict(bone='arm_b_lo', slot='armor', piece='bracer', back=True),
           dict(bone='arm_b_up', slot='body', piece='arm_up', back=True), dict(bone='arm_b_up', slot='shoulders', piece='', back=True)]
LAYERS += limb('b') + limb('f')
# slot 'cut' = the two halves of a torn neck, drawn only for a pose with `neck_cut` (finishers, #20)
LAYERS += [dict(bone='torso', slot='body', piece='torso'),
           dict(bone='torso', slot='cut', piece='torso_edge'), dict(bone='torso', slot='cut', piece='torso'),
           dict(bone='torso', slot='armor', piece='torso'), dict(bone='torso', slot='cut', piece='torso_tissue'),
           dict(bone='pelvis', slot='body', piece='pelvis'), dict(bone='pelvis', slot='armor', piece='skirt'),
           dict(bone='head', slot='cut', piece='head_tissue'), dict(bone='head', slot='cut', piece='head_edge'),
           dict(bone='head', slot='cut', piece='head_neck'), dict(bone='head', slot='face', piece='head'), dict(bone='head', slot='face', piece='eyes'), dict(bone='head', slot='face', piece='lids'),
           dict(bone='head', slot='face', piece='brows'), dict(bone='head', slot='beard', piece=''), dict(bone='head', slot='face', piece='nose'),
           dict(bone='head', slot='hair', piece='front'), dict(bone='head', slot='helmet', piece=''),
           dict(bone='arm_f_lo', slot='body', piece='arm_lo'), dict(bone='arm_f_lo', slot='armor', piece='bracer'),
           dict(bone='arm_f_up', slot='body', piece='arm_up'), dict(bone='arm_f_up', slot='shoulders', piece=''),
           dict(bone='weapon', slot='weapon', piece='gladius'), dict(bone='hand_f', slot='body', piece='hand')]

POSE = {'pelvis': 0, 'torso': 3, 'head': -3, 'arm_b_up': -18, 'arm_b_lo': 35, 'hand_b': 0,
        'arm_f_up': 22, 'arm_f_lo': 62, 'hand_f': -10, 'weapon': -40,
        'leg_b_up': -14, 'leg_b_lo': 4, 'foot_b': 10, 'leg_f_up': 16, 'leg_f_lo': -6, 'foot_f': -10}

kitjson = {
    'ppu': sl.PPU, 'sun_dir': [6.0 / 16.0, -9.0 / 16.0], 'zk': pc.ZK, 'head_scale': HEAD_S,
    'neutral': kit.N, 'jaw_center': [kit.HEAD_C[0] * HEAD_S, kit.HEAD_C[1] * HEAD_S], 'ref_jaw': [1.0, 1.125],
    'bones': [dict(name=a, parent=b, x=x, y=y) for a, b, x, y in BONES],
    'layers': LAYERS, 'pose_test': POSE,
    'skins': [dict(name=n_, color=c) for n_, c in zip(kit.SKIN_NAMES, kit.SKINS)],
    'hair_colors': [dict(name=n_, color=c) for n_, c in zip(kit.HAIR_COLOR_NAMES, kit.HAIR_COLORS)],
    'faces': [dict(name=f['name'], jaw=[f['a'], f['b']]) for f in kit.FACES],
    'hairs': [h[0] for h in kit.HAIRS], 'beards': [b[0] for b in kit.BEARDS],
    'hair_top_back': [5, 9], 'hood_helmets': [3, 7],
    'sets': armor.SET_NAMES,
    'sprites': sprites,
}
json.dump(kitjson, open(meta_path, 'w'), indent=1)
print('KIT', n, 'sprites rendered,', len(sprites), 'in kit.json', f'{time.time() - t0:.0f}s')


def rebuild_atlas():
    """Repack assets/chars/kit/atlas/*.webp from the fresh PNGs (production build reads the atlas, not the PNGs)."""
    if os.environ.get('KIT_NO_ATLAS') == '1':
        print('ATLAS skipped (KIT_NO_ATLAS=1) - run `npm run assets:atlas` before committing sprites')
        return
    npm = shutil.which('npm')
    if not npm:
        print('ATLAS WARNING: npm not found - run `npm run assets:atlas` in game/ before committing sprites')
        return
    r = subprocess.run([npm, 'run', 'assets:atlas'], cwd=sl.GAME, capture_output=True, text=True)
    if r.returncode == 0:
        print('ATLAS', (r.stdout.strip().splitlines() or [''])[-1])
    else:
        print(f'ATLAS FAILED ({r.returncode}) - run `npm run assets:atlas` by hand')
        print(r.stderr.strip())


rebuild_atlas()
