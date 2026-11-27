"""Kraftmoor arena (#272): a cold northern press-yard of cardboard after rain.

Big shapes first, because the game blurs and dims everything above the floor: an overcast sky, northern mountains
with pines, a temple, an aqueduct and watchtowers, one giant wooden screw press (the Romans had them), a cardboard
wall with firelit arches, a crowd in hoods under parasols, and a floor of wet kraft sheets with puddles (the floor
stays sharp in the game). Antiquity only: nothing industrial.

  python -I tools/blender.py blender/arena_kraftmoor.py -- <name.png> [W H samples]

Writes <name>_empty.png, <name>_people.png and <name>_people.json.
"""
import math, os, sys, random
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import arena_lib as al  # noqa: E402
sl, pc, L, R = al.sl, al.pc, al.L, al.R
X0, X1, Y0, Y1 = al.X0, al.X1, al.Y0, al.Y1

OUT, W, H, S = al.args('arena_kraftmoor.png')
sc = al.setup(W, H, S, world='#cbd9ea', world_strength=0.7, sun_strength=2.3)
rnd = random.Random(272)


def paper(name, colour, fiber='washi', scale=0.12, k=0.9):
    return sl.tex_paper('km_' + name, colour, fiber, k, scale=scale)


def board(name, kind, colour, scale=0.1, rot=0.0, nrm=0.6, rough=0.9):
    return sl.tex_board('km_' + name, kind, tint=colour, scale=scale, rot=rot, nrm=nrm, rough=rough)


warm = sl.foil('km_lamp', '#f09a3e', metal=0.0, rough=0.7, emit=1.05)
flame = sl.foil('km_flame', '#e0631f', metal=0.0, rough=0.7, emit=0.9)
iron = sl.foil('km_iron', '#7d8791', metal=0.55, rough=0.42, emit=0.1)

# ---------------------------------------------------------------- overcast sky
L(R(X0, 8, X1, Y1), paper('sky', '#c3d3e2', 'water', 0.08, 0.7), 0.0, 0.1, name='sky')
L(R(X0, 8, X1, 15.8), paper('sky_lo', '#e3e6e4', 'water', 0.08, 0.7), 0.1, 0.05, name='sky_band')
clouds = [paper('cloud_a', '#9fb2c6', 'water', 0.15), paper('cloud_b', '#eef1f2', 'white', 0.15)]
for i in range(11):
    cx = X0 + 2 + i * 5.2 + rnd.uniform(-1.2, 1.2)
    cy = rnd.uniform(17.4, 19.6)
    for j in range(4):
        L(pc.xf(pc.blob_pts(rnd.uniform(1.7, 2.8), rnd.uniform(0.55, 0.95), 0.1, rnd.randint(0, 99)),
                cx + (j - 1.5) * 1.5, cy + (0.35 if j in (1, 2) else 0)),
          clouds[i % 2], 0.2 + j * 0.04 + (i % 2) * 0.12, 0.07, name='cloud')

# ---------------------------------------------------------------- skyline: mountains, pines, temple, aqueduct, towers
mount = paper('mount', '#8397ad')
snow = paper('snow', '#e9eef2', 'white', 0.2)
hill = paper('hill', '#566a80')
pine = paper('pine', '#2f4a48')
marble = paper('marble', '#d9d2c2', scale=0.2)
marble_d = paper('marble_d', '#a89f8e', scale=0.2)
roof = paper('roof', '#8f4a35', scale=0.2)
timber = board('timber', 'brown', '#5c4130', 0.2)
bronze = sl.foil('km_bronze', '#c08a45', metal=0.6, rough=0.35, emit=0.15)

