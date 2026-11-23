#!/usr/bin/env python3
"""Break a reference video into everything needed to write a style bible.

Usage:  python -I analyze_reference.py <video.mp4> <out_dir>
Needs:  ffmpeg + ffprobe on PATH, pip install numpy pillow opencv-python-headless scipy matplotlib

Writes into <out_dir>:
  frames_2fps/         every 0.5 s, 360 px wide
  keyframes/           full-res frames at the real cuts (+0.3 s)
  sheets/              overview + 1 fps contact sheets (6x2) + spectrogram.png
  per_frame_stats.csv  luminance, saturation, mean RGB, contrast, histogram distance (cuts),
                       global translation (camera drift), pixel diff
  shots.txt            detected shots with duration, mean colour, drift
  palettes.txt         k-means palette (6 clusters) + vignette + grain per keyframe
  audio.txt            loudness (EBU R128), band energies per 3 s, strong onsets, tempo

Keep the video itself private. Never paste a reference's script/characters into a new film.
"""
import csv, json, os, subprocess, sys
import cv2, numpy as np

V, OUT = sys.argv[1], sys.argv[2]
for d in ('frames_2fps', 'keyframes', 'sheets'):
    os.makedirs(os.path.join(OUT, d), exist_ok=True)

def run(*a):
    return subprocess.run(a, capture_output=True, text=True)

