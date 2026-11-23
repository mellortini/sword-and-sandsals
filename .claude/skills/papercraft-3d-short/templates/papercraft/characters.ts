// Paper characters: the flame hero, the deadpan man, logs. Built from flat layers, faces are swappable layers (no morphing).
import * as THREE from 'three';
import { PAL, paperMat, glowMat, layer, put, roundedRect, disc, ellipse, blob } from './paper';

// ---------------- flame hero ----------------
export const FLAME_LIGHT = 26;
export function teardrop(w: number, h: number): THREE.Shape {
  const s = new THREE.Shape();
  s.moveTo(0, h);                                         // tip
  s.bezierCurveTo(w * 0.15, h * 0.62, w * 0.62, h * 0.42, w * 0.5, h * 0.16);
  s.bezierCurveTo(w * 0.42, -h * 0.04, w * 0.18, 0, 0, 0);
  s.bezierCurveTo(-w * 0.18, 0, -w * 0.42, -h * 0.04, -w * 0.5, h * 0.16);
  s.bezierCurveTo(-w * 0.62, h * 0.42, -w * 0.15, h * 0.62, 0, h);
  return s;
}

export type FlameMood = 'worried' | 'happy' | 'surprised' | 'neutral';
export interface Flame extends THREE.Group { userData: { eyes: THREE.Group[]; mouths: Record<string, THREE.Object3D>; outer: THREE.Mesh; inner: THREE.Mesh; light: THREE.PointLight; mood: FlameMood } }

export function makeFlame(size = 4): Flame {
  const g = new THREE.Group() as Flame;
  const outer = layer(teardrop(size * 0.78, size), glowMat(PAL.flameBody, 0.95), 0.12, 0.02)   // keep emissive <= ~1.0: ACES + bloom push anything higher to white;
  const inner = layer(teardrop(size * 0.5, size * 0.62), glowMat(PAL.flameCore, 1.15), 0.1, 0.02);
  put(g, outer, 0, 0, 0); put(g, inner, 0, size * 0.04, 0.12);
  // eyes: two orange-brown discs with white highlight
  const eyes: THREE.Group[] = [];
  for (const sx of [-1, 1]) {
    const e = new THREE.Group();
    put(e, layer(disc(size * 0.075), paperMat('#d66f3a'), 0.04, 0), 0, 0, 0);
    put(e, layer(disc(size * 0.03), glowMat('#ffffff', 1.2), 0.02, 0), -size * 0.02 * sx, size * 0.025, 0.04);
    put(g, e, sx * size * 0.17, size * 0.32, 0.3); eyes.push(e);
  }
  // mouths (swap by visibility)
  const mouths: Record<string, THREE.Object3D> = {};
  const mk = (name: string, mesh: THREE.Object3D) => { mesh.visible = false; put(g, mesh, 0, size * 0.19, 0.3); mouths[name] = mesh; };
  mk('o', layer(ellipse(size * 0.035, size * 0.05), glowMat('#ffffff', 1.4), 0.03, 0));
  const smile = new THREE.Shape(); smile.absarc(0, 0, size * 0.08, Math.PI * 1.15, Math.PI * 1.85, false); smile.absarc(0, size * 0.012, size * 0.075, Math.PI * 1.85, Math.PI * 1.15, true);
  mk('smile', layer(smile, paperMat('#d66f3a'), 0.03, 0));
  mk('flat', layer(roundedRect(size * 0.08, size * 0.012, size * 0.006), paperMat('#d66f3a'), 0.03, 0));
  mouths.o.visible = true;
  const light = new THREE.PointLight(new THREE.Color(PAL.spill), FLAME_LIGHT, 30, 1.6);   // candela: I/d^2 lux, keep ~1-3 lux on nearby paper
  light.position.set(0, size * 0.4, 4.5);
  g.add(light);
  g.userData = { eyes, mouths, outer, inner, light, mood: 'neutral' };
  return g;
}

/** Flicker: wobble the silhouette scale + light intensity. Call every frame with time in seconds. */
export function flicker(f: Flame, t: number, amount = 1) {
  const w = 1 + amount * (0.035 * Math.sin(t * 38) + 0.025 * Math.sin(t * 23 + 1.3));
  const h = 1 + amount * (0.05 * Math.sin(t * 31 + 0.4) + 0.03 * Math.sin(t * 17));
  f.userData.outer.scale.set(w, h, 1);
  f.userData.inner.scale.set(1 / w, 1 + (h - 1) * 0.6, 1);
  f.userData.light.intensity = FLAME_LIGHT * (1 + amount * 0.12 * Math.sin(t * 29 + 2));
}