for mx, top, half in ((-22.0, 18.0, 9.0), (-12.5, 16.6, 7.0), (8.0, 16.4, 7.5), (21.0, 18.2, 9.5)):
    L([(mx - half, 12.5), (mx + half, 12.5), (mx + half * 0.12, top - 0.1), (mx, top), (mx - half * 0.1, top - 0.15)],
      mount, 0.5, 0.08, name='mountain')
    L([(mx, top), (mx + half * 0.12, top - 0.1), (mx + half * 0.27, top - 1.1), (mx + half * 0.13, top - 0.85),
       (mx + 0.02, top - 1.35), (mx - half * 0.12, top - 0.9), (mx - half * 0.26, top - 1.2), (mx - half * 0.1, top - 0.15)],
      snow, 0.58, 0.04, name='snow')
L([(X0, 11.0)] + pc.wave_pts(X1 - X0, 0.45, 0.07, 1.3, 14.0, 90) + [(X1, 11.0)], hill, 0.7, 0.1, name='hill')


def tree(x, base, h, z):
    for j in range(3):
        y, w = base + j * h * 0.24, h * (0.3 - j * 0.065)
        L([(x - w, y), (x + w, y), (x, y + h * 0.52)], pine, z + j * 0.03, 0.06, name='pine')


for left, right in ((-26.5, -21.5), (-12.0, -7.0), (7.5, 10.0), (23.0, 26.5)):
    x = left
    while x < right:
        tree(x, 13.2 + rnd.uniform(-0.2, 0.3), rnd.uniform(2.2, 3.4), 0.85 + rnd.uniform(0, 0.1))
        x += rnd.uniform(0.8, 1.3)

# a temple on the left: base, columns, a pediment with a bronze shield
TX = -16.5
L(R(TX - 4.4, 11.0, TX + 4.4, 14.7), marble_d, 1.0, 0.12, name='temple_base')
L(R(TX - 3.7, 14.7, TX + 3.7, 17.1), hill, 1.05, 0.06, name='temple_shade')
for i in range(6):
    cx = TX - 3.35 + i * 1.34
    L(R(cx - 0.27, 14.7, cx + 0.27, 17.0), marble, 1.15, 0.14, name='column')
    L(R(cx - 0.42, 16.85, cx + 0.42, 17.12), marble, 1.28, 0.08, name='capital')
L(R(TX - 4.1, 17.1, TX + 4.1, 17.6), marble, 1.3, 0.14, name='architrave')
L([(TX - 4.4, 17.6), (TX + 4.4, 17.6), (TX, 19.0)], roof, 1.34, 0.14, name='pediment_roof')
L([(TX - 3.5, 17.75), (TX + 3.5, 17.75), (TX, 18.7)], marble, 1.46, 0.06, name='pediment')
L(al.ellipse(TX, 18.08, 0.3, 0.3, 24), bronze, 1.54, 0.05, name='pediment_shield')

# an aqueduct on the right
holes = []
for i in range(6):
    ax = 11.0 + i * 2.1
    holes.append(list(reversed([(ax - 0.75, 12.0), (ax + 0.75, 12.0)] +
                               [(ax + 0.75 * math.cos(math.radians(a)), 15.3 + 0.75 * math.sin(math.radians(a)))
                                for a in range(0, 181, 12)])))
L(R(9.8, 11.0, 22.7, 16.45), marble_d, 1.0, 0.14, holes=holes, name='aqueduct')
L(R(9.6, 16.45, 22.9, 16.85), marble, 1.18, 0.1, name='aqueduct_cap')
for i in range(12):
    ax = 10.4 + i * 1.06
    L(R(ax - 0.2, 16.85, ax + 0.2, 17.4, 0.18), marble_d, 1.12, 0.08, name='aqueduct_stone')

# two timber watchtowers with pennants
for tx, top in ((-8.0, 17.0), (24.6, 17.4)):
    L([(tx - 1.15, 11.0), (tx + 1.15, 11.0), (tx + 0.85, top), (tx - 0.85, top)], timber, 1.1, 0.14, name='tower')
    L(R(tx - 1.25, top, tx + 1.25, top + 0.75), timber, 1.28, 0.1, name='tower_deck')
    for dx in (-0.8, 0.0, 0.8):
        L(R(tx + dx - 0.22, top + 0.75, tx + dx + 0.22, top + 1.1), timber, 1.28, 0.08, name='crenel')
    L(R(tx - 0.05, top + 1.0, tx + 0.05, top + 2.1), timber, 1.2, 0.04, name='pole')
    L([(tx + 0.05, top + 2.1), (tx + 1.5, top + 1.78), (tx + 0.05, top + 1.46)], roof, 1.22, 0.04, name='pennant')

