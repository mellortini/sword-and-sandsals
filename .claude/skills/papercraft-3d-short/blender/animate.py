"""Frame-by-frame animation of the papercraft scenes, driven by values MEASURED on the reference (see references/MOTION.md).

Run:  D:\\blender\\blender.exe -b --python animate.py -- __lib__ <out_dir> <W> <H> <samples> <clip>
clip: belt  (5.0-7.6 s: slit opens in 3 steps, hold drift + push-in)   dive (7.6-8.07 s: fast zoom into the slit, defocus)   cave (8.1-10.4 s: hands slide in, hands bob 1.25 Hz, flame flicker)
Writes <out_dir>/f_0000.png ... (30 fps). Then post.py per frame (seed = frame number) and ffmpeg.
"""
import sys, os, math
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import bpy
import scenes as S           # runs in library mode because argv[0] == '__lib__'
import pc_lib as pc

args = sys.argv[sys.argv.index('--') + 1:]
OUTDIR = args[1]; CLIP = args[5] if len(args) > 5 else 'belt'
FPS = 30
sc = bpy.context.scene
H = S.HND

# ------------------------------------------------------------------ measured constants (references/MOTION.md, data/motion2.json)
SLIT_PX = [0.0, 0.0, 0.0, 0.0, 3.1, 7.2, 7.5, 7.7, 6.8, 6.9, 8.3, 20.5, 29.0, 33.0, 34.7, 33.9, 33.9, 35.3, 36.4, 43.4, 57.8, 71.3, 72.2, 70.8, 68.2, 67.2]   # slit width every 0.1 s from t=4.9 s
SLIT_T0 = 4.9
HOLDS = {                                    # steady drift of holds: content velocity px/s at 1080 wide (+y = down the screen), push-in per second
    'belt': dict(vx=16.9, vy=-8.8, zoom=1.0084),
    'flame_hands': dict(vx=-0.9, vy=-1.9, zoom=1.0145),
}
FLAME_FREQS = (1.7, 2.5, 3.3, 4.6, 6.1)      # broadband wobble, dominant 2-3.3 Hz (measured), NOT a clean 6-10 Hz
FLAME_AMPS = (0.6, 1.0, 1.0, 0.6, 0.35)
FLAME_AREA_STD = 0.05                         # relative std of the flame area (cave shot)
HAND_BOB_HZ = 1.25
HAND_BOB_PEAK_PX = 10.0                       # peak along the pointing axis, 1080 px = sqrt(2) x measured std 7.3 px
BUCKLE_W = [189, 199, 201, 207, 213, 219, 229, 236, 240, 242, 244]   # buckle width at 540 px wide, every 0.25 s from t=4.9 s (belt shot): the shot PUSHES IN x1.29 (decelerating); the old log-polar zoom estimate (1.008/s) was wrong
BUCKLE_T0 = 4.9
SLIT_CAL = 1.11                               # calibrated empirically: with the measured push-in, 1.26 overshot (end 82 px vs 72), 1.0 undershot (57)
DIVE_S = 0.47                                 # slit dive length
BLOWOUT_LUM = [85.4, 85.1, 85.2, 85.1, 84.8, 82.6, 82.6, 76.5, 66.9, 51.5, 51.4, 34.7, 28.2, 31.6, 31.9, 33.9, 32.6, 39.8, 40.1, 42.6, 56.4, 72.0, 72.2, 80.8, 88.0, 89.6, 89.7, 88.4, 88.6, 88.7]   # global luminance every 0.05 s from 0.3 s


def ease_out(t, p=3):
    t = min(max(t, 0.0), 1.0); return 1 - (1 - t) ** p


def ease_in(t, p=3):
    t = min(max(t, 0.0), 1.0); return t ** p


def lerp_series(series, t0, dt, t):
    x = (t - t0) / dt
    if x <= 0: return series[0]
    if x >= len(series) - 1: return series[-1]
    i = int(x); f = x - i
    return series[i] * (1 - f) + series[i + 1] * f


def wob(t, seed=0):
    """Broadband unit-std wobble (flame shape, light). Deterministic per seed."""
    import random
    r = random.Random(seed)
    ph = [r.uniform(0, math.tau) for _ in FLAME_FREQS]
    v = sum(a * math.sin(math.tau * f * t + p) for f, a, p in zip(FLAME_FREQS, FLAME_AMPS, ph))
    return v / math.sqrt(sum(a * a for a in FLAME_AMPS) / 2)


def blowout_gain(t):
    """Light multiplier for the birthday candles (1.0 = lit): dark from ~0.85 to 1.15 s, relights in 4 steps by 1.5 s."""
    return lerp_series(BLOWOUT_LUM, 0.3, 0.05, t) / BLOWOUT_LUM[0]


def units_per_px(D):
    return (D * 36.0 / 85.0) / 1080.0


