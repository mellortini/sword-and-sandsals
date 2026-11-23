"""Post for Cycles stills / frames: bloom on bright emissives, warm grade with lifted maroon blacks, vignette, fine film grain.
Usage:  python -I post.py in.png out.png [--look dark|inside|macro|day] [--seed N]
Needs numpy + opencv-python-headless.  Run it on every frame (use --seed = frame number so the grain animates).
"""
import sys
import cv2
import numpy as np

LOOKS = {
    # tuned against the reference (compare/metrics.json): lifted maroon blacks, saturation x0.93, grain floor ~1-2, soft lens, stronger vignette in dark scenes
    'dark':   dict(bloom=0.45, thr=0.80, radius=0.018, vig=0.70, grain=0.006, lift=(0.045, 0.020, 0.028), sat=0.93, warm=0.02, blur=0.12),
    'inside': dict(bloom=0.25, thr=0.86, radius=0.015, vig=0.35, grain=0.006, lift=(0.040, 0.016, 0.022), sat=0.93, warm=0.02, blur=0.12),
    'macro':  dict(bloom=0.20, thr=0.88, radius=0.015, vig=0.35, grain=0.006, lift=(0.040, 0.016, 0.022), sat=0.84, warm=0.02, blur=0.12),
    'day':    dict(bloom=0.08, thr=0.92, radius=0.012, vig=0.10, grain=0.006, lift=(0.012, 0.012, 0.016), sat=1.00, warm=0.01, blur=0.12),
}


def process(img, look='inside', seed=0):
    o = LOOKS[look]
    h, w = img.shape[:2]
    if o['blur'] > 0:
        img = cv2.GaussianBlur(img, (0, 0), o['blur'] * h / 960.0)
    x = img.astype(np.float32) / 255.0
    # bloom: bright pass -> multi-radius blur -> add
    lum = x.max(axis=2, keepdims=True)
    bright = np.clip((lum - o['thr']) / (1 - o['thr']), 0, 1) * x
    glow = np.zeros_like(x)
    for k, wt in ((1.0, 0.5), (2.5, 0.3), (6.0, 0.2)):
        s = max(1, int(o['radius'] * h * k)) | 1
        glow += cv2.GaussianBlur(bright, (0, 0), s) * wt
    x = x + glow * o['bloom'] * 2.0
    # lifted blacks + warm split + saturation + gentle S-curve
    lift = np.array(o['lift'][::-1], np.float32)       # BGR order
    x = x * (1 - lift) + lift
    l = (0.114 * x[..., 0] + 0.587 * x[..., 1] + 0.299 * x[..., 2])[..., None]
    x[..., 2:3] += o['warm'] * (0.6 + 0.4 * l)
    x[..., 0:1] -= o['warm'] * 0.7 * (0.5 + 0.5 * l)
    x = l + (x - l) * o['sat']
    x = np.clip(x, 0, 1)
    x = x * 0.72 + (x * x * (3 - 2 * x)) * 0.28
    # vignette
    yy, xx = np.mgrid[0:h, 0:w].astype(np.float32)
    d = np.sqrt(((xx / w - 0.5) * (w / h) * 1.0) ** 2 + (yy / h - 0.5) ** 2)
    v = np.clip((d - 0.28) / 0.62, 0, 1)
    x *= (1 - o['vig'] * v * v)[..., None]
    # film grain + paper tooth (darker areas get a little more)
    rng = np.random.default_rng(seed)
    g = rng.normal(0, 1, (h, w, 1)).astype(np.float32)
    gc = rng.normal(0, 0.4, (h, w, 3)).astype(np.float32)
    x += (g + gc) * o['grain'] * (1.5 - l)
    return (np.clip(x, 0, 1) * 255 + 0.5).astype(np.uint8)


if __name__ == '__main__':
    src, dst = sys.argv[1], sys.argv[2]
    look = sys.argv[sys.argv.index('--look') + 1] if '--look' in sys.argv else 'inside'
    seed = int(sys.argv[sys.argv.index('--seed') + 1]) if '--seed' in sys.argv else 0
    im = cv2.imread(src, cv2.IMREAD_COLOR)
    cv2.imwrite(dst, process(im, look, seed))
    print('post ->', dst)