export function setFlameMood(f: Flame, mood: FlameMood) {
  const { mouths } = f.userData;
  for (const k of Object.keys(mouths)) mouths[k].visible = false;
  mouths[mood === 'happy' ? 'smile' : mood === 'worried' ? 'flat' : 'o'].visible = true;
  f.userData.mood = mood;
}

// ---------------- logs on a round pedestal ----------------
export function makeLogs(scale = 1): THREE.Group {
  const g = new THREE.Group();
  const bark = paperMat('#d98a4e', { kind: 'corrugH', bump: 1.2 });
  const ring = paperMat('#f1d9a2');
  for (const [rz, x, y] of [[0.22, -0.2, 0], [-0.22, 0.15, 0.25]] as const) {
    const log = new THREE.Group();
    const body = new THREE.Mesh(new THREE.CylinderGeometry(0.5, 0.5, 3.1, 28), bark);
    body.rotation.z = Math.PI / 2; body.castShadow = body.receiveShadow = true; log.add(body);
    for (const sx of [-1, 1]) {
      const cap = new THREE.Mesh(new THREE.CylinderGeometry(0.46, 0.46, 0.06, 28), ring);
      cap.rotation.z = Math.PI / 2; cap.position.x = sx * 1.54; log.add(cap);
    }
    log.rotation.z = rz; log.position.set(x, y, 0); g.add(log);
  }
  g.scale.setScalar(scale);
  return g;
}

// ---------------- deadpan paper man ----------------
export type EyeState = 'open' | 'half' | 'closed' | 'wide';
export interface Man extends THREE.Group { userData: { eyes: Record<EyeState, THREE.Object3D>[]; pupils: THREE.Object3D[]; mouth: Record<string, THREE.Object3D>; head: THREE.Group } }

