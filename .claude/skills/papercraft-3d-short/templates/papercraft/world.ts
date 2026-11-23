// "Normal world" and "inside the body" set pieces + scene builders. Every builder: (scene, camera, t seconds) => void.
// Units: 1 unit = 100 px of the 1080x1920 frame (frame = 10.8 x 19.2). Camera sits ~45 units away, fov 24.
import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';
import { PAL, paperMat, glowMat, goldMat, layer, ring, put, roundedRect, disc, ellipse, blob, paperLights, practical } from './paper';
import { makeFigure, makeHand } from './characters';

// ---------------------------------------------------------------- printed papers
export type Pattern = 'pinstripe' | 'gingham' | 'polka' | 'stripes' | 'stitch' | 'denim' | 'curtain' | 'check';
const patCache = new Map<string, THREE.CanvasTexture>();

/** Printed-paper material. `tile` = units per texture repeat (ExtrudeGeometry UVs are in world units). */
export function patternMat(kind: Pattern, c1: string, c2: string, tile = 4, bump: 'fibre' | 'corrugV' | 'corrugH' | 'twill' = 'fibre'): THREE.MeshStandardMaterial {
  const key = `${kind}|${c1}|${c2}`;
  let tex = patCache.get(key);
  if (!tex) {
    const N = 512, c = document.createElement('canvas'); c.width = c.height = N;
    const g = c.getContext('2d')!;
    g.fillStyle = c1; g.fillRect(0, 0, N, N); g.fillStyle = c2; g.strokeStyle = c2;
    if (kind === 'pinstripe') { for (let x = 32; x < N; x += 64) g.fillRect(x - 3, 0, 6, N); }
    else if (kind === 'stripes') { for (let y = 0; y < N; y += 128) g.fillRect(0, y, N, 64); }
    else if (kind === 'polka') { for (let y = 0; y < 4; y++) for (let x = 0; x < 4; x++) { for (const ox of [0, -N, N]) { g.beginPath(); g.arc(64 + x * 128 + (y % 2) * 64 + ox, 64 + y * 128, 20, 0, 7); g.fill(); } } }
    else if (kind === 'gingham') { g.globalAlpha = 0.45; for (let i = 0; i < 4; i++) { g.fillRect(i * 128, 0, 64, N); g.fillRect(0, i * 128, N, 64); } g.globalAlpha = 1; }
    else if (kind === 'check') { for (let y = 0; y < 8; y++) for (let x = 0; x < 8; x++) if ((x + y) % 2 === 0) g.fillRect(x * 64, y * 64, 64, 64); }
    else if (kind === 'stitch') { g.fillRect(0, 56, N, 0); for (const y of [40, N - 40]) for (let x = 0; x < N; x += 52) g.fillRect(x, y - 4, 34, 8); }
    else if (kind === 'denim') { g.globalAlpha = 0.25; g.lineWidth = 2; for (let i = -N; i < N * 2; i += 8) { g.beginPath(); g.moveTo(i, 0); g.lineTo(i + N, N); g.stroke(); } g.globalAlpha = 1; }
    else if (kind === 'curtain') { for (let x = 0; x < N; x += 64) { const gr = g.createLinearGradient(x, 0, x + 64, 0); gr.addColorStop(0, 'rgba(0,0,0,0.35)'); gr.addColorStop(0.5, 'rgba(255,255,255,0.05)'); gr.addColorStop(1, 'rgba(0,0,0,0.35)'); g.fillStyle = gr; g.fillRect(x, 0, 64, N); } }
    tex = new THREE.CanvasTexture(c); tex.wrapS = tex.wrapT = THREE.RepeatWrapping; tex.colorSpace = THREE.SRGBColorSpace; tex.anisotropy = 8;
    patCache.set(key, tex);
  }
  const m = paperMat('#ffffff', { kind: bump });
  const t = tex.clone(); t.needsUpdate = true; t.repeat.set(1 / tile, 1 / tile); m.map = t;
  return m;
}