# ---------------------------------------------------------------- the great screw press, the landmark of the yard
press = board('press', 'brown', '#4f3627', 0.2)
press_hi = board('press_hi', 'brown', '#b3825a', 0.2)
PX = -0.5
for side in (-1, 1):
    L(R(PX + side * 4.3 - 0.65, 11.0, PX + side * 4.3 + 0.65, 18.1), press, 1.0, 0.2, name='press_post')
    L(R(PX + side * 4.3 - 0.9, 17.9, PX + side * 4.3 + 0.9, 18.45, 0.15), press_hi, 1.2, 0.1, name='press_cap')
L(R(PX - 4.9, 16.9, PX + 4.9, 17.8, 0.2), press, 1.25, 0.2, name='press_beam')
L(R(PX - 0.5, 14.6, PX + 0.5, 18.6), timber, 1.1, 0.14, name='press_screw')
for k in range(3):
    y = 15.2 + k * 0.5
    L([(PX - 0.72, y), (PX + 0.72, y + 0.24), (PX + 0.72, y + 0.42), (PX - 0.72, y + 0.18)], press_hi, 1.32, 0.05, name='thread')
L(al.ellipse(PX, 18.42, 2.3, 0.3), press_hi, 1.42, 0.1, name='wheel')
for side in (-1, 0, 1):
    L(al.ellipse(PX + side * 2.25, 18.42, 0.34, 0.44), press, 1.52, 0.08, name='knob')
L(R(PX - 3.4, 14.25, PX + 3.4, 15.15, 0.12), press_hi, 1.38, 0.2, name='press_plate')

# ---------------------------------------------------------------- corrugated wall with lit windows
wall = board('wall', 'flute', '#b08a66', 0.22, nrm=0.9)
wall_d = board('wall_d', 'brown', '#6f533c', 0.18)
leather = board('leather', 'brown', '#4a2f20', 0.3)
L(R(X0, 9.6, X1, 13.45), wall, 1.45, 0.18, name='wall')
L(R(X0, 13.3, X1, 13.75), wall_d, 1.65, 0.1, name='wall_cap')
def arch(x, y0, spring, r):
    return [(x - r, y0), (x + r, y0)] + [(x + r * math.cos(math.radians(a)), spring + r * math.sin(math.radians(a)))
                                         for a in range(0, 181, 12)]


for i in range(15):
    wx = X0 + 2.0 + i * 3.6
    L(arch(wx, 11.5, 12.5, 0.78), wall_d, 1.62, 0.07, name='arch_frame')
    L(arch(wx, 11.55, 12.45, 0.56), warm if rnd.random() < 0.7 else press, 1.72, 0.04, name='arch_glow')
    L(R(wx + 1.68, 9.6, wx + 1.96, 13.45), wall_d, 1.68, 0.08, name='wall_post')

