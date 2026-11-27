"""Pulpport's vendors as paper busts (#33), from docs/FABULA.md, each in two states for talking:

  old_crease     Old Crease, the weaponsmith: crumpled like a letter from a pocket, leather apron, a hammer on the shoulder
  armourer       the Armourer: mail shirt, an iron pauldron, rivets on the collar
  mirra          Mirra Inkwell, the enchantress: ink-black fingers, a flame held "under the counter"
  brother_tape   Brother Tape, priest of the Glue: a cream robe patched with tape, a roll of tape on a cord
  magpie         Magpie, lanista and trainer: one-eyed, glued together from newspaper clippings of his old fights

  python -I tools/blender.py blender/npcs.py -- [samples]

Writes assets/npc/<id>.png (mouth shut), assets/npc/<id>_talk.png (mouth open, same frame) and assets/npc/npcs.json.
Faces, hair and beards are the gladiator kit's own (blender/kit.py) in real colours, so the vendors look like they live in
the same world as the fighters. They face right, like the fighters, in three-quarter view.
"""
import bpy, sys, os, json, math, random
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import sprite_lib as sl  # noqa: E402
import kit  # noqa: E402
import armor  # noqa: E402

pc = sl.pc
L, E, R = kit.L, kit.E, kit.R
M = armor.M

argv = sys.argv[sys.argv.index('--') + 1:] if '--' in sys.argv else []
SAMPLES = int(argv[0]) if argv else 64
OUT = os.path.join(sl.GAME, 'assets', 'npc')
PPU = 160.0      # a bust is 6.1 units tall -> 976 px: the shop screen shows it ~half the screen high (#267)
os.makedirs(OUT, exist_ok=True)

sc = sl.setup(samples=SAMPLES)
NS0 = dict(kit.NS)
M_HAIR0 = kit.M_hair


def _rgb(h):
    h = h.lstrip('#')
    return [int(h[i:i + 2], 16) / 255 for i in (0, 2, 4)]


def colour(skin, hair):
    """point the kit's neutral skin / hair materials at real colours (the game tints them; a bust is baked)"""
    s = _rgb(skin)
    for k, v in NS0.items():
        n = _rgb(v)
        kit.NS[k] = kit._hex([n[i] * s[i] / kit.N for i in range(3)])
    lo = kit._hex([c * 0.8 for c in _rgb(hair)])
    kit.M_hair = lambda c=None: M_HAIR0(lo if c == kit.HAIR_LO else hair)


def part(coll, dz, build):
    """build a piece in its own collection and lift it to its own height (dz units) in the bust"""
    tmp = sl.new_coll('_part')
    build(tmp)
    for o in list(tmp.objects):
        o.location.z += dz * pc.ZK
        tmp.objects.unlink(o)
        coll.objects.link(o)
    bpy.data.collections.remove(tmp)


def trash():
    c = sl.new_coll('_trash')
    return c


# ------------------------------------------------------------------ the bust: shoulders cut off with a torn edge
BUST = [(-2.05, -2.7), (-2.05, -1.35), (-1.75, -0.78), (-1.1, -0.48), (-0.35, -0.32), (0.55, -0.32), (1.3, -0.48),
        (1.95, -0.85), (2.2, -1.4), (2.25, -2.7)]


def bust(c, mat, seed):
    L(c, sl.torn(BUST, 0.03, seed, 0.06), mat, 0.0, 0.12, 'bust')


def neck(c, skin_lo):
    L(c, R(0.8, 1.0, 0.25, 0.12, -0.1), kit.M_skin(skin_lo), 0.0, 0.1, 'neck')


def collar(c, mat, w=1.7, h=0.36, y=-0.42):
    L(c, R(w, h, h * 0.45, 0.15, y), mat, 0.0, 0.06, 'collar')