const rnd = (seed: number) => { let a = seed >>> 0; return () => { a = (a * 1664525 + 1013904223) >>> 0; return a / 4294967296; }; };
const shapeFromPts = (pts: [number, number][]) => { const s = new THREE.Shape(); pts.forEach(([x, y], i) => (i ? s.lineTo(x, y) : s.moveTo(x, y))); return s; };
/** Band along a polyline (stroke as paper). */
export function band(pts: [number, number][], w: number): THREE.Shape {
  const L: [number, number][] = [], R: [number, number][] = [];
  for (let i = 0; i < pts.length; i++) {
    const a = pts[Math.max(0, i - 1)], b = pts[Math.min(pts.length - 1, i + 1)];
    let dx = b[0] - a[0], dy = b[1] - a[1]; const l = Math.hypot(dx, dy) || 1; dx /= l; dy /= l;
    L.push([pts[i][0] - dy * w / 2, pts[i][1] + dx * w / 2]); R.push([pts[i][0] + dy * w / 2, pts[i][1] - dx * w / 2]);
  }
  return shapeFromPts([...L, ...R.reverse()]);
}
export function wave(w: number, amp: number, freq: number, phase: number, n = 80): [number, number][] {
  const p: [number, number][] = []; for (let i = 0; i <= n; i++) { const x = -w / 2 + (i / n) * w; p.push([x, Math.sin(x * freq + phase) * amp]); } return p;
}
export function sugarCube(size = 0.9): THREE.Mesh {
  const m = new THREE.Mesh(new RoundedBoxGeometry(size, size, size, 3, size * 0.12), paperMat('#f6f2ec', { bump: 1.0, emissive: '#6a645c', emissiveIntensity: 0.35 }));
  m.castShadow = m.receiveShadow = true; return m;
}

// ---------------------------------------------------------------- set pieces
export function makeButton(r = 0.55): THREE.Group {
  const g = new THREE.Group();
  put(g, layer(disc(r), paperMat('#f4f1ec'), 0.18, 0.04), 0, 0, 0);
  for (const [x, y] of [[-1, -1], [1, 1], [-1, 1], [1, -1]]) put(g, layer(disc(r * 0.09), paperMat('#7d7d86'), 0.04, 0), x * r * 0.25, y * r * 0.25, 0.14);
  return g;
}

export function makeJar(face: 'smile' | 'o' | 'happy' = 'smile', locked = true, size = 1): THREE.Group {
  const g = new THREE.Group();
  put(g, layer(roundedRect(5.0, 4.6, 1.7), paperMat('#f2c458', { bump: 0.5 }), 0.8, 0.05), 0, 0, 0);
  put(g, layer(roundedRect(0.45, 2.4, 0.22), paperMat('#fff0b8', { opacity: 0.85, transparent: true }), 0.05, 0), -1.9, 0.3, 0.45);   // glass highlight
  put(g, layer(roundedRect(5.4, 1.0, 0.3), patternMat('stripes', '#e8aa3a', '#d6962a', 0.5, 'corrugV'), 0.8, 0.04), 0, 2.6, 0.1);  // ribbed lid
  for (const sx of [-1, 1]) put(g, layer(disc(0.2), paperMat('#4a2b1d'), 0.05, 0), sx * 0.85, 0.5, 0.45);
  if (face === 'smile' || face === 'happy') { const s = new THREE.Shape(); s.absarc(0, 0, 0.5, Math.PI * 1.1, Math.PI * 1.9, false); s.absarc(0, 0.06, 0.46, Math.PI * 1.9, Math.PI * 1.1, true); put(g, layer(s, paperMat('#4a2b1d'), 0.05, 0), 0, -0.1, 0.45); }
  else put(g, layer(ellipse(0.2, 0.28), paperMat('#4a2b1d'), 0.05, 0), 0, -0.45, 0.45);
  for (const sx of [-1, 1]) put(g, layer(disc(0.32), paperMat('#f0907a', { opacity: 0.8, transparent: true }), 0.04, 0), sx * 1.45, -0.2, 0.44);
  for (const [x, y, r] of [[1.2, -1.4, 0.18], [1.7, -0.9, 0.12], [0.6, -1.6, 0.1]]) put(g, layer(disc(r), paperMat('#ffe9a0', { opacity: 0.8, transparent: true }), 0.03, 0), x, y, 0.44);
  if (locked) {
    put(g, layer(roundedRect(0.95, 0.85, 0.2), paperMat('#c9c9cf', { roughness: 0.5 } as any), 0.3, 0.03), 0, 2.6, 0.7);
    const sh = new THREE.Shape(); sh.absarc(0, 0, 0.4, 0, Math.PI, false); sh.absarc(0, 0, 0.26, Math.PI, 0, true);
    put(g, layer(sh, paperMat('#b8b8c0'), 0.2, 0.02), 0, 3.15, 0.7);
  }
  g.scale.setScalar(size); return g;
}

