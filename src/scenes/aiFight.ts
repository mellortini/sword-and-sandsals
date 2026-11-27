import { Container, Sprite } from 'pixi.js';
import type { AiProfile } from '../core/ai';
import { createCombat } from '../core/combat';
import type { FighterSide } from '../core/types';
import { summarizeFight } from '../ui/fightSummary';
import { FxLayer } from '../ui/fx';
import { startCrowd } from '../audio/crowd';
import { CombatHud } from '../ui/hud';
import { leaveFightOnEscape } from '../ui/leaveFight';
import { hudScaleFor } from '../ui/phone';
import { textScale } from '../ui/textSize';
import { CombatPresenter } from './combatPresenter';
import { FEET_Y, H, PELVIS_ABOVE_FEET, UNIT, W, groundShadowTexture, randomLook } from './common';
import type { SceneContext, SceneUpdate } from './common';
import { openFightResult } from './fightResult';
import { loadoutFromLook } from './preFight';
import { aiPicker, runFight } from './turnLoop';
import { arenaBackdrop } from './backdrop';
import { CrowdFx } from '../ui/crowdFx';
import { startMusic } from '../audio/music';
import { CameraJuice, applyCamera } from '../ui/cameraJuice';
import { reduceMotion } from '../ui/motion';
import { FIGHT_LAYOUT } from './combatPlan';

const LAYOUT = FIGHT_LAYOUT;
/** seconds of breath before the next fighter acts */
const TURN_PAUSE = 0.5;

const profileParam = (v: string | null): AiProfile | undefined => (v === 'aggressor' || v === 'defender' ? v : undefined);

/**
 * `?view=aifight[&tier=N][&seed=S][&player=aggressor|defender][&enemy=…]`: both gladiators are driven by the enemy AI (#6)
 * through the fight loop, animated by CombatPresenter with the HUD; the result screen follows.
 * Fight again → a rematch with new seeds; Leave → title. The arena turn loop (#12) swaps the player's AI for the action bar (#147).
 */
export async function showAiFight(context: SceneContext): Promise<SceneUpdate> {
  const { world, bgTex, params, ui, add, rigs } = context;
  const arena = new Container();
  world.addChild(arena);
  arena.addChild(new Sprite(arenaBackdrop(bgTex)));
  // the painted stands come alive (#52): over the backdrop, under the fighters
  const crowdFx = arena.addChild(new CrowdFx());

  const tp = params.get('tier');
  const tier = tp ? Math.min(10, Math.max(1, +tp)) : undefined;
  const fighters = {
    player: { name: 'Crixus Fold', look: randomLook(tier) },
    enemy: { name: 'Varro the Creased', look: randomLook(tier) },
  };
  const profiles: Record<FighterSide, AiProfile> = {
    player: profileParam(params.get('player')) ?? 'aggressor',
    enemy: profileParam(params.get('enemy')) ?? 'defender',
  };

  const pelvisY = FEET_Y - PELVIS_ABOVE_FEET * UNIT;
  const gsh = groundShadowTexture();
  const shadows = [0, 1].map(() => {
    const g = new Sprite(gsh);
    g.anchor.set(0.5); g.blendMode = 'multiply'; g.tint = 0x8a5a48;
    g.width = 5.2 * UNIT; g.height = 1.3 * UNIT;
    arena.addChild(g);
    return g;
  });
  const P = await add(fighters.player.look, LAYOUT.left, pelvisY, UNIT, 1, arena, 0);
  const E = await add(fighters.enemy.look, W - LAYOUT.left, pelvisY, UNIT, -1, arena, 0.7);
  const fx = new FxLayer();
  arena.addChild(fx);
  // the crowd murmurs while the arena is shown (#18); it fades out with the scene
  const crowd = startCrowd();
  // a quiet arena theme under it all (#73)
  const music = startMusic('arena');
  arena.on('destroyed', () => { crowd.stop(); music.stop(); });

  const empty = { name: '', health: 1, energy: 1, stats: { maxHealth: 1, maxEnergy: 1 } };
  const hud = new CombatHud({ fighters: { player: empty, enemy: empty } }, W, H);
  // the HUD stays still while the camera moves the arena under it (#75)
  world.addChild(hud);
  const camera = new CameraJuice(W, H, reduceMotion);
  const presenter = new CombatPresenter({
    crowdFx, camera,
    fighters: { player: rigs.find((r) => r.rig === P)!.anim!, enemy: rigs.find((r) => r.rig === E)!.anim! },
    fx, unit: UNIT, layout: LAYOUT, floorY: FEET_Y, sound: true, crowd,
    onState: (s) => hud.setState(s),
  });

  ui.innerHTML = '<a href="?view=title">title</a> · <a href="?view=aifight&player=aggressor&enemy=defender">aggressor vs defender</a> · '
    + '<a href="?view=aifight&player=aggressor&enemy=aggressor">aggressors</a> · <a href="?view=aifight&player=defender&enemy=defender">defenders</a>';

  const pause = (sec: number) => new Promise<void>((r) => setTimeout(r, sec * 1000));
  let seed = params.has('seed') ? Math.floor(+params.get('seed')!) : Math.floor(Math.random() * 1e9);
  // Escape asks before leaving, but only while a bout runs: the result screen has its own Escape (Leave)
  let fighting = false;
  leaveFightOnEscape(() => fighting);
  void (async () => {
    for (;;) {
      const start = createCombat(seed,
        { name: fighters.player.name, equipment: loadoutFromLook(fighters.player.look) },
        { name: fighters.enemy.name, equipment: loadoutFromLook(fighters.enemy.look) });
      presenter.reset(start);
      fighting = true;
      const outcome = await runFight(start, {
        pickers: { player: aiPicker(profiles.player, seed ^ 0x9e3779b9), enemy: aiPicker(profiles.enemy, seed ^ 0x85ebca6b) },
        present: (events, after) => presenter.present(events, after),
        pause: () => pause(TURN_PAUSE),
      });
      fighting = false;
      // let the death and victory poses land before the result covers them
      await pause(1.2);
      const choice = await openFightResult(context, { ...fighters, summary: summarizeFight(outcome.events) });
      if (choice === 'leave') {
        location.search = '?view=title';
        return;
      }
      seed++;
    }
  })();

  return (dt) => {
    hud.setPanelScale(Math.min(1.6, hudScaleFor(world.scale.x) * textScale()));
    hud.update(dt);
    fx.update(dt); // damage numbers, MISS and BLOCK animate and fade only while ticked
    crowdFx.update(dt);
    applyCamera(arena, camera.update(dt), W, H);
    for (const [rig, g] of [[P, shadows[0]], [E, shadows[1]]] as const) {
      // a taller fighter's pelvis rests higher (stature): that is not a jump
      const lift = Math.max(0, (FEET_Y - PELVIS_ABOVE_FEET * rig.scale - rig.view.y) / UNIT);
      g.position.set(rig.view.x + 0.35 * UNIT * rig.facing, FEET_Y);
      g.alpha = Math.max(0.25, 1 - lift * 0.18);
      g.width = 5.2 * rig.scale;
    }
  };
}
