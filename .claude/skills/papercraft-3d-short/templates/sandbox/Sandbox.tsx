import React, { useEffect, useRef } from 'react';
import { continueRender, delayRender, useCurrentFrame } from 'remotion';
import * as THREE from 'three';
import { PAL, paperMat, glowMat, goldMat, layer, put, roundedRect, disc, ellipse, blob, ring, paperLights, practical } from './papercraft/paper';
import { coilField, coilGeometry, shred } from './papercraft/quilling';
import { makeFlame, makeLogs, makeMan, flicker, setFlameMood, setEyes, setMouth } from './papercraft/characters';
import { WORLD, addPointingHands, patternMat, band } from './papercraft/world';
import { LOOKS, dioramaCamera, makeComposer, makeRenderer } from './papercraft/post';

const W = 1080, H = 1920;
const rnd2 = (seed: number) => { let a = seed >>> 0; return () => { a = (a * 1664525 + 1013904223) >>> 0; return a / 4294967296; }; };

function buildCell(scene: THREE.Scene, cam: THREE.PerspectiveCamera, t: number) {
  scene.background = new THREE.Color(PAL.bgMaroon2);
  paperLights(scene, { keyPos: [-8, 10, 16], keyIntensity: 1.35, shadow: 7, fill: '#8a5a6c', fillIntensity: 0.5 });
  const R = 9.6;
  put(scene, layer(disc(R + 1.2), paperMat('#d98f86'), 0.3), 0, 0, -0.3);               // outer pink rim
  put(scene, layer(disc(R + 0.1), paperMat('#e0b94a'), 0.2), 0, 0, 0.1);               // gold ring bed
  // tiny gold-cream spirals in the ring
  const ringCoil = new THREE.InstancedMesh(coilGeometry(4, 0.3, 0.028, 0.12), paperMat('#ffffff'), 90);
  const m = new THREE.Matrix4(), c = new THREE.Color();
  for (let i = 0; i < 90; i++) { const a = (i / 90) * Math.PI * 2, rr = R - 0.1 + (i % 2) * 0.05; m.makeRotationZ(i); m.setPosition(Math.cos(a) * rr, Math.sin(a) * rr, 0.25); ringCoil.setMatrixAt(i, m); ringCoil.setColorAt(i, c.set(i % 3 ? '#f3ecc8' : '#e8d58a')); }
  ringCoil.castShadow = ringCoil.receiveShadow = true; scene.add(ringCoil);
  put(scene, layer(disc(R - 1.0), paperMat('#efc9bb'), 0.2), 0, 0, 0.4);               // pink tissue plate
  // white dividing walls (5 sectors)
  const wallM = paperMat('#efe9e4');
  for (let i = 0; i < 5; i++) {                                   // curved pinwheel walls
    const pts: [number, number][] = [];
    for (let k = 0; k <= 24; k++) { const u = k / 24, r = 1.5 + u * (R - 2.5), a = (i / 5) * Math.PI * 2 + 0.3 + 0.55 * u; pts.push([Math.cos(a) * r, Math.sin(a) * r]); }
    put(scene, layer(band(pts, 0.24), wallM, 0.7, 0.02), 0, 0, 0.8);
  }
  // inner white ring wall
  const ring = new THREE.Shape(); ring.absarc(0, 0, R - 0.9, 0, Math.PI * 2, false); const hole = new THREE.Path(); hole.absarc(0, 0, R - 1.2, 0, Math.PI * 2, true); ring.holes.push(hole);
  put(scene, layer(ring, wallM, 0.7, 0.02), 0, 0, 0.8);
  // coils
  const field = coilField({ size: 0.5, bounds: [R, R], area: (x, y) => { const r = Math.hypot(x, y); return r < R - 1.5 && r > 2.2; }, seed: 11, color: '#b8344f' });
  field.position.z = 0.5; scene.add(field);
  // centre coil + gold disc
  const cc = new THREE.Mesh(coilGeometry(8, 1.9, 0.12, 0.3, 40), paperMat('#f0ece8')); cc.castShadow = cc.receiveShadow = true; cc.position.z = 0.7; scene.add(cc);
  put(scene, layer(disc(1.05), paperMat('#f0b83a'), 0.25), 0, 0, 0.8);
  // red + blue ring "holes"
  for (const [x, y, col] of [[2.6, -5.2, '#b32a3a'], [4.3, -5.8, '#4a3f9a']] as const) {
    const r = new THREE.Shape(); r.absarc(0, 0, 0.7, 0, Math.PI * 2, false); const h2 = new THREE.Path(); h2.absarc(0, 0, 0.5, 0, Math.PI * 2, true); r.holes.push(h2);
    put(scene, layer(r, paperMat(col), 0.5, 0.01), x, y, 0.8);
    put(scene, layer(disc(0.52), paperMat('#2a1419'), 0.05, 0), x, y, 0.55);
  }
  // foreground shreds (blurred by DOF)
  const s1 = shred(7, 0.7, 1.2, '#d9b3b0', 2); s1.position.set(-6, 7, 3.2); s1.rotation.set(1.2, 0, -0.5); scene.add(s1);
  cam.position.set(0, -2 - t * 0.3, 52); cam.lookAt(0, -2 - t * 0.3, 0);
  // glow sparks: a warm light near a few coils
  const p = practical('#ff8a3d', 9, 12, 2); p.position.set(4, -5, 2.2); scene.add(p);
}

