// Quilled-paper coils: a strip of paper rolled in a flat spiral. The hero texture of the cell macro shots.
import * as THREE from 'three';
import { paperMat } from './paper';

/** Spiral band polygon (outer edge out, inner edge back) extruded into a coil of height `h`. */
export function coilGeometry(turns = 7, radius = 0.55, strip = 0.035, h = 0.16, seg = 18): THREE.ExtrudeGeometry {
  // Archimedean spiral r(a) = r0 + pitch * a ; pitch chosen so the last turn reaches `radius`.
  const r0 = 0.05;
  const pitch = (radius - strip - r0) / (turns * Math.PI * 2);
  const steps = Math.floor(turns * seg);
  const outer: THREE.Vector2[] = [];
  const inner: THREE.Vector2[] = [];
  for (let i = 0; i <= steps; i++) {
    const a = (i / steps) * turns * Math.PI * 2;
    const r = r0 + pitch * a;
    outer.push(new THREE.Vector2(Math.cos(a) * (r + strip), Math.sin(a) * (r + strip)));
    inner.push(new THREE.Vector2(Math.cos(a) * r, Math.sin(a) * r));
  }
  // The pitch is smaller than the strip gap, so adjacent turns do not touch: band stays a simple polygon.
  const s = new THREE.Shape([...outer, ...inner.reverse()]);
  const g = new THREE.ExtrudeGeometry(s, { depth: h, bevelEnabled: false, curveSegments: 1 });
  g.translate(0, 0, -h / 2);
  return g;
}

export interface CoilFieldOpts {
  count?: number; area?: (x: number, y: number) => boolean; // keep point if true
  size?: number; spacing?: number; color?: string; seed?: number; turns?: number; hVar?: number;
  bounds?: [number, number]; // half extents
}

/** Packed field of coils on a plane (instanced). Colour/height/rotation jitter like hand-made quilling. */
export function coilField(o: CoilFieldOpts = {}): THREE.InstancedMesh {
  const size = o.size ?? 0.52;
  const sp = o.spacing ?? size * 2.05;
  const [bx, by] = o.bounds ?? [5.5, 9.5];
  const keep = o.area ?? (() => true);
  let a = (o.seed ?? 7) >>> 0;
  const rnd = () => { a = (a * 1664525 + 1013904223) >>> 0; return a / 4294967296; };
  const pts: [number, number][] = [];
  const rowH = sp * 0.866;
  for (let j = 0, y = -by; y <= by; y += rowH, j++) {
    for (let x = -bx + (j % 2 ? sp / 2 : 0); x <= bx; x += sp) {
      const px = x + (rnd() - 0.5) * sp * 0.22, py = y + (rnd() - 0.5) * sp * 0.22;
      if (keep(px, py) && rnd() > 0.1) pts.push([px, py]);
    }
  }
  const n = Math.min(pts.length, o.count ?? 4000);
  const geo = coilGeometry(o.turns ?? 8, size, 0.03, 0.2);
  const mat = paperMat('#ffffff', { bump: 0.6 });
  const mesh = new THREE.InstancedMesh(geo, mat, n);
  mesh.castShadow = true; mesh.receiveShadow = true;
  const m = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler(), sc = new THREE.Vector3(), p = new THREE.Vector3();
  const base = new THREE.Color(o.color ?? '#8f2a3e'), c = new THREE.Color();
  for (let i = 0; i < n; i++) {
    const s = 0.82 + rnd() * 0.3, hh = 0.7 + rnd() * (o.hVar ?? 0.9);
    e.set((rnd() - 0.5) * 0.05, (rnd() - 0.5) * 0.05, rnd() * Math.PI * 2);
    q.setFromEuler(e); sc.set(s, s, hh); p.set(pts[i][0], pts[i][1], 0.1 * hh);
    m.compose(p, q, sc); mesh.setMatrixAt(i, m);
    // value + slight hue jitter; a few darker "empty" coils
    const dark = rnd() < 0.08 ? 0.55 : 0.82 + rnd() * 0.3;
    c.copy(base).offsetHSL((rnd() - 0.5) * 0.015, (rnd() - 0.5) * 0.08, 0).multiplyScalar(dark);
    mesh.setColorAt(i, c);
  }
  mesh.instanceMatrix.needsUpdate = true;
  if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
  return mesh;
}

/** Curly paper shred (ribbon along a curl), for foreground flutter and the "unspooling" gag. */
export function shred(len = 4, width = 0.18, curl = 2.2, color = '#8f2a3e', seed = 1): THREE.Mesh {
  const pts: THREE.Vector3[] = [];
  const n = 40;
  for (let i = 0; i < n; i++) {
    const t = i / (n - 1);
    const a = t * curl * Math.PI * 2;
    pts.push(new THREE.Vector3(t * len + Math.cos(a) * 0.5 * t, Math.sin(a) * 0.5 * t, Math.sin(a * 0.5 + seed) * 0.4));
  }
  const curve = new THREE.CatmullRomCurve3(pts);
  const pos: number[] = [], idx: number[] = [];
  const f = curve.computeFrenetFrames(n * 2, false);
  for (let i = 0; i <= n * 2; i++) {
    const t = i / (n * 2), p = curve.getPoint(t), b = f.binormals[i];
    pos.push(p.x - b.x * width / 2, p.y - b.y * width / 2, p.z - b.z * width / 2, p.x + b.x * width / 2, p.y + b.y * width / 2, p.z + b.z * width / 2);
    if (i < n * 2) { const k = i * 2; idx.push(k, k + 1, k + 2, k + 1, k + 3, k + 2); }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setIndex(idx); g.computeVertexNormals();
  const m = paperMat(color, { bump: 0.4 });
  m.side = THREE.DoubleSide;
  const mesh = new THREE.Mesh(g, m);
  mesh.castShadow = true; mesh.receiveShadow = true;
  return mesh;
}
