import { Container, Sprite } from 'pixi.js';
import type { StatusKind } from '../../core/status';
import type { Animator } from '../../anim/Animator';
import type { PaperRig } from '../../rig/PaperRig';
import { createCombat, getActionOptions, performAction } from '../../core/combat';
import type { ActionOption, CombatAction, CombatState } from '../../core/types';
import { CombatHud } from '../../ui/hud';
import { BlockShield, DamageSplat, FxLayer, MissText } from '../../ui/fx';
import { playFinisher } from '../../ui/finisher';
import { GORE_MODES, goreMode, setGoreMode } from '../../ui/gore';
import type { GoreMode } from '../../ui/gore';
import { CombatPresenter } from '../combatPresenter';
import { FEET_Y, H, PELVIS_ABOVE_FEET, UNIT, W, groundShadowTexture, randomLook } from '../common';
import type { SceneContext, SceneUpdate } from '../common';
import { arenaBackdrop } from '../backdrop';
import { CrowdFx } from '../../ui/crowdFx';
import { CameraJuice, applyCamera } from '../../ui/cameraJuice';
import { reduceMotion, setMotionMode } from '../../ui/motion';
import { FIGHT_LAYOUT, MIN_LUNGE, STRIKE_GAP } from '../combatPlan';
import { WEAPONS } from '../../data/weapons';
import { blowSound, playFoley } from '../../audio/foley';
import { setVolume, volumes } from '../../audio/volume';

const STATUS_KINDS: readonly StatusKind[] = ['burning', 'soaked', 'stunned', 'taped', 'torn', 'feared', 'slowed'];