def set_cam_belt(t):
    """Belt shot camera: zoom follows the measured buckle width (end framing = D0), content drifts up ~56 px at 1080 over the shot."""
    c = H['cam']; x0, y0, D0 = H['cam0']
    r = lerp_series(BUCKLE_W, BUCKLE_T0, 0.25, t) / BUCKLE_W[-1]
    u = units_per_px(D0); x = min(max((t - 5.0) / 2.6, 0.0), 1.0)
    c.location = (x0, y0 + 56 * u * (1 - x), D0 / r)
    return r


def set_cam_hold(hold, t_rel):
    c = H['cam']; x0, y0, D0 = H['cam0']; h = HOLDS[hold]
    D = D0 / (h['zoom'] ** t_rel); u = units_per_px(D0)
    c.location = (x0 - h['vx'] * t_rel * u, y0 + h['vy'] * t_rel * u, D)


# ------------------------------------------------------------------ clips
def clip_belt(t0=5.0, t1=7.6):
    S.belt()
    shirt = H['shirt']; spl = shirt.data.splines[1]
    ember_e = H['ember'].data.energy
    n = int(round((t1 - t0) * FPS))
    for i in range(n):
        t = t0 + i / FPS
        w = lerp_series(SLIT_PX, SLIT_T0, 0.1, t)
        r = set_cam_belt(t)
        pts = H['slit_fn'](max(0.02, 0.5 * w * SLIT_CAL / 72.0 / r))      # px measured under zoom r -> world width
        for k, (x, y) in enumerate(pts):
            spl.points[k].co = (x, y, 0, 1)
        H['ember'].data.energy = ember_e * (1.0 + 0.08 * wob(t, 3))
        yield i, t


def smooth(x):
    x = min(max(x, 0.0), 1.0); return x * x * (3 - 2 * x)


def far_layer(pts, mat, z, holes=(), cy=3.0, h=0.2):
    """A cut-paper layer placed FAR behind the shirt but sized so it APPEARS `pts`-big (perspective compensation, 85 mm lens). cy = apparent centre height."""
    D0 = H['cam0'][2]; s = (D0 - z * pc.ZK) / D0
    return pc.layer(pc.xf(pts, 0, 0, 0, s), mat, h, z, holes=[pc.xf(q, 0, 0, 0, s) for q in holes], loc=(0, cy * s), bevel=0.01)


DIVE_T0, DIVE_T1 = 7.5, 7.9           # part A of the slit dive (belt scene); part B is the cave clip from 7.9 s (it opens zoomed out and defocused)
CAVE_T0 = 7.9


def clip_dive(t0=DIVE_T0, t1=DIVE_T1):
    """Slit -> cave dive, part A (measured on the reference, see references/DIVE.md):
    7.50-7.70 slit rips open into a wide leaf, camera tilts up (belt slides down ~13 % of the frame height), a small flame is seen far inside;
    7.65-7.80 focus is pulled from the shirt to the interior (shirt/belt blur), 7.77-7.90 camera rushes through the leaf (ease-in, zoom squeezed at the end).
    The interior is a stack of ring layers placed FAR behind the shirt (real depth, so DOF works) + a small flame + back wall."""
    S.belt()
    for k in ('backdrop', 'ember_glow'):
        H[k].hide_render = True
    G, P = S.G, S.P
    sc.camera.data.clip_end = 400
    ring_cols = ['#5a1424', '#7e1c30', '#a02a40']
    rings = [((3.4, 4.8), (2.5, 3.6), -5), ((2.5, 3.6), (1.7, 2.6), -10), ((1.7, 2.6), (1.0, 1.6), -16)]
    for (ro, ri, z), col in zip(rings, ring_cols):
        far_layer(pc.blob_pts(ro[0], ro[1], 0.06, 4 + int(-z)), P(col), z, holes=[pc.blob_pts(ri[0], ri[1], 0.06, 5 + int(-z))], cy=3.2)
        far_layer(pc.blob_pts(ro[0], ro[1], 0.06, 4 + int(-z)), P('#d98aa6'), z + 0.3, holes=[pc.blob_pts(ro[0] - 0.08, ro[1] - 0.08, 0.06, 4 + int(-z))], cy=3.2, h=0.05)   # pale rim line
    far_layer(pc.rrect(30, 40, 0.3), P('#6a1a2e'), -24, cy=3.2)
    far_layer(pc.teardrop_pts(1.0, 1.35), G('#ffc400', 1.25), -23, cy=2.5, h=0.1)
    far_layer(pc.xf(pc.teardrop_pts(0.6, 0.8), 0, 0.1), G('#ffee70', 1.4), -22.8, cy=2.5, h=0.1)
    pc.point('inner', (0, 3.0, -2.2), 220, '#ff9a3a', 0.6)
    shirt = H['shirt']; spl = shirt.data.splines[1]
    c = H['cam']; x0, y0, D0 = H['cam0']
    cd = c.data; cd.dof.use_dof = True
    n = int(round((t1 - t0) * FPS))
    for i in range(n):
        t = t0 + i / FPS; p = (t - t0) / (t1 - t0)
        # leaf: half-width 0.63 -> 1.7 (by 7.70) -> 3.2; half-height 2.5 -> 2.0 -> 2.6
        a = smooth((t - 7.5) / 0.2); b = smooth((t - 7.7) / 0.2)
        w = 0.63 + (1.7 - 0.63) * a + (4.5 - 1.7) * b; hh = 2.5 - 0.5 * a + 1.5 * b
        for k, (x, y) in enumerate(H['slit_fn'](w, hh)):
            spl.points[k].co = (x, y, 0, 1)
        # camera: tilt up + slight push until 7.77, then rush through the leaf
        pre = smooth((t - 7.5) / 0.27)
        D = D0 / (1 + 0.25 * pre); y = y0 + 2.5 * pre
        q = (t - 7.77) / 0.13
        if q > 0:
            e = ease_in(q, 2); D = D + (2.2 - D) * e; y = y + (2.8 - y) * e
        c.location = (x0, y, D)
        # focus: shirt -> interior (flame) between 7.65 and 7.80; aperture opens as the foreground should blur
        f = smooth((t - 7.65) / 0.15)
        cd.dof.focus_distance = D * (1 - f) + (D + 17.0) * f
        cd.dof.aperture_fstop = 40.0 if t < 7.6 else max(0.12, 40.0 * (1 - smooth((t - 7.6) / 0.12)))
        yield i, t


