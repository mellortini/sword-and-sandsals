#!/usr/bin/env python3
"""Second, cleaner motion pass: steady drift of holds (transitions trimmed), dive curves, flame flicker (high-pass), slit opening steps, light timeline.

Usage:  python -I measure_motion2.py <video.mp4> <out.json>
Units: pixels of a 1080x1920 frame, seconds, hertz.
"""
import json, sys
import cv2, numpy as np

V, OUT = sys.argv[1], sys.argv[2]
cap = cv2.VideoCapture(V); fps = cap.get(cv2.CAP_PROP_FPS) or 30.0
fr = []
while True:
    ok, f = cap.read()
    if not ok: break
    fr.append(cv2.resize(f, (540, 960), interpolation=cv2.INTER_AREA))
N = len(fr); G = [cv2.cvtColor(f, cv2.COLOR_BGR2GRAY).astype(np.float32) for f in fr]
win = cv2.createHanningWindow((540, 960), cv2.CV_32F)
dx = np.zeros(N); dy = np.zeros(N); zm = np.ones(N)
def logscale(a, b):
    R = 480; Wd = 480
    pa = cv2.warpPolar(a, (Wd, 720), (270, 480), R, cv2.WARP_POLAR_LOG | cv2.INTER_LINEAR)
    pb = cv2.warpPolar(b, (Wd, 720), (270, 480), R, cv2.WARP_POLAR_LOG | cv2.INTER_LINEAR)
    (sx, sy), r = cv2.phaseCorrelate(pa, pb); return float(np.exp(sx / (Wd / np.log(R))))
for i in range(1, N):
    (a, b), _ = cv2.phaseCorrelate(G[i - 1], G[i], win); dx[i], dy[i] = a * 2, b * 2
    zm[i] = logscale(G[i - 1], G[i])
out = {'units': 'px of 1080x1920, s, Hz', 'holds': {}, 'dives': {}, 'local': {}}

# ---- holds: clean intervals (transitions trimmed), velocity in px/s, positive dy = content moves DOWN the screen (camera tilts up)
HOLDS = {'belt': (5.3, 7.4), 'flame_hands': (8.7, 10.3), 'plank': (17.2, 19.5), 'cell': (24.5, 31.4), 'town': (32.2, 36.8), 'pipes': (41.8, 45.2), 'mito': (46.4, 48.8),
         'cell2': (49.3, 52.0), 'town2': (54.5, 55.9), 'finale': (56.5, 58.9), 'birthday': (0.1, 0.5), 'candle_caliper': (10.6, 11.8)}
