#!/usr/bin/env python3
"""Measure MOTION in a reference video: camera drift + zoom per shot, flame flicker, slit pulse, hand bob, light dip.

Usage:  python -I measure_motion.py <video.mp4> <out.json>
Needs:  numpy, opencv-python-headless.   Everything is measured on 540x960 frames, reported in 1080x1920 pixels (x2) and seconds.
Shots are the 19 designed shots of the reference (see references/SHOT_LIST.md). Edit SHOTS for another film.
"""
import json, sys
import cv2, numpy as np

V, OUT = sys.argv[1], sys.argv[2]
SHOTS = [(0, 2.13, 'birthday'), (2.13, 3.2, 'breakfast'), (3.2, 4.67, 'legs'), (4.67, 7.6, 'belt'), (7.6, 8.07, 'dive_slit'), (8.07, 10.4, 'flame_hands'),
         (10.4, 12.1, 'candle_caliper'), (12.1, 16.8, 'family'), (16.8, 19.8, 'plank'), (19.8, 22.2, 'dive_ring'), (22.2, 31.7, 'cell'), (31.7, 37.53, 'town'),
         (37.53, 41.2, 'keys_jars'), (41.2, 45.63, 'pipes'), (45.63, 48.97, 'mito'), (48.97, 52.3, 'cell2'), (52.3, 54.4, 'gym'), (54.4, 55.97, 'town2'), (55.97, 59.13, 'finale')]

cap = cv2.VideoCapture(V)
fps = cap.get(cv2.CAP_PROP_FPS) or 30.0
frames = []
while True:
    ok, f = cap.read()
    if not ok:
        break
    frames.append(cv2.resize(f, (540, 960), interpolation=cv2.INTER_AREA))
N = len(frames)
gray = [cv2.cvtColor(f, cv2.COLOR_BGR2GRAY).astype(np.float32) for f in frames]
win = cv2.createHanningWindow((540, 960), cv2.CV_32F)

def shift(a, b):
    (dx, dy), resp = cv2.phaseCorrelate(a, b, win)
    return dx, dy, resp

def logscale(a, b):
    """zoom factor between two frames via log-polar phase correlation (scale > 1 means b is zoomed IN relative to a)."""
    c = (270, 480); R = 480; Wd = 480
    pa = cv2.warpPolar(a, (Wd, 720), c, R, cv2.WARP_POLAR_LOG | cv2.INTER_LINEAR)
    pb = cv2.warpPolar(b, (Wd, 720), c, R, cv2.WARP_POLAR_LOG | cv2.INTER_LINEAR)
    (sx, sy), resp = cv2.phaseCorrelate(pa, pb)
    M = Wd / np.log(R)
    return float(np.exp(sx / M)), resp

# per-frame global translation (px at 540 wide) and zoom
dx = np.zeros(N); dy = np.zeros(N); zm = np.ones(N); resp = np.zeros(N); cut = np.zeros(N, bool)
for i in range(1, N):
    dx[i], dy[i], resp[i] = shift(gray[i - 1], gray[i])
    zm[i], _ = logscale(gray[i - 1], gray[i])
    ha = cv2.calcHist([frames[i - 1]], [0, 1, 2], None, [8, 8, 8], [0, 256] * 3)
    hb = cv2.calcHist([frames[i]], [0, 1, 2], None, [8, 8, 8], [0, 256] * 3)
    cut[i] = cv2.compareHist(cv2.normalize(ha, ha).flatten(), cv2.normalize(hb, hb).flatten(), cv2.HISTCMP_BHATTACHARYYA) > 0.3

def smooth(x, k=5):
    return np.convolve(x, np.ones(k) / k, mode='same')