def face(c, f, beard=None, hair=None, mouth_open=False, beard_over=True):
    """head + kit face pieces stacked at their own heights (in the game they are separate sprites)"""
    tr = trash()
    if hair:
        part(c, -0.7, lambda t: hair(sl.new_coll('_trash'), t))         # back hair behind the bust
    part(c, 0.0, lambda t: kit.face_head(t, f))
    if mouth_open:
        part(c, 0.31, lambda t: kit.face_mouth_open(t, f))
    part(c, 0.36, lambda t: kit.face_eyes(t, f))
    if f['lid'] >= 0.02:
        part(c, 0.42, lambda t: kit.face_lids(t, f))
    part(c, 0.48, lambda t: kit.face_brows(t, f))
    if beard:
        part(c, 0.5 if beard_over else 0.25, lambda t: fit_jaw(t, beard, f))
        if mouth_open and beard_over:
            part(c, 0.58, lambda t: kit.face_mouth_open(t, f))
    part(c, 0.62, lambda t: kit.face_nose(t, f))
    if hair:
        part(c, 0.68, lambda t: hair(t, sl.new_coll('_trash')))
    for x in list(bpy.data.collections):
        if x.name.startswith('_trash'):
            sl.clear_coll(x)
            bpy.data.collections.remove(x)
    del tr


def fit_jaw(t, beard, f):
    """beards are drawn on the reference jaw; stretch them about the jaw centre to this face (as PaperRig does)"""
    beard(t)
    sx, sy = f['a'] / 1.0, f['b'] / 1.125
    cx, cy = kit.HEAD_C
    for o in t.objects:
        o.location.x = cx + (o.location.x - cx) * sx
        o.location.y = cy + (o.location.y - cy) * sy
        o.scale = (o.scale[0] * sx, o.scale[1] * sy, o.scale[2])


def paper(name, col, fiber='washi'):
    return sl.tex_paper(name, col, fiber, 0.9)


# ------------------------------------------------------------------ the five vendors
def old_crease(c, talk):
    colour('#d9935f', '#8f8a85')
    shirt = sl.tex_board('crease_shirt', 'craft', tint='#b9a27e', scale=0.3)
    part(c, -0.6, lambda t: (bust(t, shirt, 3), neck(t, kit.NS['lo'])))
    # a war hammer of pressed carton resting on the far shoulder, its head behind the bald crown
    def hammer(t):
        L(t, R(0.2, 3.3, 0.06, -1.25, 0.6, 0.42), sl.tex_board('crease_haft', 'brown', tint='#7d5e3e', scale=0.3, rot=1.2), 0.0, 0.08, 'haft')
        L(t, R(1.25, 0.72, 0.1, -1.95, 2.15, 0.42), sl.tex_board('crease_head', 'flute', scale=0.6, rot=0.4), 0.1, 0.14, 'head')
        L(t, R(0.3, 0.8, 0.06, -1.95, 2.15, 0.42), M('iron_d'), 0.25, 0.04, 'band')
    part(c, -1.1, hammer)
    def apron(t):
        L(t, sl.torn([(-1.25, -2.7), (-1.2, -1.2), (-0.7, -0.95), (1.1, -0.95), (1.55, -1.2), (1.6, -2.7)], 0.025, 7), M('leather'), 0.0, 0.08, 'apron')
        for x0, x1 in ((-0.7, -0.35), (1.1, 0.75)):   # straps up over the shoulders
            L(t, [(x0, -0.95), (x0 + 0.25, -0.95), (x1 + 0.05, -0.4), (x1 - 0.2, -0.4)], M('leather_d'), 0.08, 0.04, 'strap')
        L(t, R(0.9, 0.55, 0.08, 0.3, -1.85), M('leather_d'), 0.1, 0.04, 'pocket')
        L(t, R(0.08, 0.7, 0.03, 0.12, -1.6, 0.2), sl.tex_board('crease_tongs', 'brown', tint='#5e4530', scale=0.3), 0.15, 0.04, 'tongs')
    part(c, -0.42, apron)
    face(c, kit.FACES[7], beard=lambda t: kit.beard_full(t), hair=None, mouth_open=talk)
    # the creases: the folds of a letter pulled out of a pocket, across the forehead, the cheek and the apron
    lo = kit.M_skin(kit.NS['scar'])
    def creases(t):
        for x, y, w, a in ((-0.35, 1.95, 1.3, -0.12), (0.05, 1.25, 0.06, 0.0), (-0.45, 0.85, 0.9, 0.5), (0.95, 1.55, 0.6, -0.9)):
            if w > 0.1:
                L(t, R(w, 0.035, 0.015, x, y, a), lo, 0.0, 0.015, 'crease')
        for x, y, w, a in ((0.2, -1.4, 2.4, 0.18), (-0.4, -2.2, 1.6, -0.4)):
            L(t, R(w, 0.04, 0.015, x, y, a), M('leather_d'), 0.0, 0.015, 'fold')
    part(c, 0.3, creases)


