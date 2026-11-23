"""Post every frame, encode mp4, and measure our clips with the SAME functions used on the reference."""
import os, sys, json, subprocess, glob
sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', 'blender'))
import cv2, numpy as np
import post

ROOT = r'D:\animacje\ref_style\anim_test'
LOOK = {'belt': 'day', 'dive': 'day', 'cave': 'dark'}
FFMPEG = 'ffmpeg'
res = {}
for clip in ('belt', 'dive', 'cave'):
    d = os.path.join(ROOT, clip)
    fs = sorted(glob.glob(os.path.join(d, 'f_*.png')))
    if not fs: continue
    pd = os.path.join(ROOT, clip + '_post'); os.makedirs(pd, exist_ok=True)
    for i, f in enumerate(fs):
        img = cv2.imread(f)
        out = post.process(img, LOOK[clip], i)
        cv2.imwrite(os.path.join(pd, 'f_%04d.png' % i), out)
    subprocess.run([FFMPEG, '-y', '-loglevel', 'error', '-framerate', '30', '-i', os.path.join(pd, 'f_%04d.png'), '-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-crf', '16', os.path.join(ROOT, clip + '.mp4')], check=True)
    print('encoded', clip, len(fs))

fps = 30.0
def load(clip):
    return [cv2.imread(f) for f in sorted(glob.glob(os.path.join(ROOT, clip + '_post', 'f_*.png')))]

def hp(x):
    k = int(0.4 * fps) | 1; return x - np.convolve(x, np.ones(k) / k, mode='same')
def dom(x):
    s = np.abs(np.fft.rfft(x * np.hanning(len(x)))); f = np.fft.rfftfreq(len(x), 1 / fps); m = (f >= 1.5) & (f <= 14.5)
    j = np.argmax(s[m]); return round(float(f[m][j]), 2), round(float(s[m][j] / (s[m].sum() + 1e-9)), 3)

# belt: slit width (same crop and threshold as measure_motion2.py; frames are 540x960 already), drift
fr = load('belt')
if fr:
    G = [cv2.cvtColor(f, cv2.COLOR_BGR2GRAY) for f in fr]
    sw = np.array([float((g[200:340, 150:400] < 90).sum(axis=1).mean() * 2) for g in G])
    res['belt_slit_width_every_0p1s'] = [round(float(sw[k]), 1) for k in range(0, len(sw), 3)]
    win = cv2.createHanningWindow((540, 960), cv2.CV_32F)
    Gf = [g.astype(np.float32) for g in G]
    d = np.array([cv2.phaseCorrelate(Gf[i - 1], Gf[i], win)[0] for i in range(1, len(Gf))]) * 2 * fps
    res['belt_drift_px_s'] = [round(float(d[:, 0].mean()), 1), round(float(d[:, 1].mean()), 1)]
# cave: flame area flicker with the same yellow mask / crop
fr = load('cave')
if fr:
    def yellow(f):
        h = cv2.cvtColor(f, cv2.COLOR_BGR2HSV)
        return ((h[..., 0] > 18) & (h[..., 0] < 38) & (h[..., 1] > 110) & (h[..., 2] > 190))
    area = np.array([yellow(f)[150:700, 120:440].sum() for f in fr], float)
    tip = []
    for f in fr:
        m = yellow(f)[150:700, 120:440]; ys = np.where(m.sum(axis=1) > 3)[0]; tip.append(float(ys[0]) if len(ys) else np.nan)
    tip = np.array(tip); tip = np.where(np.isnan(tip), np.nanmean(tip), tip)
    s0 = int(0.8 * fps); s1 = len(fr) - 6   # cave clip starts at 7.9 s; the reference was measured from 8.7 s, so skip the opening 0.8 s
    ha, ht = hp(area)[s0:s1], hp(tip)[s0:s1]
    res['cave_flame'] = dict(area_flicker_rel_std=round(float(ha.std() / (area.mean() + 1e-9)), 4), tip_flicker_px=round(float(ht.std() * 2), 2), area_dom=dom(ha), tip_dom=dom(ht), area_mean=float(area.mean()))
    G = [cv2.cvtColor(f, cv2.COLOR_BGR2GRAY).astype(np.float32) for f in fr]
    x0, x1, y0, y1 = 380, 540, 380, 560
    pos = np.cumsum(np.array([cv2.phaseCorrelate(G[i][y0:y1, x0:x1], G[i + 1][y0:y1, x0:x1])[0] for i in range(s0, len(G) - 1)]), axis=0)
    detr = lambda v: v - np.linspace(v[0], v[-1], len(v))
    res['cave_hand_bob'] = dict(amp_x_px=round(float(detr(pos[:, 0]).std() * 2), 2), amp_y_px=round(float(detr(pos[:, 1]).std() * 2), 2), dom=dom(detr(pos[:, 0])))
# ---- full slit dive: part A (belt scene, 7.5-7.9 s) cross-dissolves into the cave clip (starts 7.9 s)
A = load('dive'); B = load('cave')
if A and B:
    sd = os.path.join(ROOT, 'dive_full_post'); os.makedirs(sd, exist_ok=True)
    out = []
    nA = len(A); k0 = nA - 3                      # last 3 frames of A dissolve towards the first cave frame
    for i, f in enumerate(A):
        if i >= k0:
            w = (i - k0 + 1) / 4.0
            f = cv2.addWeighted(f, 1 - w, B[0], w, 0)
        out.append(f)
    out += B
    for i, f in enumerate(out): cv2.imwrite(os.path.join(sd, 'f_%04d.png' % i), f)
    subprocess.run([FFMPEG, '-y', '-loglevel', 'error', '-framerate', '30', '-i', os.path.join(sd, 'f_%04d.png'), '-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-crf', '16', os.path.join(ROOT, 'dive_full.mp4')], check=True)
    print('dive_full frames', len(out))
json.dump(res, open(os.path.join(ROOT, 'our_motion.json'), 'w'), indent=1)
print(json.dumps(res, indent=1))