# ---------------------------------------------------------------- crowd in hoods and wool, a few paper parasols
body_m = al.objcolor_paper('km_crowd_body')
head_m = al.objcolor_paper('km_crowd_head', 'water')
CLOAK = ['#2f4a63', '#3d6a6d', '#586a43', '#8c4b32', '#b58a3a', '#58606c', '#6d4a63', '#35405a', '#7b6a55', '#a2432f', '#c9c2b2']
SCARF = ['#c4553a', '#d6a441', '#d9d3c3', '#4f8d91']
UMBRELLA = ['#a63d2e', '#2f5d78', '#d29a35', '#3f6b58', '#e4dccb']
step = board('step', 'flute', '#7c634d', 0.3, nrm=0.9)
step_d = board('step_d', 'brown', '#675041', 0.2)
lip = board('lip', 'kraft', '#b2916c', 0.2)
PEOPLE = []
for t in range(1, al.TIERS):
    ytop = al.tier_top(t)
    n = 40 + rnd.randint(-2, 2)
    for k in range(2 * n):
        row = k % 2
        x = X0 + (k // 2 + rnd.uniform(0.1, 0.9) + 0.5 * row) * (X1 - X0) / n
        y = ytop - 1.15 + 0.42 * (1 - row) + rnd.uniform(-0.1, 0.1)
        z = al.tier_z(t) + row * 0.22 + (k // 2) * 0.0035
        s = rnd.uniform(1.0, 1.22)
        cloth = rnd.choice(CLOAK)
        before = set(sc.collection.objects)
        body = al.tint(L([(x - 0.62 * s, y - 0.65 * s), (x + 0.62 * s, y - 0.65 * s), (x + 0.4 * s, y + 0.42 * s),
                          (x + 0.18 * s, y + 0.68 * s), (x - 0.18 * s, y + 0.68 * s), (x - 0.4 * s, y + 0.42 * s)],
                         body_m, z, 0.08, name='body'), cloth)
        hooded = rnd.random() < 0.55
        hy = y + 0.86 * s
        if hooded:           # the hood sits behind the face and ends in a point
            al.tint(L([(x - 0.46 * s, hy - 0.3 * s), (x - 0.45 * s, hy + 0.16 * s), (x - 0.2 * s, hy + 0.44 * s),
                       (x + 0.06, hy + 0.66 * s), (x + 0.28 * s, hy + 0.38 * s), (x + 0.45 * s, hy + 0.1 * s),
                       (x + 0.46 * s, hy - 0.3 * s)], body_m, z + 0.04, 0.06, name='hood'), cloth)
        head = al.tint(L(al.ellipse(x, hy, 0.28 * s, 0.31 * s, 24), head_m, z + 0.09, 0.08, name='head'), rnd.choice(al.SKIN))
        if rnd.random() < 0.45:
            al.tint(L(R(x - 0.34 * s, y + 0.46 * s, x + 0.34 * s, y + 0.66 * s, 0.08), body_m, z + 0.19, 0.05, name='scarf'),
                    rnd.choice(SCARF))
        if not hooded:
            al.tint(L(al.ellipse(x, y + 1.06 * s, 0.32 * s, 0.17 * s, 20), head_m, z + 0.17, 0.05, name='cap'),
                    rnd.choice(al.HAIR + CLOAK[:4]))
        if row == 0 and rnd.random() < 0.075:   # an umbrella over this fan
            ux, uy, ur = x + rnd.uniform(-0.25, 0.25), y + 1.55 * s, rnd.uniform(1.0, 1.3)
            al.tint(L(R(ux - 0.04, y + 0.3, ux + 0.04, uy + 0.1), body_m, z + 0.2, 0.04, name='shaft'), '#3a2c22')
            dome = [(ux + ur * math.cos(math.radians(a)), uy + 0.68 * ur * math.sin(math.radians(a))) for a in range(0, 181, 12)]
            dome += [(ux - ur + (j + 0.5) * ur / 3, uy + (0.16 if j % 1 == 0 else 0)) for j in range(6)]
            al.tint(L(dome, body_m, z + 0.26, 0.07, name='umbrella'), rnd.choice(UMBRELLA))
        PEOPLE.append({'objs': [o for o in sc.collection.objects if o not in before], 'head': head,
                       'colour': tuple(body.color), 'tier': t})
    z = al.tier_z(t)
    L(R(X0, ytop - 3.0, X1, ytop - 1.55), step if t % 2 == 0 else step_d, z + 0.6, 0.12, name='step')
    L(R(X0, ytop - 1.7, X1, ytop - 1.5), lip, z + 0.75, 0.05, name='step_edge')

# ---------------------------------------------------------------- barrier: cardboard planks, banners, braziers
bz = al.BARRIER_Z
L(R(X0, 1.2, X1, 4.4), board('barrier', 'kraft', '#a98a69', 0.12), bz, 0.18, name='barrier')
L(R(X0, 4.1, X1, 4.75), board('barrier_cap', 'flute', '#8a6c50', 0.5, nrm=1.0), bz + 0.2, 0.1, name='barrier_cap')
L(R(X0, 0.98, X1, 1.42), wall_d, bz + 0.2, 0.1, name='barrier_foot')
for i in range(16):
    sx = X0 + 0.9 + i * 3.4
    L(R(sx - 0.05, 1.4, sx + 0.05, 4.1), wall_d, bz + 0.2, 0.03, name='seam')
    for yy in (1.75, 3.75):
        for dx in (-0.35, 0.35):
            L(al.ellipse(sx + dx, yy, 0.12, 0.12, 16), iron, bz + 0.24, 0.05, name='bolt')
banner = [paper('ban_teal', '#24535c', scale=0.2), paper('ban_rust', '#8d3524', scale=0.2)]
cream = paper('ban_cream', '#e6dcc4', scale=0.3)
for i in range(8):
    bx = X0 + 3.4 + i * 6.8
    L(R(bx - 1.15, 4.16, bx + 1.15, 4.46, 0.08), leather, bz + 0.34, 0.06, name='strap')
    L([(bx - 0.95, 4.25), (bx + 0.95, 4.25), (bx + 0.95, 1.75), (bx + 0.32, 2.15), (bx, 1.75), (bx - 0.32, 2.15), (bx - 0.95, 1.75)],
      banner[i % 2], bz + 0.4, 0.06, name='banner')
    for side in (-1, 1):                  # a laurel wreath
        for j in range(6):
            a = math.radians(-70 + j * 27)
            leaf_x, leaf_y = bx + side * 0.5 * math.cos(a), 3.2 + 0.5 * math.sin(a)
            L(pc.xf(pc.ellipse_pts(0.2, 0.08, 16), leaf_x, leaf_y, side * (a + 1.15)), cream,
              bz + 0.48 + j * 0.008, 0.04, name='leaf')
    L(al.ellipse(bx, 3.2, 0.17, 0.17, 20), bronze, bz + 0.55, 0.04, name='boss')
for i in range(7):
    lx = X0 + 6.8 + i * 6.8
    L(R(lx - 0.14, 1.35, lx + 0.14, 4.9), timber, bz + 0.42, 0.08, name='torch_post')
    L(pc.xf(pc.blob_pts(0.42, 0.62, 0.14, i + 3), lx, 5.95), flame, bz + 0.5, 0.06, name='flame')
    L([(lx - 0.3, 5.9), (lx + 0.3, 5.9), (lx + 0.06, 6.9)], flame, bz + 0.52, 0.05, name='flame_tip')
    L(pc.xf(pc.blob_pts(0.2, 0.34, 0.14, i + 9), lx + 0.03, 5.75), warm, bz + 0.56, 0.05, name='flame_core')
    L([(lx - 0.3, 4.8), (lx + 0.3, 4.8), (lx + 0.62, 5.35), (lx - 0.62, 5.35)], bronze, bz + 0.62, 0.12, name='brazier')
    L(R(lx - 0.68, 5.3, lx + 0.68, 5.46, 0.07), bronze, bz + 0.7, 0.08, name='brazier_rim')

# ---------------------------------------------------------------- floor: wet kraft sheets, loose planks, puddles
fz = al.FLOOR_Z
L(R(X0, Y0, X1, al.FLOOR_TOP), board('floor', 'kraft', '#bfab96', 0.07, nrm=0.55, rough=0.72), fz, 0.12, name='floor')
L(R(X0, 0.5, X1, al.FLOOR_TOP), board('floor_sh', 'kraft', '#93806d', 0.07), fz + 0.14, 0.04, name='floor_shadow')
seam = board('floor_seam', 'brown', '#8a7560', 0.2)
lighter = board('floor_light', 'craft', '#cdbba6', 0.08, rough=0.75)
ys = [-1.4, -3.9, -7.4]
for i, y in enumerate(ys):
    L(R(X0, y - 0.07 - 0.02 * i, X1, y + 0.05), seam, fz + 0.16, 0.02, name='floor_joint')
    L(R(X0, y - 0.17 - 0.02 * i, X1, y - 0.07 - 0.02 * i), lighter, fz + 0.17, 0.02, name='floor_lip')
for row, (hi, lo) in enumerate(((0.5, ys[0]), (ys[0], ys[1]), (ys[1], ys[2]), (ys[2], Y0))):
    x = X0 + 4 + row * 3.1
    while x < X1:                       # joints between the sheets lean towards the middle, like a floor in perspective
        lean = x * 0.045
        L([(x - 0.05, hi), (x + 0.05, hi), (x + 0.06 + lean, lo), (x - 0.06 + lean, lo)], seam, fz + 0.155, 0.02, name='sheet_joint')
        x += rnd.uniform(9.0, 13.0)
patch = board('plank', 'brown', '#8f6b4a', 0.25)
for x, y, a, w in ((-18.5, -2.4, 0.18, 3.4), (7.4, -8.4, -0.12, 4.2), (20.8, -1.0, -0.3, 2.6), (-7.6, -6.6, 0.07, 2.2)):
    L(pc.xf(pc.rrect(w, 0.62, 0.05), x, y, a), patch, fz + 0.2, 0.02, name='plank')
wet = board('wet', 'kraft', '#8a776a', 0.1, rough=0.35)
water = sl.foil('km_water', '#7f98ad', metal=0.35, rough=0.07, emit=0.22, scale=0.06)
glint = sl.foil('km_glint', '#bcd0de', metal=0.2, rough=0.1, emit=0.22)
glow = sl.foil('km_glow', '#d8a867', metal=0.3, rough=0.12, emit=0.35)
for i, (x, y, rx, ry) in enumerate(((-16.0, -6.3, 4.1, 0.78), (-21.8, -0.55, 2.3, 0.34), (-1.6, -0.5, 3.3, 0.4),
                                    (14.6, -6.9, 4.8, 0.9), (22.6, -4.1, 2.4, 0.46), (3.8, -9.1, 3.2, 0.55),
                                    (9.3, -2.6, 1.5, 0.25))):
    seed = 11 + i * 5
    L(pc.xf(pc.blob_pts(rx * 1.16, ry * 1.34, 0.12, seed), x, y), wet, fz + 0.21, 0.02, name='wet_halo')
    L(pc.xf(pc.blob_pts(rx, ry, 0.12, seed), x, y), water, fz + 0.23, 0.02, name='puddle')
    L(pc.xf(pc.blob_pts(rx * 0.52, ry * 0.2, 0.2, seed + 1), x - rx * 0.14, y + ry * 0.36), glint, fz + 0.25, 0.015, name='glint')
    if i % 2:                             # a lantern mirrored in the water
        L(pc.xf(pc.blob_pts(rx * 0.17, ry * 0.2, 0.2, seed + 2), x + rx * 0.42, y - ry * 0.12), glow, fz + 0.25, 0.015, name='lamp_glint')
    if rx > 3:                            # a raindrop ring
        cx, cy = x + rnd.uniform(0.0, 1.0), y - ry * 0.38
        hole = list(reversed(al.ellipse(cx, cy, 0.5, 0.12, 36)))
        L(al.ellipse(cx, cy, 0.6, 0.17, 36), glint, fz + 0.26, 0.012, holes=[hole], name='ring')
scrap = paper('scrap', '#cdb598', scale=0.3)
for i in range(30):
    x, y = rnd.uniform(X0, X1), rnd.uniform(-9.5, 0.2)
    L(pc.xf(pc.blob_pts(rnd.uniform(0.09, 0.24), rnd.uniform(0.04, 0.1), 0.35, i, 9), x, y, rnd.uniform(-0.6, 0.6)),
      scrap, fz + 0.28, 0.04, name='scrap')

al.finish(sc, PEOPLE, OUT, W, H)