export function makeKey(len = 3): THREE.Group {
  const g = new THREE.Group(); const gm = goldMat('#d8aa3a');
  const r = new THREE.Shape(); r.absarc(0, 0, 0.55, 0, Math.PI * 2, false); const h = new THREE.Path(); h.absarc(0, 0, 0.32, 0, Math.PI * 2, true); r.holes.push(h);
  put(g, layer(r, gm, 0.2, 0.03), 0, 0, 0);
  put(g, layer(roundedRect(len, 0.26, 0.1), gm, 0.2, 0.02), len / 2 + 0.4, 0, 0);
  for (const [x, hh] of [[len - 0.1, 0.55], [len + 0.35, 0.8]]) put(g, layer(roundedRect(0.26, hh, 0.06), gm, 0.2, 0.02), x, -hh / 2 + 0.1, 0);
  return g;
}

export function makeBuilding(w = 3.9, h = 8.2, windows = true, lit = 0): THREE.Group {
  const g = new THREE.Group();
  put(g, layer(roundedRect(w, h, 0.7), patternMat('stripes', '#e0404a', '#d63a45', 0.6, 'corrugV'), 1.0, 0.04), 0, 0, 0);
  for (let i = 0; i < 6; i++) { const k = 1 - i * 0.15; put(g, layer(ring(ellipse(w * 0.5 * k, 0.5 * k), ellipse(w * 0.5 * k - 0.14, 0.5 * k - 0.04)), paperMat('#e8505a'), 0.1, 0.01), 0, h / 2 + 0.05, 0.45 + i * 0.06); }
  if (windows) for (const sx of [-1, 1]) for (let r = 0; r < 3; r++) {
    const wm = paperMat('#f3e6c0', { emissive: '#ffd37a', emissiveIntensity: lit });
    put(g, layer(roundedRect(0.95, 1.25, 0.15), wm, 0.12, 0.02), sx * 0.95, 2.1 - r * 2.0, 0.55);
    put(g, layer(disc(0.07), paperMat('#a8711f'), 0.04, 0), sx * 0.95 + 0.3, 2.1 - r * 2.0, 0.7);
  }
  return g;
}

// ---------------------------------------------------------------- scene builders
type B = (scene: THREE.Scene, cam: THREE.PerspectiveCamera, t: number) => void;

