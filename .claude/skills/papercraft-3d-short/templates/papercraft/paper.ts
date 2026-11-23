// Papercraft building blocks for three.js (r170). 1 unit = 100 px of a 1080x1920 frame => frame = 10.8 x 19.2 units.
// Everything is a stack of thin extruded cut-paper layers with a paper-fibre bump map. No outlines.
import * as THREE from 'three';

export const PAL = {
  // inside the body
  bgMaroon: '#2e1b20', bgMaroon2: '#4c252a', bgPlum: '#2e1823', bgDeep: '#361213',
  crimson: '#a1293c', crimsonHot: '#dd3d48', crimsonLight: '#e85e58', redPaper: '#c23347',
  rose: '#e2ae9d', roseDark: '#b06068', cream: '#eedbaf', sugar: '#eae6e0',
  gold: '#cb9f63', goldBright: '#f3df4f', coilRed: '#8f2a3e', coilDark: '#6f2b37',
  flameCore: '#fafb87', flameBody: '#ffe45c', flameEdge: '#ffb000', spill: '#ff8a3d',
  violet: '#8a6fbf', mint: '#7fd38a',
  // normal world
  mint1: '#bedabf', mint2: '#a6c2a9', shirt: '#dfecee', denim: '#373e53', leather: '#b0754c',
  skin: '#e9a07a', cheek: '#e58a66', hair: '#4a2b22', navy: '#282636',
} as const;

