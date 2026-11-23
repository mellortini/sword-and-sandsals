import { Application, Assets, Container, Graphics, Sprite, Text, Texture } from 'pixi.js';
import { DEFAULT_LOOK, EQUIP_SLOTS, Kit, Look, PaperRig, Pose, patchShadowBlend } from './rig/PaperRig';
import { ITEMS, SET_BONUS, item } from './data/equipment';
import { Animator, FPS } from './anim/Animator';
import { bakeAll } from './anim/clips';
import { sample } from './anim/clip';
import { BlockShield, DamageSplat, FxLayer } from './ui/fx';

const W = 1920, H = 1080;
const UNIT = 38;
const FEET_Y = 890;
const PELVIS_ABOVE_FEET = 5.2;
const params = new URLSearchParams(location.search);
const VIEW = params.get('view') ?? 'arena';

function groundShadowTexture(): Texture {
  const c = document.createElement('canvas');
  c.width = 256; c.height = 64;
  const g = c.getContext('2d')!;
  const grd = g.createRadialGradient(128, 32, 4, 128, 32, 124);
  grd.addColorStop(0, 'rgba(255,255,255,0.75)');
  grd.addColorStop(0.55, 'rgba(255,255,255,0.35)');
  grd.addColorStop(1, 'rgba(255,255,255,0)');
  g.setTransform(1, 0, 0, 0.25, 0, 24);
  g.fillStyle = grd;
  g.fillRect(0, -100, 256, 300);
  return Texture.from(c);
}

function idle(base: Pose, t: number, phase = 0): Pose {
  const s = Math.sin((t + phase) * Math.PI);
  const s2 = Math.sin((t + phase) * Math.PI + 0.9);
  return {
    ...base,
    torso: (base.torso ?? 0) + 1.4 * s, head: (base.head ?? 0) - 1.0 * s2,
    arm_f_up: (base.arm_f_up ?? 0) + 2.0 * s2, arm_f_lo: (base.arm_f_lo ?? 0) + 1.5 * s, weapon: (base.weapon ?? 0) - 2.5 * s2,
    arm_b_up: (base.arm_b_up ?? 0) - 1.6 * s, arm_b_lo: (base.arm_b_lo ?? 0) + 2.0 * s2,
  };
}

const rnd = (n: number) => Math.floor(Math.random() * n);
function randomLook(tier?: number): Look {
  const t = tier ?? 1 + rnd(10);
  const L: Look = { ...DEFAULT_LOOK, skin: rnd(10), face: rnd(10), hair: rnd(10), hairColor: rnd(10), beard: rnd(10) };
  for (const s of EQUIP_SLOTS) L[s] = Math.random() < 0.85 ? t : 0;
  return L;
}

const label = (s: string, x: number, y: number, size = 28, color = '#f3e6d6') => {
  const t = new Text({ text: s, style: { fill: color, fontSize: size, fontFamily: 'Georgia', align: 'center' } });
  t.anchor.set(0.5, 0);
  t.position.set(x, y);
  return t;
};