res = {'fps': fps, 'frames': N, 'units': 'pixels of a 1080x1920 frame, seconds, hertz', 'shots': {}}
for a, b, name in SHOTS:
    i0, i1 = int(a * fps) + 2, min(N - 1, int(b * fps) - 1)
    idx = [i for i in range(i0, i1) if not cut[i]]
    if len(idx) < 4:
        continue
    vx = dx[idx] * 2 * fps; vy = dy[idx] * 2 * fps          # px/s at 1080 wide; image y grows down
    sp = np.hypot(smooth(vx), smooth(vy))
    nb = 6
    prof = [float(np.mean(sp[k * len(sp) // nb:(k + 1) * len(sp) // nb])) for k in range(nb)]
    z = np.cumprod(zm[idx])
    res['shots'][name] = dict(
        t0=a, t1=b, dur=round(b - a, 2),
        net_dx=round(float(np.sum(dx[idx]) * 2), 1), net_dy=round(float(np.sum(dy[idx]) * 2), 1),
        mean_speed=round(float(np.mean(sp)), 1), peak_speed=round(float(np.percentile(sp, 95)), 1),
        speed_profile_6=[round(p, 1) for p in prof],
        zoom_total=round(float(z[-1]), 3), zoom_per_s=round(float(z[-1] ** (1.0 / max(b - a, 0.1))), 3),
        pan_dir='down(content moves up)' if np.sum(dy[idx]) < -5 else ('up(content moves down)' if np.sum(dy[idx]) > 5 else 'none'))

# ---------- local measurements ----------
def series(i0, i1, fn):
    return np.array([fn(frames[i]) for i in range(int(i0 * fps), int(i1 * fps))], dtype=float)

def dominant(x, lo=0.5, hi=14.0):
    x = x - x.mean()
    sp = np.abs(np.fft.rfft(x * np.hanning(len(x))))
    fr = np.fft.rfftfreq(len(x), 1.0 / fps)
    m = (fr >= lo) & (fr <= hi)
    k = np.argmax(sp[m])
    return float(fr[m][k]), float(sp[m][k] / (sp[m].sum() + 1e-9))

loc = {}
# flame (cave shot 8.2-10.3 s and finale 56.5-59 s): yellow-pixel area and tip height of the flame
def yellow_mask(f):
    hsv = cv2.cvtColor(f, cv2.COLOR_BGR2HSV)
    return ((hsv[..., 0] > 18) & (hsv[..., 0] < 38) & (hsv[..., 1] > 120) & (hsv[..., 2] > 200))
for nm, a, b in (('flame_cave', 8.3, 10.3), ('flame_finale', 56.4, 58.8)):
    area = series(a, b, lambda f: yellow_mask(f)[250:700, 120:420].sum())
    def tip(f):
        m = yellow_mask(f)[150:700, 120:420]
        ys = np.where(m.any(axis=1))[0]
        return float(ys[0]) if len(ys) else 0.0
    tp = series(a, b, tip)
    fa, pa = dominant(area); ft, pt = dominant(tp)
    loc[nm] = dict(area_mean=float(area.mean()), area_rel_std=round(float(area.std() / (area.mean() + 1e-9)), 4), area_dom_hz=round(fa, 2), area_dom_power=round(pa, 3),
                   tip_std_px=round(float(tp.std() * 2), 2), tip_dom_hz=round(ft, 2), tip_dom_power=round(pt, 3))
# slit pulse: width of the dark slit in the belt shot (rows 150-300 of 960, centre columns)
def slit_w(f):
    g = cv2.cvtColor(f, cv2.COLOR_BGR2GRAY)[220:330, 180:380]
    return float((g < 80).sum(axis=1).mean() * 2)
sw = series(4.8, 7.5, slit_w)
f_s, p_s = dominant(sw, 0.3, 6.0)
loc['slit_width'] = dict(min_px=round(float(sw.min()), 1), max_px=round(float(sw.max()), 1), mean_px=round(float(sw.mean()), 1), dom_hz=round(f_s, 2), dom_power=round(p_s, 3),
                         first_s=round(4.8, 2), width_every_0p3s=[round(float(sw[k]), 1) for k in range(0, len(sw), 9)])
# hand bob: translation of the right-hand hand crop during 8.7-10.3 s
x0, x1, y0, y1 = 380, 540, 380, 560
pos = []
for i in range(int(8.7 * fps), int(10.3 * fps)):
    pos.append(cv2.phaseCorrelate(gray[i][y0:y1, x0:x1], gray[i + 1][y0:y1, x0:x1])[0])
pos = np.cumsum(np.array(pos), axis=0)
fx, px = dominant(pos[:, 0] - np.linspace(pos[0, 0], pos[-1, 0], len(pos))); fy, py = dominant(pos[:, 1] - np.linspace(pos[0, 1], pos[-1, 1], len(pos)))
loc['hand_bob'] = dict(amp_x_px=round(float(pos[:, 0].std() * 2), 2), amp_y_px=round(float(pos[:, 1].std() * 2), 2), dom_hz_x=round(fx, 2), dom_hz_y=round(fy, 2))
# light: global luminance across the candle blow-out (0-2.1 s) and slow breathing of lit scenes
lum = np.array([g.mean() for g in gray])
loc['blowout_lum_0_to_2.2s'] = [round(float(lum[int(t * fps)]), 1) for t in np.arange(0, 2.21, 0.1)]
res['local'] = loc
res['per_frame'] = dict(dx_px1080=[round(float(v * 2), 2) for v in dx], dy_px1080=[round(float(v * 2), 2) for v in dy], zoom=[round(float(v), 4) for v in zm])
json.dump(res, open(OUT, 'w'))
print('shots:')
for k, v in res['shots'].items():
    print(' %-15s %5.2fs speed %6.1f px/s (peak %6.1f) net(%7.1f,%7.1f) zoom x%.3f profile %s' % (k, v['dur'], v['mean_speed'], v['peak_speed'], v['net_dx'], v['net_dy'], v['zoom_total'], v['speed_profile_6']))
print('local:')
for k, v in loc.items():
    print(' ', k, v)