export const buildBelt: B = (scene, cam, t) => {
  scene.background = new THREE.Color('#1a1117');
  paperLights(scene, { keyPos: [-8, 12, 16], keyIntensity: 2.3, fill: '#d6e6f4', fillIntensity: 1.5, shadow: 6 });
  const open = 0.55 + 0.45 * Math.sin(t * 2.2) ** 2;                      // slit breathing
  const slit = new THREE.Shape(); const sh = 4.6 * 0.5, sw = 0.55 * open;
  slit.moveTo(0, -sh); slit.bezierCurveTo(sw * 1.6, -sh * 0.4, sw * 1.6, sh * 0.4, 0, sh); slit.bezierCurveTo(-sw * 1.6, sh * 0.4, -sw * 1.6, -sh * 0.4, 0, -sh);
  const SY = 4.2;
  const shirtShape = roundedRect(15, 13, 0.3); const hole = new THREE.Shape(); slit.getPoints(24).forEach((p, i) => (i ? hole.lineTo(p.x, p.y + SY - 3.4) : hole.moveTo(p.x, p.y + SY - 3.4)));
  put(scene, layer(ring(shirtShape, hole), patternMat('pinstripe', '#cfe6f2', '#ffffff', 4.8), 0.4, 0.03), 0, 3.4, 0);
  // ember + maroon interior behind the slit
  put(scene, layer(roundedRect(4, 8, 0.2), paperMat('#6a1f26'), 0.2, 0), 0, SY, -1.2);
  put(scene, layer(ellipse(0.5, 1.2), glowMat('#ff8a2a', 1.1), 0.1, 0), 0, SY - 1.9, -0.9);
  const el = practical('#ff8a30', 14, 16, 2); el.position.set(0, SY - 1.8, 0.8); scene.add(el);
  // buttons + tension strokes
  put(scene, makeButton(), 0, SY + 2.6, 0.45); put(scene, makeButton(), 0, SY - 2.7, 0.45);
  for (const sx of [-1, 1]) for (const dy of [0.15, -0.35]) { const c = band([[0.9 * sx, SY + 2.7 + dy], [2.6 * sx, SY + 2.9 + dy * 1.8], [3.7 * sx, SY + 2.95 + dy * 1.8]], 0.12); put(scene, layer(c, paperMat('#7fa6c2'), 0.03, 0), 0, 0, 0.45); }
  // denim
  put(scene, layer(roundedRect(15.5, 9, 0.1), patternMat('denim', '#46507a', '#6a78b8', 2.5, 'twill'), 0.4, 0.02), 0, -7.8, 0.15);
  for (const sx of [-1, 1]) put(scene, layer(roundedRect(0.07, 6.2, 0), paperMat('#54609a'), 0.02, 0), sx * 3.3, -8.6, 0.38).rotation.z = sx * 0.55;
  // belt
  const tilt = 0.012 * Math.sin(t * 2.2);
  const belt = new THREE.Group(); belt.rotation.z = tilt; scene.add(belt);
  put(belt, layer(roundedRect(16, 2.7, 0.25), patternMat('stitch', '#b87846', '#f1d9b4', 2.4), 0.45, 0.03), 0, -1.8, 0.9);
  for (const x of [-5.6, -4.1, -2.6]) put(belt, layer(disc(0.2), paperMat('#241812'), 0.1, 0), x, -1.8, 1.14);
  put(belt, layer(roundedRect(0.9, 3.0, 0.25), paperMat('#a8683c'), 0.5, 0.03), 5.3, -1.8, 1.15);
  const buckle = ring(roundedRect(4.6, 3.8, 0.8), roundedRect(3.3, 2.5, 0.45));
  put(belt, layer(buckle, goldMat(), 0.4, 0.07), 0, -1.8, 1.55);
  put(belt, layer(roundedRect(2.7, 0.3, 0.14), goldMat(), 0.25, 0.04), -0.3 + 0.05 * Math.sin(t * 17), -1.8, 1.3);
  cam.position.set(0, 0, 47); cam.lookAt(0, 0, 0);
};