async function main() {
  const app = new Application();
  await app.init({ width: W, height: H, background: '#2e1b20', antialias: true, preference: 'webgl', resolution: Math.min(2, window.devicePixelRatio || 1), autoDensity: true });
  document.getElementById('stage')!.appendChild(app.canvas);
  patchShadowBlend(app.renderer);

  const world = new Container();
  app.stage.addChild(world);
  const fit = () => {
    const s = Math.min(window.innerWidth / W, window.innerHeight / H);
    app.renderer.resize(window.innerWidth, window.innerHeight);
    world.scale.set(s);
    world.position.set((window.innerWidth - W * s) / 2, (window.innerHeight - H * s) / 2);
  };
  window.addEventListener('resize', fit);
  fit();

  const kit = await Kit.load('/chars/kit');
  const J = kit.json;
  const CLIPS = bakeAll(J.pose_test);
  const rigs: { rig: PaperRig; phase: number; still?: boolean; anim?: Animator; fixed?: Pose }[] = [];
  const add = async (look: Look, x: number, y: number, scale: number, facing: 1 | -1, parent: Container, phase = Math.random() * 2, still = false) => {
    const rig = new PaperRig(kit, { scale, facing });
    await rig.setLook(look);
    rig.view.position.set(x, y);
    parent.addChild(rig.view);
    let anim: Animator | undefined;
    if (!still) {
      anim = new Animator(rig, CLIPS, scale);
      anim.home = { x, y };
      anim.play('idle', { blend: 0 });
      anim.update(phase);
    }
    rigs.push({ rig, phase, still, anim });
    return rig;
  };
  const animOf = (r: PaperRig) => rigs.find((x) => x.rig === r)!.anim!;

  const ui = document.getElementById('ui')!;
  const bgTex: Texture = await Assets.load('/bg/arena.png');

  if (VIEW === 'arena') {
    const arena = new Container();
    world.addChild(arena);
    arena.addChild(new Sprite(bgTex));
    const gsh = groundShadowTexture();
    const tp = params.get('tier');
    const looks = [randomLook(tp ? +tp : undefined), randomLook(tp ? +tp : undefined)];
    for (const [i, x] of [[0, 640], [1, 1290]] as const) {
      const g = new Sprite(gsh);
      g.anchor.set(0.5); g.blendMode = 'multiply'; g.tint = 0x8a5a48;
      g.width = 5.2 * UNIT; g.height = 1.3 * UNIT;
      g.position.set(x + 0.35 * UNIT * (i ? -1 : 1), FEET_Y);
      arena.addChild(g);
      await add(looks[i], x, FEET_Y - PELVIS_ABOVE_FEET * UNIT, UNIT, i ? -1 : 1, arena, i * 0.7);
    }
    ui.innerHTML = '<a href="?view=wardrobe">garderoba</a> · <a href="?view=lineup">10 zestawów</a> · <a href="?view=faces">twarze</a> · <a href="?">losuj</a>';
  }

  if (VIEW === 'lineup') {
    world.addChild(label('Armour sets: tier 1 → 10', W / 2, 18, 34));
    for (let t = 1; t <= 10; t++) {
      const col = (t - 1) % 5, row = Math.floor((t - 1) / 5);
      const x = 230 + col * 365, feet = 500 + row * 520;
      const look: Look = { ...DEFAULT_LOOK, skin: (t * 3) % 10, face: t - 1, hair: (t + 2) % 10, hairColor: (t * 7) % 10, beard: (t * 3) % 10 };
      for (const s of EQUIP_SLOTS) look[s] = t;
      await add(look, x, feet - PELVIS_ABOVE_FEET * 32, 32, 1, world, t * 0.3, true);
      const sum = EQUIP_SLOTS.reduce((a, s) => a + (item(s, t)?.armor ?? 0), 0);
      const price = EQUIP_SLOTS.reduce((a, s) => a + (item(s, t)?.price ?? 0), 0);
      world.addChild(label(`${t}. ${J.sets[t - 1]}`, x + 40, feet + 2, 24));
      world.addChild(label(`armour ${sum} · ${price.toLocaleString('en')} g`, x + 40, feet + 32, 18, '#cdb99a'));
    }
  }

  if (VIEW === 'faces') {
    const rows: [string, (i: number) => Partial<Look>][] = [
      ['Faces', (i) => ({ face: i, skin: 3, hair: 1, hairColor: 1, beard: 0 })],
      ['Hair', (i) => ({ face: 0, skin: 3, hair: i, hairColor: i === 0 ? 1 : i, beard: 0 })],
      ['Facial hair', (i) => ({ face: 0, skin: 3, hair: 1, hairColor: 1, beard: i })],
      ['Skin', (i) => ({ face: i, skin: i, hair: (i + 1) % 10, hairColor: (i * 3) % 10, beard: (i * 7) % 10 })],
    ];
    const S = 46, cw = 186, ch = 268;
    for (let r = 0; r < rows.length; r++) {
      world.addChild(label(rows[r][0], 960, r * ch + 2, 20, '#cdb99a'));
      for (let i = 0; i < 10; i++) {
        const cx = 30 + i * cw + cw / 2, top = r * ch + 28;
        const bg = new Graphics().roundRect(cx - cw / 2 + 4, top, cw - 8, ch - 34, 10).fill(0x3b4558);
        world.addChild(bg);
        const look = { ...DEFAULT_LOOK, ...rows[r][1](i) } as Look;
        // portrait = window of the puppet texture around the head (units relative to the pelvis)
        const wu = (cw - 8) / S, hu = (ch - 34) / S;
        const rig = await add(look, cx - cw / 2 + 4, top, S, 1, world, i * 0.2, true);
        rig.crop(0.3 - wu / 2, 7.3 - hu, 0.3 + wu / 2, 7.3);
        const nm = r === 0 ? J.faces[i].name : r === 1 ? J.hairs[i] : r === 2 ? J.beards[i] : J.skins[i].name;
        const tl = label(nm, cx, top + ch - 62, 17);
        world.addChild(tl);
      }
    }
  }

  if (VIEW === 'wardrobe') {
    const bg = new Sprite(bgTex);
    bg.tint = 0x8a7a70;
    world.addChild(bg);
    const BIG = 58;
    const look: Look = { ...DEFAULT_LOOK };
    const rig = await add({ ...look }, 700, 1040 - PELVIS_ABOVE_FEET * BIG, BIG, 1, world, 0);
    ui.classList.add('wardrobe');
    const rows: { key: string; title: string; count: number; name: (v: number) => string }[] = [
      { key: 'skin', title: 'Skin', count: 10, name: (v) => J.skins[v].name },
      { key: 'face', title: 'Face', count: 10, name: (v) => J.faces[v].name },
      { key: 'hair', title: 'Hair', count: 10, name: (v) => J.hairs[v] },
      { key: 'hairColor', title: 'Hair colour', count: 10, name: (v) => J.hair_colors[v].name },
      { key: 'beard', title: 'Facial hair', count: 10, name: (v) => J.beards[v] },
      { key: 'set', title: 'Full set', count: 11, name: (v) => (v ? `${v}. ${J.sets[v - 1]}` : 'none') },
      ...EQUIP_SLOTS.map((s) => ({ key: s as string, title: s[0].toUpperCase() + s.slice(1), count: 11, name: (v: number) => (v ? item(s, v)!.name : '—') })),
    ];
    const vals: Record<string, number> = { ...(look as unknown as Record<string, number>), set: 0 };
    const html = rows.map((r) => `<div class="row"><span class="t">${r.title}</span><button data-k="${r.key}" data-d="-1">◀</button><span class="v" id="v_${r.key}"></span><button data-k="${r.key}" data-d="1">▶</button></div>`).join('');
    ui.innerHTML = `<h3>Gladiator</h3>${html}<div class="row"><button id="rand">Random</button></div><div id="stats"></div><div class="row small"><a href="?">arena</a> · <a href="?view=lineup">10 sets</a> · <a href="?view=faces">faces</a></div>`;
    const refresh = async () => {
      for (const r of rows) document.getElementById(`v_${r.key}`)!.textContent = r.name(vals[r.key]);
      const its = EQUIP_SLOTS.map((s) => item(s, look[s])).filter(Boolean) as (typeof ITEMS)[number][];
      const full = its.length === 5 && its.every((i) => i.tier === its[0].tier);
      const armor = Math.round(its.reduce((a, i) => a + i.armor, 0) * (full ? 1.1 : 1));
      document.getElementById('stats')!.innerHTML =
        `<div>Armour <b>${armor}</b> · Weight <b>${its.reduce((a, i) => a + i.weight, 0).toFixed(1)}</b> · Value <b>${its.reduce((a, i) => a + i.price, 0).toLocaleString('en')} g</b></div>` +
        its.map((i) => `<div class="it">${i.name} <i>(+${i.armor}, ${i.price.toLocaleString('en')} g, lvl ${i.minLevel})</i></div>`).join('') +
        (full ? `<div class="it gold">${SET_BONUS}${its[0].bonus ? ' · ' + its[0].bonus : ''}</div>` : '');
      await rig.setLook(look);
    };
    ui.addEventListener('click', (e) => {
      const b = e.target as HTMLElement;
      if (b.id === 'rand') {
        Object.assign(look, randomLook());
        Object.assign(vals, look, { set: 0 });
        void refresh();
        return;
      }
      const k = b.dataset.k;
      if (!k) return;
      const r = rows.find((x) => x.key === k)!;
      vals[k] = (vals[k] + +b.dataset.d! + r.count) % r.count;
      if (k === 'set') { for (const s of EQUIP_SLOTS) { look[s] = vals.set; vals[s] = vals.set; } }
      else (look as unknown as Record<string, number>)[k] = vals[k];
      void refresh();
    });
    await refresh();
  }

  let fx: FxLayer | undefined;
  if (VIEW === 'anim') fx = await animLab();
  if (VIEW === 'strip') await strip();

  let t = 0;
  app.ticker.add((tk) => {
    const dt = Math.min(0.1, tk.deltaMS / 1000);
    t += dt;
    for (const r of rigs) {
      if (r.anim) r.anim.update(dt);
      else r.rig.pose = r.fixed ?? (r.still ? { ...J.pose_test } : idle(J.pose_test, t, r.phase));
      r.rig.render(app.renderer);
    }
    fx?.update(dt * (rigs[0]?.anim?.speed ?? 1));
  });

  // ---------------------------------------------------------------- animation lab: two fighters, every clip, reactions
  async function animLab(): Promise<FxLayer> {
    const arena = new Container();
    world.addChild(arena);
    arena.addChild(new Sprite(bgTex));
    const gsh = groundShadowTexture();
    const tp = params.get('tier');
    const L0 = randomLook(tp ? +tp : 4), L1 = randomLook(tp ? +tp : 6);
    const pY = FEET_Y - PELVIS_ABOVE_FEET * UNIT;
    const shadows: Sprite[] = [];
    for (let i = 0; i < 2; i++) {
      const g = new Sprite(gsh);
      g.anchor.set(0.5); g.blendMode = 'multiply'; g.tint = 0x8a5a48;
      g.width = 5.2 * UNIT; g.height = 1.3 * UNIT;
      arena.addChild(g);
      shadows.push(g);
    }
    const P = await add(L0, 640, pY, UNIT, 1, arena, 0);
    const E = await add(L1, 1290, pY, UNIT, -1, arena, 0.7);
    const layer = new FxLayer();
    arena.addChild(layer);
    const pa = animOf(P), ea = animOf(E);
    app.ticker.add((tk) => {
      clock += Math.min(0.1, tk.deltaMS / 1000) * pa.speed;
      for (let i = queue.length - 1; i >= 0; i--) if (queue[i].at <= clock) { const q = queue.splice(i, 1)[0]; q.fn(); }
      for (const [r, g] of [[P, shadows[0]], [E, shadows[1]]] as const) {
        const lift = Math.max(0, (pY - r.view.y) / UNIT);
        g.position.set(r.view.x + 0.35 * UNIT * r.facing, FEET_Y);
        g.alpha = Math.max(0.25, 1 - lift * 0.18);
        g.scale.x = (5.2 * UNIT / 256) * Math.max(0.6, 1 - lift * 0.08);
      }
    });
    const gap = () => Math.abs(ea.home.x - pa.home.x) / UNIT;
    const MELEE = 5.0;
    // game-time scheduler (follows slow motion and manual stepping, unlike setTimeout)
    const queue: { at: number; fn: () => void }[] = [];
    let clock = 0;
    const later = (sec: number, fn: () => void) => queue.push({ at: clock + sec, fn });
    const state = { response: 'hit' as 'hit' | 'block', counter: true };
    void clock;
    const head = (r: PaperRig) => ({ x: r.view.x + 0.3 * UNIT * r.facing, y: r.view.y - 8.9 * UNIT });
    const dmg = (who: PaperRig, n: number, crit = false) => { const h = head(who); layer.show(who === P ? 'p' : 'e', new DamageSplat(n, crit), h.x + 34 * who.facing, h.y); };
    const shield = (who: PaperRig) => { const h = head(who); layer.show(who === P ? 'pb' : 'eb', new BlockShield(), h.x - 30 * who.facing, h.y + 6); };
    const defend = (def: Animator, power: number, crit = false) => {
      if (state.response === 'block' && Math.random() < 0.9) { def.play('block'); shield(def.rig); }
      else { def.play('hit'); dmg(def.rig, Math.round(power * (0.7 + Math.random() * 0.6)), crit); }
    };
    const closeIn = (a: Animator) => a.play('walk_fwd', { commit: true, distance: Math.min(1.6, Math.max(0, gap() - MELEE)) });
    const enemyTurn = () => {
      if (!state.counter) return;
      later(0.5, () => {
        if (ea.busy) return;
        if (gap() > MELEE + 0.6) { closeIn(ea); return; }
        ea.play(Math.random() < 0.5 ? 'attack_normal' : 'attack_power', { blend: 1, onEvent: (e) => { if (e.type === 'hit') defend(pa, 9); } });
      });
    };
    const act = (name: string) => {
      if (pa.busy || ea.busy) return;
      const g = gap();
      switch (name) {
        case 'walk_fwd': pa.play('walk_fwd', { commit: true, distance: Math.min(1.6, Math.max(0, g - MELEE)), onEnd: enemyTurn }); break;
        case 'walk_back': pa.play('walk_back', { commit: true, onEnd: enemyTurn }); break;
        case 'jump': pa.play('jump', { commit: true, distance: Math.min(4, Math.max(0.5, g - MELEE)), onEnd: enemyTurn }); break;
        case 'charge':
          pa.play('charge', {
            commit: true, distance: Math.max(0.5, g - 3.4), onEnd: enemyTurn, onEvent: (e) => {
              if (e.type !== 'hit') return;
              if (state.response === 'block') { ea.play('block'); shield(E); }
              else { ea.play('knockback', { commit: true }); dmg(E, 7 + Math.floor(Math.random() * 6)); }
            },
          });
          break;
        case 'attack_quick': case 'attack_normal': case 'attack_power': {
          const pw = name === 'attack_quick' ? 4 : name === 'attack_normal' ? 9 : 16;
          if (g > MELEE + 0.6) { closeIn(pa); break; }
          pa.play(name, { blend: 1, onEnd: enemyTurn, onEvent: (e) => { if (e.type === 'hit') defend(ea, pw, name === 'attack_power' && Math.random() < 0.4); } });
          break;
        }
        case 'finish':
          if (g > MELEE + 0.6) { closeIn(pa); break; }
          pa.play('attack_power', { blend: 1, then: 'victory', onEvent: (e) => { if (e.type === 'hit') { ea.play('death', { then: null }); dmg(E, 24, true); } } });
          break;
        case 'reset':
          pa.home.x = 640; ea.home.x = 1290; pa.play('idle'); ea.play('idle'); layer.clear(); break;
        default: pa.play(name, { onEnd: enemyTurn });
      }
    };
    const btn = (id: string, txt: string) => `<button data-a="${id}">${txt}</button>`;
    ui.classList.add('lab');
    ui.innerHTML = `<h3>Animation lab</h3>
      <div class="grid">${btn('walk_back', '&#9664; step')}${btn('walk_fwd', 'step &#9654;')}${btn('jump', 'jump')}${btn('charge', 'charge')}
      ${btn('attack_quick', 'quick')}${btn('attack_normal', 'normal')}${btn('attack_power', 'power')}${btn('block', 'block')}
      ${btn('taunt', 'taunt')}${btn('rest', 'rest')}${btn('hit', 'hit')}${btn('finish', 'finish')}${btn('victory', 'victory')}${btn('death', 'die')}${btn('reset', 'reset')}</div>
      <label><input type="checkbox" id="cbBlock"> enemy blocks</label>
      <label><input type="checkbox" id="cbCounter" checked> enemy answers</label>
      <label>speed <select id="sSpeed"><option value="1">1x</option><option value="0.5">0.5x</option><option value="0.25">0.25x</option><option value="0.1">0.1x</option></select></label>
      <div class="small"><a href="?">arena</a> &middot; <a href="?view=wardrobe">wardrobe</a> &middot; <a href="?view=strip&clip=attack_normal">frame strips</a></div>`;
    ui.addEventListener('click', (e) => { const a = (e.target as HTMLElement).dataset.a; if (a) act(a); });
    (document.getElementById('cbBlock') as HTMLInputElement).onchange = (e) => (state.response = (e.target as HTMLInputElement).checked ? 'block' : 'hit');
    (document.getElementById('cbCounter') as HTMLInputElement).onchange = (e) => (state.counter = (e.target as HTMLInputElement).checked);
    (document.getElementById('sSpeed') as HTMLSelectElement).onchange = (e) => { const v = +(e.target as HTMLSelectElement).value; pa.speed = v; ea.speed = v; };
    (window as unknown as { __act: unknown }).__act = act;
    return layer;
  }

  // ---------------------------------------------------------------- frame strip of one clip (30 fps), for timing checks
  async function strip() {
    const name = params.get('clip') ?? 'attack_normal';
    const c = CLIPS[name];
    const every = +(params.get('every') ?? 1);
    const frames: number[] = [];
    for (let f = 0; f <= c.length; f += every) frames.push(f);
    const cols = Math.min(9, frames.length), rows = Math.ceil(frames.length / cols);
    const cw = W / cols, ch = (H - 50) / rows;
    const S = Math.min(cw / 10, ch / 14.5);
    const bgs = new Container();
    world.addChild(bgs);
    world.addChild(label(`${name}: ${c.length} frames @ ${FPS} fps` + (every > 1 ? ` (every ${every})` : ''), W / 2, 8, 26));
    const tier = +(params.get('tier') ?? 6);
    const look: Look = { ...randomLook(tier), helmet: tier, armor: tier, shoulders: tier, greaves: tier, boots: tier };
    const probe = new PaperRig(kit, { scale: S, facing: 1 });
    const baseLow = probe.soleLow(J.pose_test);
    for (let i = 0; i < frames.length; i++) {
      const f = frames[i];
      const col = i % cols, row = Math.floor(i / cols);
      const x0 = col * cw, y0 = 50 + row * ch;
      bgs.addChild(new Graphics().rect(x0 + 3, y0 + 3, cw - 6, ch - 6).fill(0x3b4558));
      const s = sample(c, f);
      const rig = await add(look, 0, 0, S, 1, world, 0, true);
      rigs[rigs.length - 1].fixed = s.pose;
      const lift = s.air ? s.y : s.y + baseLow - probe.soleLow(s.pose);
      rig.view.position.set(x0 + cw * 0.36 + s.x * S * 0.4, y0 + ch - 10 - PELVIS_ABOVE_FEET * S - lift * S);
      const ev = (c.events ?? []).filter((e) => e.f === f).map((e) => ' ' + e.type).join('');
      world.addChild(label(`${f}${ev}`, x0 + 30, y0 + 6, 16, ev ? '#e8be4c' : '#cdb99a'));
    }
  }

  (window as unknown as { __game: unknown }).__game = { app, kit, rigs };

  const shot = params.get('shot');
  if (shot) {
    let n = 0;
    const grab = () => { if (++n >= 45) { app.ticker.remove(grab); save().catch((e) => console.error('shot failed', e)); } };
    const save = async () => {
      const s = { sx: world.scale.x, x: world.position.x, y: world.position.y };
      world.scale.set(1); world.position.set(0, 0);
      const c = app.renderer.extract.canvas({ target: world, resolution: 1 }) as HTMLCanvasElement;
      world.scale.set(s.sx); world.position.set(s.x, s.y);
      const blob: Blob = await new Promise((r) => c.toBlob((b) => r(b!), 'image/png'));
      await fetch(`/__shot?name=${encodeURIComponent(shot)}`, { method: 'POST', body: blob });
      document.title = 'SHOT_DONE';
      console.log('SHOT_DONE', shot);
    };
    app.ticker.add(grab);
  }
}

main();
