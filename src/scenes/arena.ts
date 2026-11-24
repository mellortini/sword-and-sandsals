import { Container, Sprite } from 'pixi.js';
import type { AiProfile } from '../core/ai';
import { createCombat } from '../core/combat';
import { saveGame } from '../core/save';
import type { SavedCharacter } from '../core/save';
import type { Attributes, CombatAction, FighterSide } from '../core/types';
import type { Look } from '../rig/PaperRig';
import { summarizeFight } from '../ui/fightSummary';
import { FxLayer } from '../ui/fx';
import { hudScaleFor } from '../ui/phone';
import { openLevelUp } from '../ui/levelUp';
import { applyFightExperience } from '../ui/levelUpRules';
import type { FightProgress } from '../ui/levelUpRules';
import { CombatHud } from '../ui/hud';
import { RadialMenu } from '../ui/radialMenu';
import { CombatPresenter } from './combatPresenter';
import { FEET_Y, H, PELVIS_ABOVE_FEET, UNIT, W, groundShadowTexture, randomLook } from './common';
import type { SceneContext, SceneUpdate } from './common';
import { openFightResult } from './fightResult';
import { loadoutFromLook } from './preFight';
import { aiPicker, runFight } from './turnLoop';
import type { ActionPicker } from './turnLoop';
import { arenaBackdrop } from './backdrop';
import { FIGHT_LAYOUT } from './combatPlan';

export interface ArenaFighter {
  readonly look: Look;
  readonly name: string;
  readonly attributes?: Partial<Attributes>;
  readonly level?: number;
}

export interface ArenaOptions {
  /** the saved gladiator fighting as the player: wins add XP to the save and the result screen shows the XP bar (#24) */
  readonly career?: SavedCharacter;
}

const LAYOUT = FIGHT_LAYOUT;
/** seconds before the opponent answers */
const ENEMY_PAUSE = 0.5;

const PROFILES: readonly AiProfile[] = ['aggressor', 'defender'];
const pause = (sec: number) => new Promise<void>((r) => setTimeout(r, sec * 1000));

/**
 * The arena fight (#12): the player picks from the radial menu, the opponent's AI (#6) answers after a short pause,
 * CombatPresenter animates every action and the HUD follows. The menu opens only when the player's action can be chosen,
 * never during an animation. At 0 HP the result screen offers a rematch or the way back to the title.
 * Pre-fight passes the two gladiators it showed; a direct visit (`?view=arena[&tier=N][&ai=aggressor|defender]`) uses random ones.
 */