function table(scene: THREE.Scene, kind: Pattern, c1: string, c2: string) {
  scene.background = new THREE.Color(c1);
  paperLights(scene, { keyPos: [-7, 10, 18], keyIntensity: 2.0, fill: '#d8e0e0', fillIntensity: 1.0, shadow: 6 });
  put(scene, layer(roundedRect(16, 26, 0), patternMat(kind, c1, c2, 2.4), 0.2, 0), 0, 0, -0.5);
  const W = paperMat('#f6f3ee');
  put(scene, layer(disc(4.5), W, 0.25, 0.05), 0, 0.3, 0.2); put(scene, layer(disc(3.7), paperMat('#fbf9f5'), 0.05, 0), 0, 0.3, 0.38);
  for (const sx of [-1, 1]) { put(scene, layer(blob(1.15, 0.95, 0.07, 3 + sx), paperMat('#fffaf0'), 0.12, 0.02), sx * 1.5, 1.4, 0.5); put(scene, layer(disc(0.5), paperMat('#f2a31b'), 0.12, 0.02), sx * 1.5, 1.35, 0.66); put(scene, layer(disc(0.1), paperMat('#fff1c0'), 0.02, 0), sx * 1.35, 1.55, 0.74); }
  const smile = band(Array.from({ length: 18 }, (_, i) => { const a = Math.PI * (1.12 + 0.76 * i / 17); return [Math.cos(a) * 2.2, Math.sin(a) * 1.5 - 0.7] as [number, number]; }).map(([x, y], i) => [x, y + 0.1 * Math.sin(i * 0.8)] as [number, number]), 0.5);
  put(scene, layer(smile, paperMat('#c2453d'), 0.12, 0.02), 0, 0, 0.6);
  put(scene, layer(roundedRect(1.5, 6, 0.2), paperMat('#e7e1d4'), 0.1, 0.02), -6, 0, 0); put(scene, layer(roundedRect(0.5, 4.8, 0.1), paperMat('#9ea6b0'), 0.1, 0.02), -6, 0.6, 0.2);   // fork
  put(scene, layer(roundedRect(0.7, 5.8, 0.3), paperMat('#c3cbd6'), 0.1, 0.02), 6, 0, 0.1);                                                                                    // knife
  put(scene, layer(disc(2.1), W, 0.2, 0.04), 4.6, 8.4, 0.1); put(scene, layer(disc(1.5), W, 0.3, 0.05), 4.6, 8.4, 0.3); put(scene, layer(disc(1.25), paperMat('#3a2418'), 0.06, 0), 4.6, 8.4, 0.5);
  put(scene, layer(disc(1.5), paperMat('#e9e2d3'), 0.2, 0.04), -4.4, 8.6, 0.1); put(scene, layer(disc(1.15), paperMat('#f2a31b'), 0.08, 0), -4.4, 8.6, 0.3);
  put(scene, layer(roundedRect(11, 6, 0.2), paperMat('#f4f1ea'), 0.1, 0.01), 1.2, -9.8, -0.1).rotation.z = 0.03;
  put(scene, layer(roundedRect(6.4, 0.8, 0.1), paperMat('#2b2b2e'), 0.03, 0), -0.8, -8.3, 0.0);
  put(scene, layer(roundedRect(3, 2.6, 0.1), paperMat('#c9494a'), 0.03, 0), -3.6, -10.2, 0.0);
  for (let i = 0; i < 4; i++) put(scene, layer(roundedRect(4.4, 0.2, 0.05), paperMat('#8d8d90'), 0.02, 0), 3.2, -9.4 - i * 0.6, 0.0);
}
export const buildBreakfastPolka: B = (s, c) => { table(s, 'polka', '#bedabf', '#eef4ec'); c.position.set(0, 0, 57); };
export const buildBreakfastStripes: B = (s, c) => { table(s, 'stripes', '#f3c24a', '#f8d97a'); c.position.set(0, 0, 57); };
export const buildBreakfastGingham: B = (s, c) => { table(s, 'gingham', '#b9d3ef', '#7fa9d8'); c.position.set(0, 0, 57); };