def armourer(c, talk):
    colour('#8a5232', '#231a16')
    part(c, -0.6, lambda t: (bust(t, M('chain'), 11), neck(t, kit.NS['lo'])))
    def kit_(t):
        L(t, sl.torn([(-1.4, -2.7), (-1.35, -1.6), (1.6, -1.6), (1.7, -2.7)], 0.02, 12), M('leather_d'), 0.0, 0.06, 'belt_area')
        L(t, R(3.2, 0.3, 0.08, 0.15, -1.7), M('leather'), 0.06, 0.05, 'belt')
        L(t, R(0.42, 0.36, 0.06, 0.4, -1.7), M('brass'), 0.11, 0.04, 'buckle')
        collar(t, M('leather'), 1.9, 0.42, -0.45)
        for i in range(6):
            L(t, E(0.05, 0.05, -0.6 + i * 0.3, -0.45, 12), M('brass'), 0.08, 0.03, 'rivet')
        # iron pauldron on the near shoulder
        for k, (dy, w) in enumerate(((0.0, 1.25), (-0.32, 1.15), (-0.62, 1.0))):
            L(t, R(w, 0.42, 0.18, 1.65, -0.85 + dy, -0.45), M('iron') if k % 2 == 0 else M('iron_d'), 0.12 + k * 0.05, 0.06, 'lame')
        L(t, E(0.06, 0.06, 1.5, -0.7, 12), M('steel'), 0.3, 0.03, 'rivet')
    part(c, -0.42, kit_)
    face(c, kit.FACES[1], beard=lambda t: kit.beard_handlebar(t), hair=kit.hair_crop, mouth_open=talk)


def mirra(c, talk):
    colour('#eeb48e', '#231a16')
    robe = paper('mirra_robe', '#5b2c83')
    part(c, -0.6, lambda t: (bust(t, robe, 21), neck(t, kit.NS['lo'])))
    ink = sl.tex_paper('ink', '#1b1620', None)
    def dress(t):
        L(t, [(-0.5, -0.38), (0.7, -0.38), (0.15, -1.25)], kit.M_skin(kit.NS['skin']), 0.0, 0.05, 'neckline')
        for s_ in (-1, 1):   # gold trim down the neckline
            L(t, [(0.15 + s_ * 0.62, -0.36), (0.15 + s_ * 0.72, -0.4), (0.18, -1.36), (0.12, -1.28)], M('gold'), 0.06, 0.03, 'trim')
        L(t, E(0.11, 0.11, 0.15, -1.15, 20), paper('mirra_gem', '#2f6f8f'), 0.1, 0.03, 'gem')
        for x, y in ((-1.2, -1.6), (-1.0, -2.1), (1.3, -2.3)):   # ink spots on the robe
            L(t, pc.xf(pc.blob_pts(0.12, 0.09, 0.2, int(x * 10 + 50)), x, y), ink, 0.06, 0.02, 'ink_spot')
    part(c, -0.42, dress)
    face(c, kit.FACES[5], hair=kit.hair_long, mouth_open=talk)
    part(c, 0.66, lambda t: L(t, E(0.08, 0.11, -0.86, 0.72, 16), M('gold'), 0.0, 0.03, 'earring'))
    # the near hand raised in front, fingers black with ink, a small flame above the palm
    skin = kit.M_skin(kit.NS['skin'])
    def hand(t):
        L(t, [(1.15, -2.7), (2.4, -2.7), (2.25, -1.78), (1.5, -1.78)], robe, 0.0, 0.1, 'sleeve')
        L(t, R(0.8, 0.18, 0.06, 1.87, -1.8), M('gold'), 0.1, 0.03, 'cuff')
        L(t, E(0.36, 0.3, 1.85, -1.45), skin, 0.12, 0.08, 'palm')
        for i, (dx, ln) in enumerate(((-0.24, 0.42), (-0.08, 0.52), (0.08, 0.5), (0.23, 0.4))):
            x = 1.85 + dx
            L(t, R(0.13, ln, 0.06, x, -1.2 + ln / 2 - 0.05, -0.05 * (i - 1.5)), skin, 0.14, 0.06, 'finger')
            L(t, R(0.13, ln * 0.45, 0.06, x + 0.005, -1.2 + ln - ln * 0.22 - 0.05, -0.05 * (i - 1.5)), ink, 0.2, 0.03, 'inked')
        L(t, R(0.14, 0.4, 0.06, 1.48, -1.4, 0.7), skin, 0.15, 0.06, 'thumb')
        for k, (col, w, h, y) in enumerate((('#c8402a', 0.62, 1.0, -0.4), ('#ec8a2c', 0.44, 0.78, -0.5), ('#f6cf55', 0.24, 0.48, -0.6))):
            L(t, pc.xf(pc.teardrop_pts(w, h), 1.86, y), paper('flame%d' % k, col), 0.3 + k * 0.05, 0.04, 'flame')
    part(c, 0.8, hand)