# 1) cheap extractions with ffmpeg
run('ffmpeg', '-hide_banner', '-loglevel', 'error', '-y', '-i', V, '-vf', 'fps=2,scale=360:-1', '-q:v', '3', os.path.join(OUT, 'frames_2fps', 'f_%03d.jpg'))
run('ffmpeg', '-hide_banner', '-loglevel', 'error', '-y', '-i', V, '-vf', 'fps=1/2,scale=288:-1,tile=10x3', '-frames:v', '1', '-q:v', '2', os.path.join(OUT, 'sheets', 'overview_2s.jpg'))
dur = float(run('ffprobe', '-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', V).stdout.strip() or 0)
for i in range(int(dur // 12) + 1):
    run('ffmpeg', '-hide_banner', '-loglevel', 'error', '-y', '-ss', str(i * 12), '-t', '12', '-i', V, '-vf', 'fps=1,scale=360:-1,tile=6x2', '-frames:v', '1', '-q:v', '2', os.path.join(OUT, 'sheets', f's1fps_{i}.jpg'))

# 2) per-frame stats
cap = cv2.VideoCapture(V); fps = cap.get(cv2.CAP_PROP_FPS) or 30
rows, prev, i = [], None, 0
while True:
    ok, f = cap.read()
    if not ok: break
    s = cv2.resize(f, (270, 480), interpolation=cv2.INTER_AREA)
    g = cv2.cvtColor(s, cv2.COLOR_BGR2GRAY).astype(np.float32)
    hsv = cv2.cvtColor(s, cv2.COLOR_BGR2HSV)
    h = cv2.calcHist([s], [0, 1, 2], None, [8, 8, 8], [0, 256] * 3); h = cv2.normalize(h, h).flatten()
    r = dict(frame=i, t=i / fps, lum=g.mean(), sat=hsv[..., 1].mean(), R=s[..., 2].mean(), G=s[..., 1].mean(), B=s[..., 0].mean(), contrast=g.std(), hd=0, dx=0, dy=0, diff=0)
    if prev is not None:
        r['hd'] = cv2.compareHist(prev[0], h, cv2.HISTCMP_BHATTACHARYYA)
        (dx, dy), _ = cv2.phaseCorrelate(prev[1], g); r['dx'], r['dy'] = dx, dy
        r['diff'] = np.abs(g - prev[1]).mean()
    prev = (h, g); rows.append(r); i += 1
with open(os.path.join(OUT, 'per_frame_stats.csv'), 'w', newline='') as fh:
    w = csv.DictWriter(fh, fieldnames=list(rows[0].keys())); w.writeheader(); w.writerows(rows)

# 3) shots: histogram jump or big pixel diff. Fast camera moves also trigger it, so read the sheets too.
cuts = [r['frame'] for r in rows[1:] if r['hd'] > 0.25 or r['diff'] > 18]
merged = []
for c in cuts:
    if not merged or c - merged[-1] > 3: merged.append(c)
b = [0] + merged + [len(rows)]
with open(os.path.join(OUT, 'shots.txt'), 'w') as fh:
    for k in range(len(b) - 1):
        seg = rows[b[k]:b[k + 1]]
        fh.write(f"shot{k+1:02d} {b[k]/fps:6.2f}-{b[k+1]/fps:6.2f}s dur={(b[k+1]-b[k])/fps:5.2f} lum={np.mean([r['lum'] for r in seg]):5.1f} sat={np.mean([r['sat'] for r in seg]):5.1f} RGB=({np.mean([r['R'] for r in seg]):.0f},{np.mean([r['G'] for r in seg]):.0f},{np.mean([r['B'] for r in seg]):.0f}) drift270=({sum(r['dx'] for r in seg):.0f},{sum(r['dy'] for r in seg):.0f})\n")
# keyframes: 0.3 s after each shot start of >=0.4 s length
for k in range(len(b) - 1):
    if (b[k + 1] - b[k]) / fps >= 0.4:
        t = b[k] / fps + 0.3
        run('ffmpeg', '-hide_banner', '-loglevel', 'error', '-y', '-ss', f'{t:.2f}', '-i', V, '-frames:v', '1', '-q:v', '2', os.path.join(OUT, 'keyframes', f'k_{t:06.2f}.jpg'))

# 4) palette / vignette / grain per keyframe
with open(os.path.join(OUT, 'palettes.txt'), 'w') as fh:
    for fn in sorted(os.listdir(os.path.join(OUT, 'keyframes'))):
        im = cv2.imread(os.path.join(OUT, 'keyframes', fn))
        s = cv2.resize(im, (135, 240), interpolation=cv2.INTER_AREA)
        Z = cv2.cvtColor(s, cv2.COLOR_BGR2LAB).reshape(-1, 3).astype(np.float32)
        _, lab, cent = cv2.kmeans(Z, 6, None, (cv2.TERM_CRITERIA_EPS + cv2.TERM_CRITERIA_MAX_ITER, 30, 0.5), 3, cv2.KMEANS_PP_CENTERS)
        cnt = np.bincount(lab.flatten(), minlength=6) / len(lab)
        cols = []
        for o in np.argsort(-cnt):
            bgr = cv2.cvtColor(cent[o].reshape(1, 1, 3).astype(np.uint8), cv2.COLOR_LAB2BGR)[0, 0]
            cols.append('#%02X%02X%02X %d%%' % (bgr[2], bgr[1], bgr[0], round(cnt[o] * 100)))
        g = cv2.cvtColor(im, cv2.COLOR_BGR2GRAY).astype(np.float32); H, W = g.shape
        centre = g[H // 3:2 * H // 3, W // 4:3 * W // 4].mean()
        edge = np.concatenate([g[:H // 8].ravel(), g[-H // 8:].ravel(), g[:, :W // 8].ravel(), g[:, -W // 8:].ravel()]).mean()
        hp = g - cv2.GaussianBlur(g, (0, 0), 2.0)
        ps = [hp[y:y + 48, x:x + 48].std() for y in range(0, H - 48, 96) for x in range(0, W - 48, 96)]
        fh.write(f"{fn} | {' | '.join(cols)} | vignette(edge/centre)={edge/centre:.2f} grain_floor={np.percentile(ps,10):.2f} lum p1/p50/p99={np.percentile(g,1):.0f}/{np.percentile(g,50):.0f}/{np.percentile(g,99):.0f}\n")

# 5) audio
import scipy.io.wavfile as wf, scipy.signal as sg
wav = os.path.join(OUT, 'audio44.wav')
run('ffmpeg', '-hide_banner', '-loglevel', 'error', '-y', '-i', V, '-vn', '-ac', '2', '-ar', '44100', wav)
lufs = run('ffmpeg', '-hide_banner', '-i', V, '-af', 'ebur128=peak=true', '-vn', '-f', 'null', '-').stderr.split('Summary:')[-1]
sr, x = wf.read(wav); x = x.astype(np.float32) / 32768; m = x.mean(1)
f, t, S = sg.spectrogram(m, sr, nperseg=2048, noverlap=1536); S = 10 * np.log10(S + 1e-12)
bands = [(20, 150, 'sub'), (150, 500, 'lowmid'), (500, 2000, 'mid'), (2000, 6000, 'presence'), (6000, 16000, 'air')]
f2, t2, Z = sg.stft(m, sr, nperseg=1024, noverlap=768); flux = np.maximum(0, np.diff(np.abs(Z), axis=1)).sum(0); flux /= flux.max()
pk, _ = sg.find_peaks(flux, height=0.25, distance=8)
env = flux - flux.mean(); ac = np.correlate(env, env, 'full')[len(env) - 1:]; lags = np.arange(len(ac)) * (t2[1] - t2[0]); mk = (lags > .3) & (lags < 1.2)
with open(os.path.join(OUT, 'audio.txt'), 'w') as fh:
    fh.write(lufs + '\n')
    fh.write('t   ' + ' '.join(f'{b[2]:>9}' for b in bands) + '  rmsdB\n')
    for a in range(0, int(len(m) / sr), 3):
        row = [S[np.ix_((f >= lo) & (f < hi), (t >= a) & (t < a + 3))].mean() for lo, hi, _ in bands]
        seg = m[a * sr:(a + 3) * sr]
        fh.write(f'{a:3d}s ' + ' '.join(f'{v:9.1f}' for v in row) + f'  {20*np.log10(np.sqrt((seg**2).mean())+1e-9):6.1f}\n')
    fh.write('side/mid ratio %.3f\n' % (np.sqrt(((x[:, 0] - x[:, 1]) ** 2).mean()) / np.sqrt((m ** 2).mean())))
    fh.write('strong onsets (s): %s\n' % [round(float(t2[p + 1]), 2) for p in pk])
    fh.write('dominant period %.3f s\n' % lags[mk][np.argmax(ac[mk])])
import matplotlib; matplotlib.use('Agg')
import matplotlib.pyplot as plt
plt.figure(figsize=(14, 5)); plt.pcolormesh(t, f, S, shading='auto', vmin=-100, vmax=-20); plt.ylim(0, 12000); plt.colorbar()
plt.savefig(os.path.join(OUT, 'sheets', 'spectrogram.png'), dpi=80)
print('done ->', OUT)