export interface ManOpts { shirt?: string; party?: boolean; mustache?: boolean; hair?: string; glasses?: boolean; bun?: boolean; side?: boolean; skin?: string; bald?: boolean }
export function makeMan(opts: ManOpts = {}): Man {
  const g = new THREE.Group() as Man;
  const skin = paperMat(opts.skin ?? PAL.skin), hairM = paperMat(opts.hair ?? PAL.hair), cheekM = paperMat(PAL.cheek);
  // torso (corrugated cardigan)
  const torso = layer(roundedRect(8.4, 6.2, 1.4), paperMat(opts.shirt ?? '#5a5f78', { kind: 'corrugH', repeat: 6, bump: 1.1 }), 0.3, 0.03);
  put(g, torso, 0, -4.6, -0.4);
  const head = new THREE.Group(); g.add(head);
  put(head, layer(roundedRect(5.7, 5.8, 1.9), skin, 0.45, 0.03), 0, 0, 0);
  // hair cap (behind + top fringe)
  if (!opts.bald) {
    put(head, layer(roundedRect(6.1, 3.2, 1.5), hairM, 0.5, 0.03), 0, 2.15, -0.12);
    put(head, layer(roundedRect(5.8, 1.5, 0.7), hairM, 0.3, 0.03), 0, 2.45, 0.25);
  }
  if (opts.side) for (const sx of [-1, 1]) put(head, layer(roundedRect(1.5, 6.2, 0.7), hairM, 0.4, 0.03), sx * 3.1, -0.6, -0.1);
  if (opts.bun) put(head, layer(disc(1.5), hairM, 0.5, 0.03), 0, 4.4, -0.2);
  // ears
  for (const sx of [-1, 1]) put(head, layer(ellipse(0.5, 0.75), skin, 0.2, 0.02), sx * 3.0, 0.1, -0.1);
  // cheeks
  for (const sx of [-1, 1]) put(head, layer(disc(0.95), cheekM, 0.12, 0.01), sx * 2.2, -1.05, 0.3);
  // nose
  put(head, layer(blob(0.62, 0.95, 0.04, 5), skin, 0.4, 0.04), 0, -0.2, 0.45);
  // mustache: thick crescent
  const must = new THREE.Shape();
  must.moveTo(-2.3, -1.45); must.bezierCurveTo(-1.7, -0.25, -0.6, -0.3, 0, -0.5);
  must.bezierCurveTo(0.6, -0.3, 1.7, -0.25, 2.3, -1.45); must.bezierCurveTo(1.5, -1.25, 1.0, -1.0, 0, -1.05);
  must.bezierCurveTo(-1.0, -1.0, -1.5, -1.25, -2.3, -1.45);
  if (opts.mustache !== false) put(head, layer(must, hairM, 0.4, 0.03), 0, -0.45, 0.62);
  // eyes: socket + selectable lids/pupils
  const eyeSets: Record<EyeState, THREE.Object3D>[] = [];
  const pupils: THREE.Object3D[] = [];
  const white = paperMat('#f4efe6');
  for (const sx of [-1, 1]) {
    const e = new THREE.Group(); put(head, e, sx * 1.35, 1.05, 0.3);
    put(e, layer(disc(0.78), paperMat('#e49a74'), 0.06, 0), 0, 0, 0);
    const sclera = layer(disc(0.55), white, 0.08, 0.01); put(e, sclera, 0, 0, 0.1);
    const pupil = layer(disc(0.24), paperMat('#1b1313'), 0.05, 0); put(e, pupil, 0, 0, 0.2); pupils.push(pupil);
    const lidHalf = layer(roundedRect(1.5, 0.82, 0.4), skin, 0.12, 0.01); put(e, lidHalf, 0, 0.3, 0.3);
    const lidShut = layer(roundedRect(1.5, 1.6, 0.6), skin, 0.12, 0.01); put(e, lidShut, 0, 0, 0.3);
    const arc = new THREE.Shape(); arc.absarc(0, -0.2, 0.5, Math.PI * 0.15, Math.PI * 0.85, false); arc.absarc(0, -0.12, 0.47, Math.PI * 0.85, Math.PI * 0.15, true);
    const shutLine = layer(arc, paperMat('#1b1313'), 0.05, 0); put(e, shutLine, 0, 0, 0.4);
    const set = { open: sclera, half: lidHalf, closed: lidShut, wide: sclera } as Record<EyeState, THREE.Object3D>;
    eyeSets.push(set);
    e.userData = { sclera, pupil, lidHalf, lidShut, shutLine };
    lidHalf.visible = false; lidShut.visible = false; shutLine.visible = false;
    if (opts.glasses) { const gl = new THREE.Shape(); gl.absarc(0, 0, 0.95, 0, Math.PI * 2, false); const gh = new THREE.Path(); gh.absarc(0, 0, 0.8, 0, Math.PI * 2, true); gl.holes.push(gh); put(e, layer(gl, paperMat('#5a4a52'), 0.1, 0.01), 0, 0, 0.5); }
    // brow
    put(head, layer(roundedRect(1.7, 0.45, 0.2), hairM, 0.2, 0.02), sx * 1.4, 2.15, 0.3).rotation.z = sx * -0.06;
  }
  // mouth states
  const mouth: Record<string, THREE.Object3D> = {};
  const mouthO = new THREE.Group();
  put(mouthO, layer(ellipse(0.38, 0.5), paperMat('#e49a74'), 0.05, 0), 0, 0, 0);
  put(mouthO, layer(ellipse(0.26, 0.38), paperMat('#4a1f1f'), 0.05, 0), 0, 0, 0.06);
  put(head, mouthO, 0, -2.15, 0.35); mouthO.visible = false; mouth.o = mouthO;
  const flat = layer(roundedRect(1.1, 0.13, 0.06), paperMat('#7a3b30'), 0.05, 0); put(head, flat, 0, -2.15, 0.35); mouth.flat = flat;
  g.userData = { eyes: eyeSets, pupils, mouth, head };
  if (opts.party) {
    const hat = new THREE.Shape(); hat.moveTo(-1.2, 0); hat.lineTo(1.2, 0); hat.lineTo(0.1, 3.4); hat.lineTo(-1.2, 0);
    const hm = layer(hat, paperMat('#e8dcd0'), 0.2, 0.02); put(head, hm, 0.6, 3.7, 0.7).rotation.z = -0.12;
    for (let i = 0; i < 4; i++) { const stripe = layer(roundedRect(0.35, 3.2, 0.1), paperMat('#c9423b'), 0.04, 0); put(hm, stripe, -0.7 + i * 0.5, 1.5, 0.12).rotation.z = 0.28; }
  }
  return g;
}