export async function showArena(
  context: SceneContext, fighters?: readonly [ArenaFighter, ArenaFighter], options: ArenaOptions = {},
): Promise<SceneUpdate> {
  const { world, bgTex, params, ui, add, rigs } = context;
  const arena = new Container();
  world.addChild(arena);
  arena.addChild(new Sprite(arenaBackdrop(bgTex)));

  const tp = params.get('tier');
  const tier = tp ? +tp : undefined;
  const [player, enemy]: readonly [ArenaFighter, ArenaFighter] = fighters
    ?? [{ name: 'Player', look: randomLook(tier) }, { name: 'Opponent', look: randomLook(tier) }];
  const asked = params.get('ai');
  const profile: AiProfile = asked === 'aggressor' || asked === 'defender' ? asked : PROFILES[Math.floor(Math.random() * PROFILES.length)];

  const pelvisY = FEET_Y - PELVIS_ABOVE_FEET * UNIT;
  const gsh = groundShadowTexture();
  const shadows = [0, 1].map(() => {
    const g = new Sprite(gsh);
    g.anchor.set(0.5); g.blendMode = 'multiply'; g.tint = 0x8a5a48;
    g.width = 5.2 * UNIT; g.height = 1.3 * UNIT;
    arena.addChild(g);
    return g;
  });
  const P = await add(player.look, LAYOUT.left, pelvisY, UNIT, 1, arena, 0);
  const E = await add(enemy.look, W - LAYOUT.left, pelvisY, UNIT, -1, arena, 0.7);
  const fx = new FxLayer();
  arena.addChild(fx);

  const empty = { name: '', health: 1, energy: 1, stats: { maxHealth: 1, maxEnergy: 1 } };
  const hud = new CombatHud({ fighters: { player: empty, enemy: empty } }, W, H);
  arena.addChild(hud);
  const presenter = new CombatPresenter({
    fighters: { player: rigs.find((r) => r.rig === P)!.anim!, enemy: rigs.find((r) => r.rig === E)!.anim! },
    fx, unit: UNIT, layout: LAYOUT,
    onState: (s) => hud.setState(s),
  });

  // the player's turn: open the menu with the options the core allows and wait for a click
  let choose: ((action: CombatAction) => void) | null = null;
  const menu = new RadialMenu((action) => {
    const resolve = choose;
    choose = null;
    resolve?.(action);
  });
  arena.on('destroyed', () => menu.destroy());
  const playerPicker: ActionPicker = (_state, options) => new Promise((resolve) => {
    choose = resolve;
    menu.open(options);
  });

  ui.innerHTML = '<a href="?view=title">title</a> · <a href="?view=prefight">new opponent</a> · '
    + '<a href="?view=arena&ai=aggressor">vs aggressor</a> · <a href="?view=arena&ai=defender">vs defender</a>';

  let career = options.career;
  const spendPoints = async (character: SavedCharacter) => {
    career = await openLevelUp(character, loadoutFromLook(character.look), saveGame);
    return career;
  };

  let seed = params.has('seed') ? Math.floor(+params.get('seed')!) : Math.floor(Math.random() * 1e9);
  void (async () => {
    for (;;) {
      const start = createCombat(seed,
        {
          name: player.name, attributes: career?.attributes ?? player.attributes,
          level: career?.level ?? player.level, equipment: loadoutFromLook(player.look),
        },
        { name: enemy.name, attributes: enemy.attributes, level: enemy.level, equipment: loadoutFromLook(enemy.look) });
      presenter.reset(start);
      const outcome = await runFight(start, {
        pickers: { player: playerPicker, enemy: aiPicker(profile, seed ^ 0x85ebca6b) },
        present: (events, after) => presenter.present(events, after),
        pause: (next: FighterSide) => (next === 'enemy' ? pause(ENEMY_PAUSE) : Promise.resolve()),
      });
      menu.close();
      // let the death and victory poses land before the result covers them
      await pause(1.2);
      let progress: FightProgress | undefined;
      if (career) {
        progress = applyFightExperience(career, outcome.state.rewards?.experience ?? 0);
        career = progress.after;
        // the bar still shows the XP if saving fails; the next fight starts from it again
        if (progress.earned > 0) await saveGame(career).catch(() => undefined);
      }
      const choice = await openFightResult(context, {
        player, enemy, summary: summarizeFight(outcome.events), progress, spendPoints: career ? spendPoints : undefined,
      });
      if (choice === 'leave') {
        location.search = '?view=title';
        return;
      }
      seed++;
    }
  })();

  return (dt) => {
    hud.setPanelScale(hudScaleFor(world.scale.x));
    hud.update(dt);
    fx.update(dt); // damage numbers, MISS and BLOCK animate and fade only while ticked
    const { x, y } = P.view.getGlobalPosition();
    menu.setAnchor(x, y, world.scale.x, world.position.y + hud.panelTop * world.scale.x);
    for (const [rig, g] of [[P, shadows[0]], [E, shadows[1]]] as const) {
      const lift = Math.max(0, (pelvisY - rig.view.y) / UNIT);
      g.position.set(rig.view.x + 0.35 * UNIT * rig.facing, FEET_Y);
      g.alpha = Math.max(0.25, 1 - lift * 0.18);
      g.width = 5.2 * UNIT * Math.max(0.6, 1 - lift * 0.08);
    }
  };
}