let HANDS = false;
function buildCave(scene: THREE.Scene, cam: THREE.PerspectiveCamera, t: number) {
  scene.background = new THREE.Color(PAL.bgPlum);
  const L = paperLights(scene, { keyIntensity: 0.35, fillIntensity: HANDS ? 0.7 : 0.25, keyColor: '#caa7b8' });
  const cols = ['#3b2230', '#42243a', '#4c2a40', '#552d4a', '#2e1b25'];
  for (let i = 0; i < 5; i++) {
    const sc = 1 - i * 0.17, nx = 1 - (i + 1) * 0.17;
    const outer = blob(5.0 * sc, 8.2 * sc, 0.06, 4 + i), inner = blob(5.0 * nx, 8.2 * nx, 0.06, 5 + i);
    const x = 0.6 + i * 0.25, z = -2.4 + i * 0.7;
    put(scene, layer(i < 4 ? ring(outer, inner) : outer, paperMat(i % 2 ? '#3a1f2c' : '#4a2236'), 0.3, 0.02), x, -0.3, z);
    put(scene, layer(i < 4 ? ring(blob(5.12 * sc, 8.32 * sc, 0.06, 4 + i), blob(5.0 * sc, 8.2 * sc, 0.06, 4 + i)) : blob(0.1,0.1), paperMat('#a0426e'), 0.12, 0.01), x, -0.3, z + 0.17);
  }
  void cols;
  put(scene, layer(ellipse(4.4, 1.5), paperMat('#a02a55'), 0.3, 0.02), 0.9, -3.4, 0.9);
  put(scene, layer(ellipse(3.6, 1.1), paperMat('#c23a66'), 0.2, 0.02), 0.9, -3.3, 1.1);
  const logs = makeLogs(1); logs.position.set(0.9, -2.6, 1.9); scene.add(logs);
  const f = makeFlame(5.2); f.position.set(0.9, -2.3, 1.3); scene.add(f);
  setFlameMood(f, 'happy'); flicker(f, t, 1);
  // glowing arched door
  const door = new THREE.Shape(); door.moveTo(-1.2, -2); door.lineTo(-1.2, 1.2); door.absarc(0, 1.2, 1.2, Math.PI, 0, true); door.lineTo(1.2, -2); door.lineTo(-1.2, -2);
  put(scene, layer(door, glowMat('#fff6ea', 1.3), 0.2, 0.02), -7.8, -1.0, -0.2);
  const dl = practical('#ffd9b0', 10, 20, 2); dl.position.set(-6.8, -0.8, 2.6); scene.add(dl);
  if (HANDS) addPointingHands(scene, 0.9, -1.5, 2.4, t);
  cam.position.set(0, 0, 47);
}