// ---------- procedural textures (Canvas2D) ----------
function mulberry(seed: number) {
  let a = seed >>> 0;
  return () => {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export type PaperKind = 'fibre' | 'corrugH' | 'corrugV' | 'twill';
const texCache = new Map<string, THREE.CanvasTexture>();

/** Greyscale bump texture: fine paper fibres plus optional ribs. White = high. */
export function paperBump(kind: PaperKind = 'fibre', size = 512, repeat = 4): THREE.CanvasTexture {
  const key = `${kind}|${size}|${repeat}`;
  const hit = texCache.get(key);
  if (hit) return hit;
  const c = document.createElement('canvas');
  c.width = c.height = size;
  const g = c.getContext('2d')!;
  const rnd = mulberry(1337);
  g.fillStyle = '#808080';
  g.fillRect(0, 0, size, size);
  // speckle
  const img = g.getImageData(0, 0, size, size);
  for (let i = 0; i < img.data.length; i += 4) {
    const v = 128 + (rnd() - 0.5) * 46;
    img.data[i] = img.data[i + 1] = img.data[i + 2] = v;
  }
  g.putImageData(img, 0, 0);
  // short fibres
  g.globalAlpha = 0.18;
  for (let i = 0; i < size * 5; i++) {
    const x = rnd() * size, y = rnd() * size, a = rnd() * Math.PI, l = 3 + rnd() * 9;
    g.strokeStyle = rnd() > 0.5 ? '#fff' : '#000';
    g.lineWidth = 0.7;
    g.beginPath(); g.moveTo(x, y); g.lineTo(x + Math.cos(a) * l, y + Math.sin(a) * l); g.stroke();
  }
  g.globalAlpha = 1;
  if (kind === 'corrugH' || kind === 'corrugV') {
    const n = 32;
    for (let i = 0; i < n; i++) {
      const p = (i / n) * size;
      const grd = kind === 'corrugH' ? g.createLinearGradient(0, p, 0, p + size / n) : g.createLinearGradient(p, 0, p + size / n, 0);
      grd.addColorStop(0, 'rgba(255,255,255,0.35)');
      grd.addColorStop(0.5, 'rgba(128,128,128,0)');
      grd.addColorStop(1, 'rgba(0,0,0,0.45)');
      g.fillStyle = grd;
      if (kind === 'corrugH') g.fillRect(0, p, size, size / n); else g.fillRect(p, 0, size / n, size);
    }
  }
  if (kind === 'twill') {
    g.globalAlpha = 0.3; g.strokeStyle = '#000'; g.lineWidth = 1.2;
    for (let i = -size; i < size * 2; i += 5) { g.beginPath(); g.moveTo(i, 0); g.lineTo(i + size, size); g.stroke(); }
    g.globalAlpha = 1;
  }
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.repeat.set(repeat, repeat);
  t.colorSpace = THREE.NoColorSpace;
  t.anisotropy = 8;
  texCache.set(key, t);
  return t;
}

export interface PaperOpts {
  kind?: PaperKind; bump?: number; roughness?: number; emissive?: string; emissiveIntensity?: number;
  repeat?: number; transparent?: boolean; opacity?: number;
}

/** Matte paper material. Paper has no specular: roughness 0.95, metalness 0. */
export function paperMat(color: string | THREE.Color, o: PaperOpts = {}): THREE.MeshStandardMaterial {
  const m = new THREE.MeshStandardMaterial({
    color: new THREE.Color(color),
    roughness: o.roughness ?? 0.95,
    metalness: 0,
    bumpMap: paperBump(o.kind ?? 'fibre', 512, o.repeat ?? 4),
    bumpScale: o.bump ?? 0.9,
    transparent: o.transparent ?? false,
    opacity: o.opacity ?? 1,
  });
  if (o.emissive) { m.emissive = new THREE.Color(o.emissive); m.emissiveIntensity = o.emissiveIntensity ?? 1; }
  return m;
}

/** Emissive "light-giving paper" (flames, lit windows, candle tips). Pair with bloom. */
export function glowMat(color: string, intensity = 1.6): THREE.MeshStandardMaterial {
  // base colour kept dark so scene lights do not add on top of the emission (that is what blew flames to white)
  const m = new THREE.MeshStandardMaterial({ color: new THREE.Color(color).multiplyScalar(0.12), roughness: 1, metalness: 0 });
  m.emissive = new THREE.Color(color);
  m.emissiveIntensity = intensity;
  return m;
}

/** The only glossy things: gold buckle, brass keys. */
export function goldMat(color: string = PAL.goldBright): THREE.MeshStandardMaterial {
  // no environment map in the scene, so true metals render black: keep metalness low and add a little emission
  const m = new THREE.MeshStandardMaterial({ color: new THREE.Color(color), roughness: 0.38, metalness: 0.25 });
  m.emissive = new THREE.Color(color).multiplyScalar(0.16);
  return m;
}

// ---------- shapes ----------
export function roundedRect(w: number, h: number, r: number): THREE.Shape {
  const s = new THREE.Shape();
  const x = -w / 2, y = -h / 2;
  r = Math.min(r, w / 2, h / 2);
  s.moveTo(x + r, y);
  s.lineTo(x + w - r, y); s.quadraticCurveTo(x + w, y, x + w, y + r);
  s.lineTo(x + w, y + h - r); s.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  s.lineTo(x + r, y + h); s.quadraticCurveTo(x, y + h, x, y + h - r);
  s.lineTo(x, y + r); s.quadraticCurveTo(x, y, x + r, y);
  return s;
}
export function disc(r: number): THREE.Shape { const s = new THREE.Shape(); s.absarc(0, 0, r, 0, Math.PI * 2, false); return s; }
export function ellipse(rx: number, ry: number): THREE.Shape { const s = new THREE.Shape(); s.absellipse(0, 0, rx, ry, 0, Math.PI * 2, false, 0); return s; }
/** Smooth blob from polar radii (organic cave / organ outlines). */
export function blob(rx: number, ry: number, wobble = 0.08, seed = 3, n = 48): THREE.Shape {
  const rnd = mulberry(seed);
  const ph = [rnd() * 6, rnd() * 6, rnd() * 6];
  const s = new THREE.Shape();
  for (let i = 0; i <= n; i++) {
    const a = (i / n) * Math.PI * 2;
    const k = 1 + wobble * (Math.sin(2 * a + ph[0]) + 0.6 * Math.sin(3 * a + ph[1]) + 0.4 * Math.sin(5 * a + ph[2]));
    const x = Math.cos(a) * rx * k, y = Math.sin(a) * ry * k;
    if (i === 0) s.moveTo(x, y); else s.lineTo(x, y);
  }
  return s;
}

/** Cut a window: `outer` with `inner` punched out (nested cave / frame layers must be rings, not solids, or they hide what is behind). */
export function ring(outer: THREE.Shape, inner: THREE.Shape): THREE.Shape {
  const pts = inner.getPoints(48).reverse();
  outer.holes.push(new THREE.Path(pts));
  return outer;
}

/**
 * One paper layer: extruded shape with a tiny bevel (the lighter cut edge).
 * thickness ~0.10-0.22 units (10-22 px). Casts and receives shadow.
 */
export function layer(shape: THREE.Shape, mat: THREE.Material, thickness = 0.14, bevel = 0.015): THREE.Mesh {
  const geo = new THREE.ExtrudeGeometry(shape, {
    depth: thickness, bevelEnabled: bevel > 0, bevelThickness: bevel, bevelSize: bevel, bevelSegments: 1, curveSegments: 24,
  });
  geo.translate(0, 0, -thickness / 2);
  const m = new THREE.Mesh(geo, mat);
  m.castShadow = true; m.receiveShadow = true;
  return m;
}

/** Add `mesh` to `parent` at depth z (layers in a stack are 0.3-0.8 units apart for visible soft shadows). */
export function put<T extends THREE.Object3D>(parent: THREE.Object3D, mesh: T, x = 0, y = 0, z = 0): T {
  mesh.position.set(x, y, z);
  parent.add(mesh);
  return mesh;
}

// ---------- lights ----------
export interface RigOpts { keyColor?: string; keyIntensity?: number; keyPos?: [number, number, number]; fill?: string; fillIntensity?: number; shadow?: number }
/** Soft key from upper left, shadows fall lower right. Low cool/maroon hemisphere fill. */
export function paperLights(scene: THREE.Scene, o: RigOpts = {}) {
  const key = new THREE.DirectionalLight(o.keyColor ?? '#fff1de', o.keyIntensity ?? 2.2);
  key.position.set(...(o.keyPos ?? [-9, 12, 14]));
  key.castShadow = true;
  key.shadow.mapSize.set(4096, 4096);
  const S = 14; Object.assign(key.shadow.camera, { left: -S, right: S, top: S * 1.8, bottom: -S * 1.8, near: 1, far: 80 });
  key.shadow.radius = o.shadow ?? 6;
  key.shadow.blurSamples = 16;       // VSM: soft penumbra (PCFSoft ignores radius)
  key.shadow.bias = -0.0003;
  key.shadow.normalBias = 0.03;
  scene.add(key); scene.add(key.target);
  const hemi = new THREE.HemisphereLight(o.fill ?? '#7a5a6a', '#2a1419', o.fillIntensity ?? 0.9);
  scene.add(hemi);
  return { key, hemi };
}

/** Warm practical light (flame, candle). Soft falloff, casts shadow only when `shadow` is set (expensive). */
// NOTE: three r155+ uses physical units: lux on a surface = intensity / d^2. At 5 units distance, intensity 20 = 0.8 lux.
export function practical(color = PAL.spill, intensity = 20, distance = 22, decay = 2): THREE.PointLight {
  const l = new THREE.PointLight(new THREE.Color(color), intensity, distance, decay);
  return l;
}