export const buildFamily: B = (scene, cam, t) => {
  scene.background = new THREE.Color('#161424');
  paperLights(scene, { keyIntensity: 0.12, fillIntensity: 0.35, fill: '#4a4a72' });
  // thousands of tiny candle people far behind: instanced glow discs -> bokeh through DOF
  const n = 3600, inst = new THREE.InstancedMesh(new THREE.CircleGeometry(0.075, 10), new THREE.MeshBasicMaterial({ color: '#ffe7a0' }), n);
  const m = new THREE.Matrix4(), r = rnd(5), col = new THREE.Color();
  for (let i = 0; i < n; i++) { const x = (i % 72) * 0.52 - 19.5 + (Math.floor(i / 72) % 2) * 0.26, y = 12 - Math.floor(i / 72) * 0.44; m.makeTranslation(x + (r() - 0.5) * 0.18, y + (r() - 0.5) * 0.12, -14 - Math.floor(i / 72) * 0.02); inst.setMatrixAt(i, m); inst.setColorAt(i, col.set(r() > 0.12 ? '#ffe3a0' : '#c8a4d8').multiplyScalar(0.25 + r() * 0.5)); }
  scene.add(inst);
  for (let i = 0; i < 6; i++) put(scene, layer(roundedRect(2.4, 1.0, 0.3), paperMat(['#3a3a58', '#4c3a58', '#33445c'][i % 3]), 0.1, 0), -15 + i * 6, 11 - (i % 2) * 5, -14.4);
  // stage
  put(scene, layer(roundedRect(30, 3, 0), patternMat('curtain', '#4a3224', '#000', 3), 0.4, 0), 0, -8.2, -1);
  const cast: [string, any][] = [
    ['mom', { shirt: '#6fc08a', side: true, mustache: false, hair: '#6b3a2a', glow: '#9cff9c', skin: '#eba684' }],
    ['dad', { shirt: '#f4f0ea', hair: '#3d2a24', glow: '#fff1c8' }],
    ['grandpa', { shirt: '#a8744a', hair: '#e9e6e2', glasses: true, glow: '#ffb86a' }],
    ['grandma', { shirt: '#b08ad8', mustache: false, bun: true, hair: '#d9d6d6', glasses: true, glow: '#ff9ad0' }],
  ];
  cast.forEach(([, o], i) => { const f = makeFigure(o); f.scale.setScalar(0.32); f.position.set(-4.1 + i * 2.8 + (i > 1 ? 0.3 : 0), -2.4 - 0.1 * (i % 2), 0); f.children[0].rotation.z = 0.02 * Math.sin(t * 1.4 + i); scene.add(f); });
  cam.position.set(0, 1, 45); cam.lookAt(0, 1, 0);
};

export const buildTown: B = (scene, cam, t) => {
  scene.background = new THREE.Color('#3a1a20');
  paperLights(scene, { keyPos: [-8, 12, 16], keyIntensity: 1.2, fill: '#8a3a4a', fillIntensity: 0.55, shadow: 7 });
  put(scene, layer(roundedRect(20, 30, 0), patternMat('polka', '#4e2028', '#5a2630', 2), 0.1, 0), 0, 0, -3);
  for (const [x, y, rx, ry, c] of [[-6, 8, 3.2, 2.6, '#5b262e'], [4.8, 6.2, 4.2, 3.2, '#4a1f27'], [-1, 5, 2.8, 2.2, '#68303a']] as const) put(scene, layer(ellipse(rx, ry), paperMat(c), 0.2, 0.02), x, y, -2.2);
  const lit = 0.35 + 0.35 * Math.sin(t * 2);
  [[-4.3, 0], [0.1, 0], [4.5, 0]].forEach(([x], i) => { const b = makeBuilding(3.9, 8.2, true, i === 1 ? lit * 2 : 0.5); b.position.set(x, 4.2, 0); scene.add(b); });
  const cols = ['#8f1f36', '#a8263c', '#c23347'];
  for (let i = 0; i < 3; i++) {
    const pts = wave(24, 0.55, 0.9, i * 1.4); const top = pts.map(([x, y]) => [x, y + 1.6 - i * 2.6] as [number, number]);
    const sh = shapeFromPts([...top, [12, -14], [-12, -14]]);
    put(scene, layer(sh, paperMat(cols[i]), 0.3, 0.03), 0, 0, 0.5 + i * 0.5);
    put(scene, layer(band(top, 0.08), paperMat('#e9a0a8'), 0.04, 0), 0, 0, 0.82 + i * 0.5);
  }
  const r = rnd(9);
  for (let i = 0; i < 12; i++) { const c = sugarCube(0.9); c.position.set(-4.6 + r() * 9.4, -4.8 + r() * 5.8, 2.0 + r() * 0.25); c.rotation.set(r(), r(), r() * 3); scene.add(c); }
  cam.position.set(0, 0, 55);
};