export async function showAnimLab({ app, world, bgTex, params, ui, add, rigs }: SceneContext): Promise<SceneUpdate> {
  const arena = new Container();
  world.addChild(arena);
  arena.addChild(new Sprite(arenaBackdrop(bgTex)));
  const crowdFx = arena.addChild(new CrowdFx());
  // the camera's juice (#75): crit zoom, charge shake, drift; the checkbox below is the "reduce motion" setting
  const camera = new CameraJuice(W, H, reduceMotion);
  const gsh = groundShadowTexture();
  const tp = params.get('tier');
  // &weapon=hammer8 / &enemy=spear6: try a weapon (and its clip variants, #36) in the lab
  const armed = (look: ReturnType<typeof randomLook>, w: string | null) => (w ? { ...look, weapon: w } : look);
  // &shield=4 / &eshield=7: a shield of that tier on the back hand (#38)
  const L0 = { ...armed(randomLook(tp ? +tp : 4), params.get('weapon')), shield: +(params.get('shield') ?? 0) }, L1 = { ...armed(randomLook(tp ? +tp : 6), params.get('enemy')), shield: +(params.get('eshield') ?? 0) };
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
  // melee distance as in the game: the pelvises at logical distance 2 (#151); a longer weapon strikes from further (#36)
  const MELEE = (FIGHT_LAYOUT.contact + 2 * FIGHT_LAYOUT.px) / UNIT;
  type Attack = 'attack_quick' | 'attack_normal' | 'attack_power';
  /** the weapon's reach from the catalogue (spear 3, sword 2, hammer 1.5) as pelvis distance on screen */
  const rangeOf = (a: Animator) => (FIGHT_LAYOUT.contact + (WEAPONS.find((w) => w.id === a.rig.look.weapon)?.range ?? 2) * FIGHT_LAYOUT.px) / UNIT;
  const kindOf = (name: Attack) => name.slice('attack_'.length) as 'quick' | 'normal' | 'power';
  // game-time scheduler (follows slow motion and manual stepping, unlike setTimeout)
  const queue: { at: number; fn: () => void }[] = [];
  let clock = 0;
  const later = (sec: number, fn: () => void) => queue.push({ at: clock + sec, fn });
  const state = { response: 'hit' as 'hit' | 'block' | 'dodge', counter: true };
  const head = (r: PaperRig) => ({ x: r.view.x + 0.3 * UNIT * r.facing, y: r.view.y - 8.9 * UNIT });
  const dmg = (who: PaperRig, n: number, crit = false) => { const h = head(who); layer.show(who === P ? 'p' : 'e', new DamageSplat(n, crit), h.x + 34 * who.facing, h.y); };
  const miss = (who: PaperRig) => { const h = head(who); layer.show(who === P ? 'p' : 'e', new MissText(), h.x + 34 * who.facing, h.y); };
  const shield = (who: PaperRig) => { const h = head(who); layer.show(who === P ? 'pb' : 'eb', new BlockShield(), h.x - 30 * who.facing, h.y + 6); };
  const defend = (def: Animator, power: number, crit = false) => {
    if (state.response === 'dodge') { def.play('dodge'); miss(def.rig); playFoley('miss'); }
    else if (state.response === 'block' && Math.random() < 0.9) { def.play('block'); shield(def.rig); playFoley('block'); }
    else {
      def.play('hit'); dmg(def.rig, Math.round(power * (0.7 + Math.random() * 0.6)), crit);
      const attacker = def === ea ? pa : ea;
      playFoley(blowSound({ hit: true, blocked: false, crit }, WEAPONS.find((w) => w.id === attacker.rig.look.weapon)?.family));
    }
  };
  /**
   * Walk into this weapon's range (several strides if needed), then strike - one click is one attack.
   * The lunge is fitted like the CombatPresenter does, so the blow lands on the strike point and nobody walks into the other.
   */
  const strike = (a: Animator, name: Attack, opts: { then?: string; onEnd?: () => void; onHit: () => void }) => {
    const range = rangeOf(a), g = gap();
    if (g > range + 0.3) {
      a.play('walk_fwd', { commit: true, distance: Math.min(2.4, g - range), then: null, onEnd: () => strike(a, name, opts) });
      return;
    }
    a.play(name, {
      blend: 1, lunge: Math.max(MIN_LUNGE, g - STRIKE_GAP[kindOf(name)]), then: opts.then ?? 'idle', onEnd: opts.onEnd,
      onEvent: (e) => { if (e.type === 'hit') opts.onHit(); },
    });
  };
  const enemyTurn = () => {
    if (!state.counter) return;
    later(0.5, () => {
      if (ea.busy) return;
      strike(ea, Math.random() < 0.5 ? 'attack_normal' : 'attack_power', { onHit: () => defend(pa, 9) });
    });
  };
  const act = (name: string) => {
    if (name === 'reset') { fighting = false; presenter.cancel(); }
    else if (fighting) return; // the core fight owns both fighters until it ends or is reset
    if (name !== 'reset' && (pa.busy || ea.busy)) return;
    const g = gap();
    switch (name) {
      case 'walk_fwd': pa.play('walk_fwd', { commit: true, distance: Math.min(1.6, Math.max(0, g - MELEE)), onEnd: enemyTurn }); break;
      case 'walk_back': pa.play('walk_back', { commit: true, onEnd: enemyTurn }); break;
      case 'jump': pa.play('jump', { commit: true, distance: Math.min(4, Math.max(0.5, g - MELEE)), onEnd: enemyTurn }); break;
      case 'charge':
        pa.play('charge', {
          commit: true, distance: Math.max(0.5, g - 3.4), onEnd: enemyTurn, onEvent: (e) => {
            if (e.type !== 'hit') return;
            if (state.response === 'dodge') { ea.play('dodge'); miss(E); }
            else if (state.response === 'block') { ea.play('block'); shield(E); }
            else { ea.play('knockback', { commit: true }); dmg(E, 7 + Math.floor(Math.random() * 6)); }
          },
        });
        break;
      case 'attack_quick': case 'attack_normal': case 'attack_power': {
        const pw = name === 'attack_quick' ? 4 : name === 'attack_normal' ? 9 : 16;
        strike(pa, name, { onEnd: enemyTurn, onHit: () => defend(ea, pw, name === 'attack_power' && Math.random() < 0.4) });
        break;
      }
      case 'finish':
        // no damage splat here: it would sit right where the head takes off
        strike(pa, 'attack_power', { then: 'victory', onHit: () => playFinisher(ea, layer, { floorY: FEET_Y }) });
        break;
      case 'net_throw': if (pa.clipFor('net_throw')) pa.play('net_throw'); break;
      case 'cheer': crowdFx.cheer(1, P.view.x); camera.punch(E.view.x, E.view.y - 5 * UNIT, 1); break;
      case 'gifts': crowdFx.throw('bouquet', 5, P.view.x, FEET_Y); crowdFx.throw('coin', 4, P.view.x, FEET_Y); break;
      case 'reset':
        hud.visible = false;
        pa.home.x = 640; ea.home.x = 1290; pa.play('idle'); ea.play('idle'); layer.clear(); break;
      default: pa.play(name, { onEnd: enemyTurn });
    }
  };
  const btn = (id: string, txt: string) => `<button data-a="${id}">${txt}</button>`;
  ui.classList.add('lab');
  ui.innerHTML = `<h3>Animation lab</h3>
    <div class="grid">${btn('walk_back', '&#9664; step')}${btn('walk_fwd', 'step &#9654;')}${btn('jump', 'jump')}${btn('charge', 'charge')}
    ${btn('attack_quick', 'quick')}${btn('attack_normal', 'normal')}${btn('attack_power', 'power')}${btn('block', 'block')}${btn('dodge', 'dodge')}
    ${btn('taunt', 'taunt')}${btn('rest', 'rest')}${btn('hit', 'hit')}${btn('finish', 'finish')}${btn('victory', 'victory')}${btn('death', 'die')}${btn('reset', 'reset')}${btn('net_throw', 'throw net')}${btn('cheer', 'crowd cheers')}${btn('gifts', 'crowd throws')}${btn('fight', 'core fight')}</div>
    <label>enemy <select id="sResponse"><option value="hit">gets hit</option><option value="block">blocks</option><option value="dodge">dodges (miss)</option></select></label>
    <label><input type="checkbox" id="cbCounter" checked> enemy answers</label>
    <label>gore <select id="sGore">${GORE_MODES.map((m) => `<option value="${m.id}"${m.id === goreMode() ? ' selected' : ''}>${m.name}</option>`).join('')}</select></label>
    <label>volume <input type="range" id="rVolume" min="0" max="1" step="0.05" value="${volumes().master}"></label>
    <label>status <select id="sStatus"><option value="">none</option>${STATUS_KINDS.map((k) => `<option value="${k}">${k}</option>`).join('')}<option value="all">all</option></select></label>
    <label><input type="checkbox" id="cbMotion"${reduceMotion() ? ' checked' : ''}> reduce motion</label>
    <label>speed <select id="sSpeed"><option value="1">1x</option><option value="0.5">0.5x</option><option value="0.25">0.25x</option><option value="0.1">0.1x</option></select></label>
    <div class="small"><a href="?view=arena">arena</a> &middot; <a href="?view=wardrobe">wardrobe</a> &middot; <a href="?view=strip&clip=attack_normal">frame strips</a></div>`;
  // --- core fight (#11): src/core decides, CombatPresenter animates, HUD follows. Both sides pick at random.
  // same staging as the arena (#151): bodies never overlap, lunges stretch to the strike point
  const layout = FIGHT_LAYOUT;
  const presenter = new CombatPresenter({
    crowdFx, camera,
    fighters: { player: pa, enemy: ea }, fx: layer, unit: UNIT, layout, floorY: FEET_Y, sound: true,
    onState: (s) => hud.setState(s),
  });
  const full = { name: '', health: 1, energy: 1, stats: { maxHealth: 1, maxEnergy: 1 } };
  const hud = new CombatHud({ fighters: { player: full, enemy: full } }, W, H);
  hud.visible = false;
  world.addChild(hud);
  let fighting = false;
  const pause = (sec: number) => new Promise<void>((res) => later(sec, res));
  const choose = (opts: ActionOption[], rnd: () => number): CombatAction => {
    const attacks = opts.filter((o) => o.hitChance !== undefined);
    if (attacks.length && rnd() < 0.8) return attacks[Math.floor(rnd() * attacks.length)].action;
    const moves = opts.filter((o) => ['step_forward', 'jump', 'charge'].includes(o.action));
    if (moves.length && rnd() < 0.85) return moves[Math.floor(rnd() * moves.length)].action;
    return opts[Math.floor(rnd() * opts.length)].action;
  };
  const coreFight = async (seed = Math.floor(Math.random() * 1e9)) => {
    if (fighting || presenter.busy) return null;
    fighting = true;
    let r = seed;
    const rnd = () => ((r = (Math.imul(r, 1_664_525) + 1_013_904_223) >>> 0) / 0x1_0000_0000);
    let state: CombatState = createCombat(seed, { name: 'Player', equipment: L0 }, { name: 'Opponent', equipment: L1 });
    hud.visible = true;
    hud.setState(state);
    presenter.reset(state);
    const log: string[] = [];
    while (fighting && state.winner === null) {
      const action = choose(getActionOptions(state), rnd);
      const res = performAction(state, action);
      if (!res.ok) break;
      log.push(`${state.active}:${action}`);
      await presenter.present(res.events, res.state);
      state = res.state;
      await pause(0.35);
    }
    fighting = false;
    return { seed, winner: state.winner, turns: log.length, log };
  };
  (window as unknown as { __fight: unknown }).__fight = coreFight;

  ui.addEventListener('click', (e) => { const a = (e.target as HTMLElement).dataset.a; if (a === 'fight') void coreFight(); else if (a) act(a); });
  (document.getElementById('sResponse') as HTMLSelectElement).onchange = (e) => (state.response = (e.target as HTMLSelectElement).value as typeof state.response);
  (document.getElementById('cbCounter') as HTMLInputElement).onchange = (e) => (state.counter = (e.target as HTMLInputElement).checked);
  (document.getElementById('sGore') as HTMLSelectElement).onchange = (e) => setGoreMode((e.target as HTMLSelectElement).value as GoreMode);
  (document.getElementById('rVolume') as HTMLInputElement).oninput = (e) => setVolume('master', +(e.target as HTMLInputElement).value);
  // statuses on both fighters (#50), 3 stacks so every spot shows; &status=burning,stunned picks them from the URL
  const showStatus = (value: string) => {
    const kinds = value === 'all' ? STATUS_KINDS : value.split(',').filter((k): k is StatusKind => (STATUS_KINDS as readonly string[]).includes(k));
    for (const side of ['player', 'enemy'] as const) layer.status.set(side, kinds.map((kind) => ({ kind, stacks: 3 })));
  };
  showStatus(params.get('status') ?? '');
  (document.getElementById('sStatus') as HTMLSelectElement).onchange = (e) => showStatus((e.target as HTMLSelectElement).value);
  (document.getElementById('cbMotion') as HTMLInputElement).onchange = (e) => { setMotionMode((e.target as HTMLInputElement).checked ? 'reduced' : 'full'); camera.clear(); };
  (document.getElementById('sSpeed') as HTMLSelectElement).onchange = (e) => { const v = +(e.target as HTMLSelectElement).value; pa.speed = v; ea.speed = v; };
  (window as unknown as { __act: unknown }).__act = act;
  return (dt) => {
    layer.update(dt * pa.speed); crowdFx.update(dt * pa.speed); hud.update(dt * pa.speed);
    applyCamera(arena, camera.update(dt * pa.speed), W, H);
  };
}
