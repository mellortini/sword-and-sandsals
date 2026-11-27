import cv2, numpy as np, json, os
from PIL import Image, ImageDraw, ImageFont
os.chdir(r'D:\animacje\ref_style')
PAIRS = [
 ('belt',       'keyframes/k_007.5.jpg',  'out/pp_belt.png'),
 ('breakfast',  'keyframes/k_002.4.jpg',  'out/pp_breakfast.png'),
 ('town',       'keyframes/k_031.9.jpg',  'out/pp_town.png'),
 ('jars',       'compare/ref_38.9.jpg',   'out/pp_jars.png'),
 ('cave_hands', 'compare/ref_9.0.jpg',    'out/pp_cave_hands.png'),
 ('cell',       'keyframes/k_022.5.jpg',  'out/pp_cell.png'),
 ('party',      'keyframes/k_000.5.jpg',  'out/pp_party.png'),
]
W, H = 540, 960
def load(p): return cv2.resize(cv2.imread(p), (W, H), interpolation=cv2.INTER_AREA)
def pal(im, k=6):
    s = cv2.resize(im, (108, 192), interpolation=cv2.INTER_AREA)
    Z = cv2.cvtColor(s, cv2.COLOR_BGR2LAB).reshape(-1, 3).astype(np.float32)
    _, lab, c = cv2.kmeans(Z, k, None, (cv2.TERM_CRITERIA_EPS + cv2.TERM_CRITERIA_MAX_ITER, 30, .5), 3, cv2.KMEANS_PP_CENTERS)
    cnt = np.bincount(lab.flatten(), minlength=k) / len(lab); out = []
    for o in np.argsort(-cnt):
        b = cv2.cvtColor(c[o].reshape(1, 1, 3).astype(np.uint8), cv2.COLOR_LAB2BGR)[0, 0]; out.append(((int(b[2]), int(b[1]), int(b[0])), float(cnt[o])))
    return out
def stats(im):
    g = cv2.cvtColor(im, cv2.COLOR_BGR2GRAY).astype(np.float32); hsv = cv2.cvtColor(im, cv2.COLOR_BGR2HSV)
    h, w = g.shape; ctr = g[h//3:2*h//3, w//4:3*w//4].mean()
    edge = np.concatenate([g[:h//8].ravel(), g[-h//8:].ravel(), g[:, :w//8].ravel(), g[:, -w//8:].ravel()]).mean()
    hp = g - cv2.GaussianBlur(g, (0, 0), 2.0); ps = [hp[y:y+32, x:x+32].std() for y in range(0, h-32, 64) for x in range(0, w-32, 64)]
    return dict(lum=float(g.mean()), p1=float(np.percentile(g, 1)), p50=float(np.percentile(g, 50)), p99=float(np.percentile(g, 99)),
                sat=float(hsv[..., 1].mean()), R=float(im[..., 2].mean()), G=float(im[..., 1].mean()), B=float(im[..., 0].mean()),
                vig=float(edge / max(ctr, 1)), grain=float(np.percentile(ps, 10)), sharp=float(cv2.Laplacian(g, cv2.CV_32F).var()),
                contrast=float(g.std()))
try: F = ImageFont.truetype('arial.ttf', 17); FB = ImageFont.truetype('arialbd.ttf', 20)
except Exception: F = FB = ImageFont.load_default()
res = {}
for name, rp, op in PAIRS:
    r, o = load(rp), load(op); sr, so = stats(r), stats(o); pr, po = pal(r), pal(o)
    res[name] = dict(ref=sr, ours=so, pal_ref=['#%02X%02X%02X %d%%' % (*c, round(f*100)) for c, f in pr], pal_ours=['#%02X%02X%02X %d%%' % (*c, round(f*100)) for c, f in po])
    # luminance difference map (signed): ours - ref, blurred, shows where we are brighter/darker
    d = cv2.GaussianBlur(cv2.cvtColor(o, cv2.COLOR_BGR2GRAY).astype(np.float32) - cv2.cvtColor(r, cv2.COLOR_BGR2GRAY).astype(np.float32), (0, 0), 6)
    dm = np.zeros((H, W, 3), np.uint8); dm[..., 2] = np.clip(d * 2.2, 0, 255); dm[..., 0] = np.clip(-d * 2.2, 0, 255); dm[..., 1] = 18
    board = Image.new('RGB', (W * 4 + 30, H + 150), (24, 24, 28)); dr = ImageDraw.Draw(board)
    for i, (im, lab) in enumerate(((r, 'REFERENCE'), (o, 'OURS (Blender)'), (dm, 'LUMINANCE DIFF  red = ours brighter, blue = darker'))):
        board.paste(Image.fromarray(cv2.cvtColor(im, cv2.COLOR_BGR2RGB)), (i * (W + 10), 40)); dr.text((i * (W + 10) + 6, 8), lab, fill=(240, 240, 240), font=FB)
    x0 = 3 * (W + 10); dr.text((x0 + 6, 8), name.upper() + '  metrics (ref | ours)', fill=(240, 240, 240), font=FB)
    rows = [('mean lum', 'lum', 1), ('p1 lum', 'p1', 1), ('p50 lum', 'p50', 1), ('p99 lum', 'p99', 1), ('contrast', 'contrast', 1), ('saturation', 'sat', 1), ('R mean', 'R', 0), ('G mean', 'G', 0), ('B mean', 'B', 0), ('vignette e/c', 'vig', 2), ('grain floor', 'grain', 2), ('sharpness', 'sharp', 0)]
    y = 46
    for lbl, k, dp in rows:
        a, b = sr[k], so[k]; f = '%.' + str(dp) + 'f'
        flag = abs(b - a) / max(abs(a), 1e-3) > 0.25
        dr.text((x0 + 6, y), '%-13s %8s | %8s' % (lbl, f % a, f % b), fill=(255, 150, 120) if flag else (210, 210, 210), font=F); y += 24
    y += 8; dr.text((x0 + 6, y), 'palette (ref top, ours below)', fill=(240, 240, 240), font=F); y += 28
    for row in (pr, po):
        x = x0 + 6
        for c, f in row: dr.rectangle([x, y, x + max(8, int(f * 500)), y + 34], fill=c); x += max(8, int(f * 500)) + 2
        y += 42
    # swatch labels
    y += 4
    for lab, p in (('ref', res[name]['pal_ref']), ('ours', res[name]['pal_ours'])):
        dr.text((x0 + 6, y), lab + ': ' + ' '.join(s.split()[0] for s in p), fill=(200, 200, 200), font=F); y += 22
    board.save('compare/board_%s.jpg' % name, quality=90)
json.dump(res, open('compare/metrics.json', 'w'), indent=1)
print(json.dumps({k: {m: (round(v['ref'][m], 1), round(v['ours'][m], 1)) for m in ('lum', 'sat', 'vig', 'grain', 'sharp', 'contrast')} for k, v in res.items()}, indent=0))