export const buildJars: B = (scene, cam, t) => {
  scene.background = new THREE.Color('#3a1a20');
  paperLights(scene, { keyPos: [-8, 12, 16], keyIntensity: 1.5, fill: '#8a3a4a', fillIntensity: 0.55, shadow: 7 });
  put(scene, layer(roundedRect(20, 30, 0), patternMat('polka', '#4e2028', '#5a2630', 2), 0.1, 0), 0, 0, -3);
  for (const [x, y, rx, ry] of [[-4, 8, 4.4, 3.2], [3.4, 7, 3.6, 2.6]] as const) put(scene, layer(ellipse(rx, ry), paperMat('#5a2630'), 0.2, 0.02), x, y, -2);
  const j1 = makeJar('smile', true, 1.2); j1.position.set(-1.5, -1.6, 0.8); scene.add(j1);
  const j2 = makeJar('o', true, 0.88); j2.position.set(3.6, 2.4, 0.3); scene.add(j2);
  const j3 = makeJar('smile', true, 0.8); j3.position.set(3.7, -2.5, 0.9); scene.add(j3);
  for (let i = 0; i < 3; i++) { const sh = shapeFromPts([...wave(24, 0.5, 0.8, i * 1.3).map(([x, y]) => [x, y - 6 - i * 2.4] as [number, number]), [12, -16], [-12, -16]]); put(scene, layer(sh, paperMat(['#8f1f36', '#a8263c', '#c23347'][i]), 0.3, 0.03), 0, 0, 1.4 + i * 0.4); }
  const k1 = makeKey(); k1.position.set(-8.2, -1.2, 1.3); k1.rotation.z = 0.12; scene.add(k1);
  const k2 = makeKey(2.4); k2.position.set(-6.2, 3.8, 1.2); k2.rotation.z = 0.7; scene.add(k2);
  const k3 = makeKey(2.4); k3.position.set(0.5, 6.4, 1.2); k3.rotation.z = -0.4; scene.add(k3);
  const r = rnd(4); for (let i = 0; i < 6; i++) { const c = sugarCube(0.8); c.position.set(-5 + r() * 12, -7.5 + r() * 2, 2.1); c.rotation.set(r(), r(), r() * 3); scene.add(c); }
  cam.position.set(0, 0, 58);
};