def brother_tape(c, talk):
    colour('#f2c4a2', '#7a4a2a')
    robe = M('linen')
    part(c, -0.6, lambda t: (bust(t, robe, 31), neck(t, kit.NS['lo'])))
    tape = sl.tex_paper('tape', '#e7d79a', 'white', 0.5)
    tape_d = sl.tex_paper('tape_d', '#cdb86f', 'white', 0.5)
    def habit(t):
        L(t, R(2.4, 0.55, 0.25, 0.15, -0.55), M('linen_d'), 0.0, 0.08, 'hood')
        L(t, R(0.12, 1.5, 0.05, -0.4, -1.35, -0.15), M('rag_d'), 0.08, 0.03, 'cord')
        L(t, R(0.12, 1.5, 0.05, 0.75, -1.35, 0.15), M('rag_d'), 0.08, 0.03, 'cord')
        # the roll of tape on the cord: a ring with a hole
        pc.layer(E(0.42, 0.42, 0.18, -2.05, 40), tape_d, h=0.08 * 1, z=0.12, holes=[list(reversed(E(0.2, 0.2, 0.18, -2.05, 32)))], coll=t, name='roll', bevel=0.01)
        L(t, R(0.17, 0.4, 0.02, 0.5, -2.42, 0.25), tape, 0.2, 0.02, 'tape_end')
        # strips of tape mending tears in the robe
        for k, (x, y, a) in enumerate(((-1.25, -1.5, 0.6), (-1.25, -1.5, -0.6), (1.5, -2.1, 0.25), (1.35, -1.0, -0.8))):
            L(t, R(0.72, 0.2, 0.02, x, y, a), tape, 0.14 + 0.03 * k, 0.02, 'tape')   # own heights: crossing strips must not touch
        L(t, R(0.025, 0.55, 0.01, -1.25, -1.5, 0.3), M('linen_d'), 0.12, 0.01, 'tear')
    part(c, -0.42, habit)
    face(c, kit.FACES[4], hair=kit.hair_receding, mouth_open=talk)
    part(c, 0.7, lambda t: L(t, R(0.42, 0.13, 0.02, 0.98, 1.75, 0.6), tape, 0.0, 0.02, 'plaster'))   # a strip on his own brow


