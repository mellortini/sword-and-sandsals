import { Container, Sprite } from 'pixi.js';
import type { Animator } from '../../anim/Animator';
import type { PaperRig } from '../../rig/PaperRig';
import { BlockShield, DamageSplat, FxLayer } from '../../ui/fx';
import { FEET_Y, PELVIS_ABOVE_FEET, UNIT, groundShadowTexture, randomLook } from '../common';
import type { SceneContext, SceneUpdate } from '../common';

export async function showAnimLab({ app, world, bgTex, params, ui, add, rigs }: SceneContext): Promise<SceneUpdate> {
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
  const pa = rigs.find((r) => r.rig === P)!.anim!;
  const ea = rigs.find((r) => r.rig === E)!.anim!;
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
  return (dt) => layer.update(dt * pa.speed);
}