function buildParty(scene: THREE.Scene, cam: THREE.PerspectiveCamera, t: number) {
  scene.background = new THREE.Color('#0f1118');
  paperLights(scene, { keyIntensity: 0.25, keyColor: '#9fb4e0', fillIntensity: 0.55, fill: '#4a5a80' });
  put(scene, layer(roundedRect(24, 32, 0), patternMat('curtain', '#161b2a', '#000', 4), 0.2, 0), 0, 0, -4);
  const bunt = ['#c9423b', '#4f7fb8', '#e0b84a', '#8a5fb8', '#5aa878'];
  for (let i = 0; i < 9; i++) { const x = -6 + i * 1.5, y = 7.6 - 0.9 * Math.sin((i / 8) * Math.PI); const tr = new THREE.Shape(); tr.moveTo(-0.6, 0); tr.lineTo(0.6, 0); tr.lineTo(0, -1.2); tr.lineTo(-0.6, 0); put(scene, layer(tr, paperMat(bunt[i % 5], { emissive: bunt[i % 5], emissiveIntensity: 0.25 }), 0.05, 0), x, y, -2.5); }
  const man = makeMan({ party: true }); man.position.set(0, 3.0, 0); man.scale.setScalar(0.8); scene.add(man);
  const cr = rnd2(3); for (let i = 0; i < 28; i++) put(scene, layer(disc(0.12 + cr() * 0.08), paperMat(bunt[i % 5]), 0.03, 0), -5 + cr() * 10, -5 + cr() * 12, 1.5);
  put(scene, layer(roundedRect(14, 4.2, 0), patternMat('gingham', '#f1b9a4', '#d9553f', 2), 0.3, 0), 0, -9.0, 0.6);
  setEyes(man, 'closed'); setMouth(man, 'o');
  // balloons
  for (const [x, y, col] of [[-4.3, 2.6, '#c93a3a'], [4.2, 5.4, '#c7b53a'], [4.6, 1.4, '#d44f8a']] as const) put(scene, layer(ellipse(1.3, 1.6), paperMat(col), 0.3, 0.03), x, y, -2.0);
  // cake
  const cake = new THREE.Group(); scene.add(cake); cake.position.set(0, -5.2, 1.4);
  put(cake, layer(roundedRect(7.2, 3.6, 0.3), paperMat('#f0a66a'), 0.8, 0.03), 0, 0, 0);
  put(cake, layer(roundedRect(7.2, 0.6, 0.1), paperMat('#e0533a'), 0.1, 0.01), 0, -0.2, 0.46);
  put(cake, layer(roundedRect(7.5, 0.9, 0.35), paperMat('#fbe9c9'), 0.6, 0.02), 0, 1.7, 0.1);
  const flames = new THREE.Group(); cake.add(flames);
  const stripe = ['#e56a5a', '#f1c24d', '#78b88a', '#e58bb0'];
  for (let r = 0; r < 3; r++) for (let i = 0; i < 12; i++) {
    const x = -3.4 + i * 0.62 + (r % 2) * 0.3, y = 2.5 + r * 0.55;
    put(cake, layer(roundedRect(0.16, 1.5, 0.05), paperMat(stripe[(i + r) % 4]), 0.1, 0), x, y, 0.5 - r * 0.15);
    const fl = layer(ellipse(0.2, 0.32), glowMat('#ffd84a', 1.25), 0.1, 0.01); fl.scale.y = 1 + 0.15 * Math.sin(t * 30 + i * 2 + r); put(cake, fl, x, y + 1.0, 0.55 - r * 0.15);
  }
  const l1 = practical('#ff9a3d', 30, 30, 2); l1.position.set(0, -3.0, 6.5); scene.add(l1);
  const l2 = practical('#ff8a30', 70, 30, 2); l2.position.set(0, -1.0, 7.0); scene.add(l2);
  cam.position.set(0, 0, 47);
}

export const Sandbox: React.FC<{ scene: string; look?: 'dark' | 'inside' | 'day'; dof?: boolean }> = ({ scene: which, look, dof }) => {
  const ref = useRef<HTMLCanvasElement>(null);
  const frame = useCurrentFrame();
  useEffect(() => {
    const handle = delayRender('three');
    try {
      const canvas = ref.current!;
      const renderer = makeRenderer(canvas, W, H);
      const scene = new THREE.Scene();
      const cam = dioramaCamera(W / H, 19.2, 24);
      const t = frame / 30;
      HANDS = which === 'cave_hands';
      if (WORLD[which]) WORLD[which](scene, cam, t); else if (which === 'cell') buildCell(scene, cam, t); else if (which.startsWith('cave')) buildCave(scene, cam, t); else buildParty(scene, cam, t);
      const dayScenes = ['belt', 'breakfast', 'breakfast_stripes', 'breakfast_gingham'];
      const lk = { ...LOOKS[look ?? (dayScenes.includes(which) ? 'day' : ['cell', 'town', 'jars', 'pipes'].includes(which) ? 'inside' : 'dark')] };
      if (dof) lk.dof = { focus: which === 'cell' ? 52 : 47, aperture: which === 'cell' ? 0.0007 : which === 'family' ? 0.0009 : 0.0003, maxblur: 0.012 };
      const { composer, setTime } = makeComposer(renderer, scene, cam, W, H, lk);
      setTime(frame / 30);
      composer.render();
      renderer.dispose();
    } finally { continueRender(handle); }
  }, [frame, which, look, dof]);
  return <canvas ref={ref} width={W} height={H} style={{ width: W, height: H }} />;
};