for k, (a, b) in HOLDS.items():
    i0, i1 = int(a * fps), int(b * fps)
    vx = dx[i0:i1] * fps; vy = dy[i0:i1] * fps; z = zm[i0:i1]
    kk = 5; sm = lambda x: np.convolve(x, np.ones(kk) / kk, mode='same')[kk:-kk]
    sp = np.hypot(sm(vx), sm(vy))
    q = max(1, len(sp) // 4)
    out['holds'][k] = dict(t0=a, t1=b, mean_vx=round(float(np.mean(vx)), 1), mean_vy=round(float(np.mean(vy)), 1), speed=round(float(np.hypot(np.mean(vx), np.mean(vy))), 1),
                           jitter_std=round(float(np.std(sm(vy))), 1), zoom_per_s=round(float(np.prod(z) ** (1 / (b - a))), 4),
                           speed_quarters=[round(float(np.mean(sp[j * q:(j + 1) * q])), 1) for j in range(4)])

# ---- dives: zoom curve normalised 0..1 vs time -> ease profile
for k, (a, b) in {'dive_slit': (7.5, 8.15), 'dive_ring': (19.7, 22.3)}.items():
    i0, i1 = int(a * fps), int(b * fps)
    z = np.cumprod(zm[i0:i1]); lz = np.log(z)
    n = lz / (lz[-1] + 1e-9)
    t = np.arange(len(z)) / fps
    def when(p):
        j = int(np.argmax(n >= p)); return round(float(t[j]), 3)
    out['dives'][k] = dict(t0=a, t1=b, zoom_total=round(float(z[-1]), 2), t10=when(0.1), t50=when(0.5), t90=when(0.9),
                           speed_px_per_s_peak=round(float(np.max(np.hypot(dx[i0:i1], dy[i0:i1])) * fps), 0),
                           zoom_curve_every_3f=[round(float(v), 3) for v in n[::3]])

# ---- flame flicker: high-pass (remove slow drift with 0.4 s moving average) of yellow-area and tip height
def yellow(f):
    h = cv2.cvtColor(f, cv2.COLOR_BGR2HSV)
    return ((h[..., 0] > 18) & (h[..., 0] < 38) & (h[..., 1] > 110) & (h[..., 2] > 190))
for nm, (a, b, crop) in {'flame_cave': (8.7, 10.3, (150, 700, 120, 440)), 'flame_finale': (56.5, 58.8, (150, 700, 120, 440))}.items():
    i0, i1 = int(a * fps), int(b * fps); y0, y1, x0, x1 = crop
    area = np.array([yellow(fr[i])[y0:y1, x0:x1].sum() for i in range(i0, i1)], float)
    tip = []
    for i in range(i0, i1):
        m = yellow(fr[i])[y0:y1, x0:x1]; ys = np.where(m.sum(axis=1) > 3)[0]; tip.append(float(ys[0]) if len(ys) else np.nan)
    tip = np.array(tip); tip = np.where(np.isnan(tip), np.nanmean(tip), tip)
    def hp(x):
        k = int(0.4 * fps) | 1; return x - np.convolve(x, np.ones(k) / k, mode='same')
    ha, ht = hp(area)[6:-6], hp(tip)[6:-6]
    def dom(x):
        s = np.abs(np.fft.rfft(x * np.hanning(len(x)))); f = np.fft.rfftfreq(len(x), 1 / fps); m = (f >= 1.5) & (f <= 14.5)
        j = np.argmax(s[m]); return round(float(f[m][j]), 2), round(float(s[m][j] / (s[m].sum() + 1e-9)), 3)
    out['local'][nm] = dict(area_flicker_rel_std=round(float(ha.std() / (area.mean() + 1e-9)), 4), tip_flicker_px=round(float(ht.std() * 2), 2), area_dom=dom(ha), tip_dom=dom(ht),
                            tip_range_px=round(float((np.percentile(tip, 95) - np.percentile(tip, 5)) * 2), 1))

# ---- slit opening steps (belt shot): dark-slit width at 1080 px, every frame -> steps
def slit_w(f):
    g = cv2.cvtColor(f, cv2.COLOR_BGR2GRAY)[200:340, 150:400]; return float((g < 90).sum(axis=1).mean() * 2)
sw = np.array([slit_w(fr[i]) for i in range(int(4.9 * fps), int(7.5 * fps))])
out['local']['slit_width_px_every_0p1s'] = [round(float(sw[k]), 1) for k in range(0, len(sw), 3)]
# step detector: plateaus where |d width| small after a rise
d = np.diff(np.convolve(sw, np.ones(3) / 3, mode='same'))
out['local']['slit_rise_rate_px_per_s'] = round(float((sw[-1] - sw[0]) / ((len(sw)) / fps)), 1)

# ---- light timeline of the birthday blow-out, in 0.05 s steps
lum = np.array([g.mean() for g in G])
out['local']['blowout_lum_every_0p05s'] = [round(float(lum[int(t * fps)]), 1) for t in np.arange(0.3, 1.8, 0.05)]
# ---- candle flame count on the cake before/after the blow-out is read by hand: see SHOT_LIST beats
json.dump(out, open(OUT, 'w'), indent=1)
for k, v in out['holds'].items(): print('hold', k, v)
for k, v in out['dives'].items(): print('dive', k, {a: b for a, b in v.items() if a != 'zoom_curve_every_3f'})
for k, v in out['local'].items(): print(k, v)