export const buildPipes: B = (scene, cam, t) => {
  scene.background = new THREE.Color('#2a1a20');
  paperLights(scene, { keyPos: [-8, 12, 16], keyIntensity: 2.0, fill: '#a06a78', fillIntensity: 0.9, shadow: 6 });
  put(scene, layer(roundedRect(20, 30, 0), paperMat('#3a2128'), 0.1, 0), 0, 0, -3);
  // layered arc: white, pink, gold-beaded, red
  const arcRing = (r1: number, r2: number, a0: number, a1: number, n = 40) => { const p: [number, number][] = []; for (let i = 0; i <= n; i++) { const a = a0 + (a1 - a0) * i / n; p.push([Math.cos(a) * r1, Math.sin(a) * r1]); } for (let i = n; i >= 0; i--) { const a = a0 + (a1 - a0) * i / n; p.push([Math.cos(a) * r2, Math.sin(a) * r2]); } return shapeFromPts(p); };
  const cx = -1, cy = -9;
  put(scene, layer(arcRing(16, 14.6, 0.2, 2.9), patternMat('stripes', '#cfd3d6', '#bfc4c8', 0.4, 'corrugV'), 0.3, 0.02), cx, cy, 0);
  put(scene, layer(arcRing(14.6, 13.8, 0.2, 2.9), paperMat('#e4a08e'), 0.3, 0.02), cx, cy, 0.4);
  put(scene, layer(arcRing(13.8, 12.2, 0.2, 2.9), paperMat('#e2b84a'), 0.3, 0.02), cx, cy, 0.8);
  put(scene, layer(arcRing(12.2, 11.0, 0.2, 2.9), paperMat('#a21f32'), 0.3, 0.02), cx, cy, 1.2);
  for (let i = 0; i < 30; i++) { const a = 0.25 + i * 0.09; put(scene, layer(disc(0.28), paperMat('#e8c050'), 0.12, 0.02), cx + Math.cos(a) * 13, cy + Math.sin(a) * 13, 1.1); }
  put(scene, layer(roundedRect(1.5, 26, 0.3), paperMat('#7a1a28'), 0.3, 0.03), 3, 2, 1.6);
  put(scene, layer(roundedRect(0.9, 26, 0.3), paperMat('#a82438'), 0.1, 0.02), 3, 2, 1.85);
  for (let i = 0; i < 8; i++) put(scene, layer(disc(0.5), paperMat('#f0c443'), 0.15, 0.03), 3, 11 - i * 3.1 + (t % 1) * 3.1, 2.1);
  put(scene, layer(roundedRect(14, 1.5, 0.3), paperMat('#7a1a28'), 0.3, 0.03), -4, -4, 1.7);
  const arrow = shapeFromPts([[0, 0], [1.3, 1.0], [1.3, 0.4], [3.0, 0.4], [3.0, -0.4], [1.3, -0.4], [1.3, -1.0]]);
  put(scene, layer(arrow, paperMat('#7fd38a'), 0.12, 0.02), 0.3, 6.6, 2.2); put(scene, layer(roundedRect(0.28, 2.4, 0.1), paperMat('#7a5a3a'), 0.1, 0), 3.4, 5.6, 2.1);
  // candy-striped gate
  const gate = new THREE.Group(); put(gate, layer(roundedRect(5.2, 0.55, 0.2), paperMat('#f1ebe6'), 0.15, 0.02), 0, 0, 0);
  for (let i = 0; i < 7; i++) put(gate, layer(roundedRect(0.35, 0.55, 0.05), paperMat('#d9453d'), 0.05, 0), -2.2 + i * 0.74, 0, 0.1);
  gate.position.set(-8, 1.2, 2.4); gate.rotation.z = 0.5; scene.add(gate);
  put(scene, layer(roundedRect(0.5, 2.2, 0.1), paperMat('#3a3a40'), 0.2, 0.02), -7, -0.2, 2.2);
  // violet molecules
  const r = rnd(2); for (let i = 0; i < 6; i++) { const x = -9 + r() * 6, y = -9 + r() * 4; const hex = new THREE.Shape(); for (let k = 0; k < 6; k++) { const a = k * Math.PI / 3; k ? hex.lineTo(Math.cos(a) * 0.9, Math.sin(a) * 0.9) : hex.moveTo(Math.cos(a) * 0.9, Math.sin(a) * 0.9); } const h = new THREE.Path(); for (let k = 0; k < 6; k++) { const a = k * Math.PI / 3; k ? h.lineTo(Math.cos(a) * 0.72, Math.sin(a) * 0.72) : h.moveTo(Math.cos(a) * 0.72, Math.sin(a) * 0.72); } hex.holes.push(h); put(scene, layer(hex, paperMat('#8a6fbf'), 0.08, 0), x, y, 2.4).rotation.z = r() * 3; }
  cam.position.set(-2, 0, 64);
};

/** Flame cave with ring of 8 pointing hands (judged). */
export const addPointingHands = (scene: THREE.Scene, cx: number, cy: number, z: number, t: number) => {
  const tones = ['#e7b48f', '#c98a5e', '#8a5a3a', '#f0c7a0', '#b9784c', '#6e4630', '#e1a77d', '#d29b6e'];
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2 + 0.2, R = 5.3 + 0.15 * Math.sin(t * 6 + i * 1.7);
    const h = makeHand(tones[i], i % 3 ? '#5b6270' : '#7a4d3a', i % 2 ? '#c0392b' : undefined);
    h.position.set(cx + Math.cos(a) * R * 0.8, cy + Math.sin(a) * R * 1.05, z); h.rotation.z = a - Math.PI / 2 - Math.PI; h.scale.setScalar(0.72); scene.add(h);
  }
};

export const WORLD: Record<string, B> = {
  belt: buildBelt, breakfast: buildBreakfastPolka, breakfast_stripes: buildBreakfastStripes, breakfast_gingham: buildBreakfastGingham,
  family: buildFamily, town: buildTown, jars: buildJars, pipes: buildPipes,
};