export function setEyes(m: Man, st: EyeState, look: [number, number] = [0, 0]) {
  const heads = m.userData.head.children.filter((c) => c.userData && c.userData.lidHalf);
  for (const e of heads) {
    const u = e.userData as any;
    u.lidHalf.visible = st === 'half'; u.lidShut.visible = st === 'closed'; u.shutLine.visible = st === 'closed';
    u.sclera.scale.setScalar(st === 'wide' ? 1.25 : 1);
    u.pupil.position.set(look[0] * 0.2, look[1] * 0.2, 0.2);
    u.pupil.visible = st !== 'closed';
  }
}
export function setMouth(m: Man, st: 'o' | 'flat') {
  m.userData.mouth.o.visible = st === 'o'; m.userData.mouth.flat.visible = st === 'flat';
}

// ---------------- hands ----------------
/** Blocky paper hand pointing along +Y (rotate the group to aim). Built from 3-4 layered rounded blocks + cuff. */
export function makeHand(skin: string = PAL.skin, cuff = '#4a5568', nail?: string): THREE.Group {
  const g = new THREE.Group(); const sk = paperMat(skin);
  put(g, layer(roundedRect(1.9, 1.7, 0.55), sk, 0.3, 0.02), 0, 0, 0);
  put(g, layer(roundedRect(0.6, 2.6, 0.3), sk, 0.3, 0.02), 0.15, 1.9, 0.05);          // index finger
  for (const x of [-0.7, -0.25]) put(g, layer(roundedRect(0.45, 0.8, 0.2), paperMat(skin), 0.25, 0.02), x, 0.7, 0.2); // curled fingers
  put(g, layer(roundedRect(0.5, 0.9, 0.2), sk, 0.25, 0.02), -0.95, -0.1, 0.15);         // thumb
  put(g, layer(roundedRect(2.0, 1.1, 0.15), paperMat(cuff), 0.35, 0.02), 0, -1.5, 0.02); // cuff
  if (nail) put(g, layer(roundedRect(0.34, 0.45, 0.12), paperMat(nail), 0.05, 0), 0.15, 3.0, 0.22);
  return g;
}

// ---------------- full figure holding a candle (family line-up) ----------------
export interface FigureOpts extends ManOpts { pants?: string; glow?: string; sit?: boolean; candle?: boolean }
export function makeFigure(o: FigureOpts = {}): THREE.Group {
  const g = new THREE.Group();
  g.add(makeMan(o));
  if (!o.sit) for (const sx of [-1, 1]) {
    put(g, layer(roundedRect(2.7, 8.6, 0.5), paperMat(o.pants ?? PAL.denim, { kind: 'twill', bump: 0.7 }), 0.35, 0.02), sx * 1.9, -11.9, -0.5);
    put(g, layer(roundedRect(3.1, 1.2, 0.55), paperMat('#7a4a32'), 0.4, 0.02), sx * 2.0, -16.5, -0.3);
  }
  if (o.candle !== false) {
    const stripe = paperMat('#efe0d8');
    put(g, layer(roundedRect(0.5, 2.8, 0.12), stripe, 0.15, 0.01), 0, -5.1, 0.85);
    for (let i = 0; i < 3; i++) put(g, layer(roundedRect(0.5, 0.35, 0.05), paperMat('#d9453d'), 0.05, 0), 0, -4.4 - i * 0.85, 1.02).rotation.z = 0.5;
    const fl = layer(teardrop(0.95, 1.7), glowMat(PAL.flameBody, 1.0), 0.1, 0.01); put(g, fl, 0, -3.65, 0.9);
    put(g, layer(teardrop(0.5, 0.95), glowMat(PAL.flameCore, 1.15), 0.08, 0.01), 0, -3.62, 1.0);
    put(g, layer(roundedRect(2.0, 1.6, 0.6), paperMat(o.skin ?? PAL.skin), 0.35, 0.02), 0, -6.3, 1.0);
    const l = new THREE.PointLight(new THREE.Color(o.glow ?? PAL.spill), 9, 40, 2); l.position.set(0, -3.5, 7); g.add(l);   // inside a scaled group the distances shrink but intensities do not: ~9 at scale 0.32
  }
  return g;
}