def magpie(c, talk):
    colour('#c47d4e', '#8f8a85')
    news = pc.pattern_mat('news', 'hstripes', '#ece6d8', '#8a8478', freq=11.0, ratio=0.72, grit=0.5)
    news_y = pc.pattern_mat('news_y', 'hstripes', '#e3d6b4', '#7d7462', freq=11.0, ratio=0.72, grit=0.5)
    ink = sl.tex_paper('news_ink', '#2a2522', None)
    grey = sl.tex_paper('news_photo', '#9b958a', 'white', 0.6)
    part(c, -0.6, lambda t: (bust(t, news, 41), neck(t, kit.NS['lo'])))
    rnd = random.Random(5)
    def clippings(t):
        k = 0
        for row, y in enumerate((-0.75, -1.4, -2.05)):
            for col in range(4):
                x = -1.5 + col * 1.0 + (0.3 if row % 2 else 0) + rnd.uniform(-0.1, 0.1)
                w, h = rnd.uniform(0.85, 1.15), rnd.uniform(0.6, 0.78)
                a = rnd.uniform(-0.18, 0.18)
                if x + w / 2 > 2.3 or (row == 0 and abs(x - 0.15) < 0.5):
                    continue
                z = 0.02 * k
                L(t, sl.torn(R(w, h, 0.0, x, y, a), 0.02, 60 + k, 0.05), news if k % 3 else news_y, z, 0.03, 'clip')
                L(t, R(w * 0.7, 0.1, 0.0, x - w * 0.08, y + h * 0.3, a), ink, z + 0.03, 0.01, 'headline')
                if k % 4 == 1:
                    L(t, R(w * 0.32, h * 0.42, 0.0, x + w * 0.22, y - h * 0.08, a), grey, z + 0.03, 0.01, 'photo')
                k += 1
        L(t, [(-1.6, -0.6), (-1.2, -0.6), (1.8, -2.7), (1.3, -2.7)], M('red_d'), 0.5, 0.05, 'sash')
    part(c, -0.42, clippings)
    face(c, kit.FACES[3], hair=kit.hair_crop, mouth_open=talk)
    # one eye: a patch over the near eye on a strap round the head; a clipping glued over the skull
    def patch(t):
        L(t, [(-0.95, 1.95), (0.95, 1.18), (0.98, 1.3), (-0.9, 2.07)], ink, 0.0, 0.02, 'strap')
        L(t, E(0.3, 0.26, 0.74, 1.36), ink, 0.04, 0.05, 'patch')
        L(t, sl.torn(R(0.62, 0.42, 0.0, -0.45, 1.05, 0.25), 0.02, 77, 0.04), news_y, 0.0, 0.02, 'clip_face')
        L(t, R(0.45, 0.07, 0.0, -0.47, 1.14, 0.25), ink, 0.03, 0.01, 'headline')
    part(c, 0.74, patch)


BOX = (-2.7, -2.8, 2.9, 3.3)   # every bust in the same frame, so the still and the talking state line up exactly


def render_box(coll, path):
    """sprite_lib.render_coll with a fixed frame instead of the collection's own bounds"""
    for ch in sc.collection.children:
        ch.hide_render = ch is not coll
    x0, y0, x1, y1 = BOX
    W, H = int(round((x1 - x0) * PPU)), int(round((y1 - y0) * PPU))
    cam = sc.camera
    cam.data.ortho_scale = max(W, H) / PPU
    cam.location = ((x0 + x1) / 2, (y0 + y1) / 2, 40)
    cam.rotation_euler = (0, 0, 0)
    sc.render.resolution_x, sc.render.resolution_y = W, H
    sc.render.filepath = path
    bpy.ops.render.render(write_still=True)
    bx0, by0, bx1, by1 = sl.bbox_xy(coll.all_objects)
    assert bx0 >= x0 and by0 >= y0 and bx1 <= x1 and by1 <= y1, (path, bx0, by0, bx1, by1)
    return {'w': W, 'h': H}


NPCS = [
    ('old_crease', 'Old Crease', 'Weaponsmith', old_crease),
    ('armourer', 'The Armourer', 'Armourer', armourer),
    ('mirra', 'Mirra Inkwell', 'Enchantress', mirra),
    ('brother_tape', 'Brother Tape', 'Priest of the Glue', brother_tape),
    ('magpie', 'Magpie', 'Lanista and trainer', magpie),
]

manifest = {}
for key, name, role, build in NPCS:
    info = {}
    for talk in (False, True):
        coll = sl.new_coll(key)
        build(coll, talk)
        file = key + ('_talk' if talk else '') + '.png'
        r = render_box(coll, os.path.join(OUT, file))
        info['talk' if talk else 'still'] = file
        info['w'], info['h'] = r['w'], r['h']
        sl.clear_coll(coll)
        bpy.data.collections.remove(coll)
        print('NPC', file, r['w'], r['h'], flush=True)
    manifest[key] = dict(name=name, role=role, **info)

with open(os.path.join(OUT, 'npcs.json'), 'w', newline='\n') as fh:
    json.dump({'npcs': manifest}, fh, indent=1)
print('NPCS', ', '.join(manifest))