def clip_cave(t0=CAVE_T0, t1=10.4):
    """Cave: part B of the dive (opens zoomed OUT + defocused, rings far, flame small, pushes in with ease-out over ~0.55 s), then the hold with hands + flame flicker."""
    S.cave(True, far=1.5)
    pc.layer(pc.rrect(140, 240, 0.3), S.P('#b83460'), 0.3, -3.8, name='wall')          # magenta wall around the hole, visible when zoomed out
    H['door'].hide_render = True; H['door_light'].hide_render = True
    hands = H['hands']
    base = [[o.location.copy() for o in objs] for objs, _ in hands]
    fo, fi, fl = H['flame_o'], H['flame_i'], H['flame_light']
    e0 = fl.data.energy
    c = H['cam']; cd = c.data; cd.dof.use_dof = True; sc.camera.data.clip_end = 400
    n = int(round((t1 - t0) * FPS))
    u = units_per_px(H['cam0'][2])
    for i in range(n):
        t = t0 + i / FPS
        a = wob(t, 11); b = wob(t, 12)
        fo.scale = (1 + 0.015 * a, 1 + 0.05 * b, 1); fi.scale = (1 - 0.012 * a, 1 + 0.04 * b, 1)
        fl.data.energy = e0 * (1 + 0.03 * wob(t, 13))
        # hands enter from 8.4 s (measured: first hand visible at 8.43 s), staggered 0.05 s, ease-out, then bob 1.25 Hz
        for j, (objs, (dxv, dyv)) in enumerate(hands):
            ts = 8.4 + 0.05 * j
            slide = 7.0 * 1.5 * (1 - ease_out((t - ts) / 0.45))
            off = -slide + HAND_BOB_PEAK_PX * u * math.sin(math.tau * HAND_BOB_HZ * (t - ts) + j * 1.3) * (1 if t > ts + 0.45 else 0)
            for o, b0 in zip(objs, base[j]):
                o.location = (b0.x + dxv * off, b0.y + dyv * off, b0.z)
                o.hide_render = t < ts - 0.02            # hands do not exist on screen before they slide in
        set_cam_hold('flame_hands', max(0.0, t - 8.7))
        k = (t - t0) / 0.55
        z = 0.32 + 0.68 * ease_out(k, 3)
        c.location = (c.location.x, c.location.y, c.location.z / z)
        cd.dof.focus_distance = max(1.0, c.location.z - 1.2)
        cd.dof.aperture_fstop = 0.3 + 22.0 * ease_out(k, 2)
        yield i, t


CLIPS = {'belt': clip_belt, 'dive': clip_dive, 'cave': clip_cave}
os.makedirs(OUTDIR, exist_ok=True)
if CLIP == 'dive':
    pc.setup_cycles(sc, S.W, S.H, S.S, exposure=0.05, view='Standard')
for i, t in CLIPS[CLIP]():
    sc.render.filepath = os.path.join(OUTDIR, 'f_%04d.png' % i)
    bpy.ops.render.render(write_still=True)
print('ANIMATED', CLIP, OUTDIR)
