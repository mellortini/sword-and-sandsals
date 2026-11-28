import { Container, Sprite } from 'pixi.js';
import type { AiProfile } from '../core/ai';
import { createCombat, getAttackZoneOptions } from '../core/combat';
import { passTime, storyOf } from '../core/story';
import { learnedTechniques, parseTechniques } from '../core/techniques';
import type { TechniqueId } from '../core/techniques';
import type { TargetedAttack } from '../core/hitZones';
import { saveGame } from '../core/save';
import type { CombatSlotAction } from '../core/spells';
import { recoverFromDefeat, settleTempleCombat, templeCombatSlots } from '../core/temple';
import type { SavedCharacter } from '../core/save';
import type { Attributes, CombatAction, EquipmentLoadout, FighterSide } from '../core/types';
import type { Look } from '../rig/PaperRig';
import { summarizeFight } from '../ui/fightSummary';
import { FxLayer } from '../ui/fx';
import { startCrowd } from '../audio/crowd';
import { hudScaleFor } from '../ui/phone';
import { textScale } from '../ui/textSize';
import { openLevelUp } from '../ui/levelUp';
import { getFightReward, takePrizeWeapon } from '../core/rewards';
import { championPrizeId, payFightReward } from '../ui/rewardRules';
import type { FightPayout } from '../ui/rewardRules';
import { openRewardScroll } from '../ui/rewardScroll';
import type { FightProgress } from '../ui/levelUpRules';
import { CombatHud } from '../ui/hud';
import { ActionBar } from '../ui/actionBar';
import { leaveFightOnEscape } from '../ui/leaveFight';
import { CombatPresenter } from './combatPresenter';
import { FEET_Y, H, PELVIS_ABOVE_FEET, UNIT, W, drawableLook, groundShadowTexture, randomLook } from './common';
import type { SceneContext, SceneUpdate } from './common';
import { openFightResult } from './fightResult';
import { careerLoadout } from '../ui/gearRules';
import { recordForCareer } from '../ui/achievementRules';
import { recordQuestBout, tallyBout } from '../core/quests';
import { showAchievements, showNotice } from '../ui/achievementToast';
import { afterBout } from '../ui/nemesisRules';
import { nextBout, recordLeagueWin } from '../ui/leagueRules';
import { boutUrl } from '../ui/leagues';
import { sceneAfter } from '../data/story';
import type { StoryScene } from '../data/story';
import { playStory } from '../ui/storyPlayer';
import type { NemesisMemory } from '../core/nemesis';
import { loadoutFromLook } from './preFight';
import { aiPicker, nemesisPicker, runFight } from './turnLoop';
import type { ActionPicker } from './turnLoop';
import { buildArenaStage } from './arenaStage';
import { isArenaId } from './arenas';
import type { ArenaId } from './arenas';
import { startMusic } from '../audio/music';
import { CameraJuice, applyCamera } from '../ui/cameraJuice';
import { reduceMotion } from '../ui/motion';
import { FIGHT_LAYOUT } from './combatPlan';
import { nextOpponent } from './opponents';

export interface ArenaFighter {
  readonly look: Look;
  readonly name: string;
  readonly attributes?: Partial<Attributes>;
  readonly level?: number;
  /** set when the opponent is the saved gladiator's nemesis (#209): it fights with what it remembers */
  readonly nemesis?: NemesisMemory;
  /** set for a league fighter (#58): its AI profile, and its wins are saved on the ladder */
  readonly bout?: { readonly id: string; readonly profile: AiProfile };
  /** this opponent's own AI; without it (and without a bout) the arena picks one */
  readonly profile?: AiProfile;
  /** who "Next opponent" brings instead of one grown from this opponent (the first bout's rookie) */
  readonly successor?: ArenaFighter;
  /** the gear the fighter really fights with when it is more than its look shows (weapon, league fighters) */
  readonly equipment?: EquipmentLoadout;
  /** the Masters' techniques this fighter uses in the bout (#295), e.g. Ser Corvin Lach's */
  readonly techniques?: readonly TechniqueId[];
}

export interface ArenaOptions {
  /** the saved gladiator fighting as the player: fights pay gold and XP into the save (#43), the result screen shows the XP bar (#24) */
  readonly career?: SavedCharacter;
  /** where the bout is fought (#272); `?arena=` when not given, else Pulpport */
  readonly arena?: ArenaId;
}

const LAYOUT = FIGHT_LAYOUT;

/** Health a saved gladiator starts a bout with: a beaten one steps in with at least 1 HP (heal at the temple, #191). */
export const boutStartHealth = (health: number | undefined) => (health === undefined ? undefined : Math.max(1, health));
/** seconds before the opponent answers */
const ENEMY_PAUSE = 0.5;

/** Feet to plume of the tallest look, in stage pixels: the action bar stays above it on phones. */
const FIGHTER_HEIGHT = 11.5 * UNIT;
const PROFILES: readonly AiProfile[] = ['aggressor', 'defender'];
const pause = (sec: number) => new Promise<void>((r) => setTimeout(r, sec * 1000));

/**
 * The arena fight (#12): the player picks from the action bar (#147), the opponent's AI (#6) answers after a short pause,
 * CombatPresenter animates every action and the HUD follows. The menu opens only when the player's action can be chosen,
 * never during an animation. At 0 HP the result screen offers a rematch or the way back to the title.
 * Pre-fight passes the two gladiators it showed; a direct visit (`?view=arena[&tier=N][&ai=aggressor|defender][&shield=N][&eshield=N]
 * [&weapon=id][&eweapon=id][&techniques=all|feint_step,…][&etechniques=…]`) uses random ones.
 */
export async function showArena(
  context: SceneContext, fighters?: readonly [ArenaFighter, ArenaFighter], options: ArenaOptions = {},
): Promise<SceneUpdate> {
  const { world, params, ui, add, rigs } = context;
  const askedArena = params.get('arena');
  const themeId: ArenaId = options.arena ?? (isArenaId(askedArena) ? askedArena : 'pulpport');
  const arena = new Container();
  world.addChild(arena);
  // the painted stands come alive (#52): over the backdrop, under the fighters
  const crowdFx = await buildArenaStage(arena, themeId);

  const tp = params.get('tier');
  const tier = tp ? +tp : undefined;
  // a direct visit may hand out shields (#273): `&shield=3&eshield=6` (the look's shield becomes a real one in the bout)
  const shieldOf = (key: string) => ({
    ...(params.has(key) && { shield: +params.get(key)! }),
    // and weapons (#258): `&weapon=trident5&eweapon=sword3`
    ...(params.has(key.replace('shield', 'weapon')) && { weapon: params.get(key.replace('shield', 'weapon'))! }),
  });
  /** a direct visit's `&weapon=` / `&eweapon=` is the weapon really fought with, not only shown */
  const devLoadout = (look: Look, key: string) => ({ ...loadoutFromLook(look), ...(params.has(key) && { weapon: look.weapon }) });
  // &might=17&emight=5: try fighters of different Might (and so of different height)
  const mightOf = (key: string) => (params.has(key) ? { attributes: { might: Math.max(0, Math.floor(+params.get(key)!) || 0) } } : {});
  const [player, firstEnemy]: readonly [ArenaFighter, ArenaFighter] = fighters ?? [
    { name: 'Player', look: { ...randomLook(tier), ...shieldOf('shield') }, ...mightOf('might') },
    { name: 'Opponent', look: { ...randomLook(tier), ...shieldOf('eshield') }, ...mightOf('emight') },
  ];
  let enemy: ArenaFighter = firstEnemy;
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
    fx, unit: UNIT, layout: LAYOUT, floorY: FEET_Y, sound: true, crowd, renderer: context.app.renderer,
    onState: (s) => hud.setState(s),
  });

  // the player's turn: open the menu with the options the core allows and wait for a click
  let choose: ((action: CombatAction | CombatSlotAction | TargetedAttack) => void) | null = null;
  const menu = new ActionBar((action) => {
    const resolve = choose;
    choose = null;
    resolve?.(action);
  });
  arena.on('destroyed', () => menu.destroy());
  const playerPicker: ActionPicker = (state, options, slots) => new Promise((resolve) => {
    choose = resolve;
    // aimed attacks (#195): the zone chances of this turn and the opponent's armour per zone
    const zones = (['quick', 'normal', 'power'] as const).flatMap((a) => getAttackZoneOptions(state, a));
    menu.open(options, slots, { zones, armour: state.fighters.enemy.armourByZone }, state.fighters.player.net === true,
      state.fighters.player.techniques);
  });

  ui.innerHTML = '<a href="?view=title">title</a> · <a href="?view=prefight">new opponent</a> · '
    + '<a href="?view=arena&ai=aggressor">vs aggressor</a> · <a href="?view=arena&ai=defender">vs defender</a>';

  let career = options.career;
  const spendPoints = async (character: SavedCharacter) => {
    career = await openLevelUp(character, careerLoadout(character), saveGame);
    return career;
  };

  let seed = params.has('seed') ? Math.floor(+params.get('seed')!) : Math.floor(Math.random() * 1e9);
  // Escape asks before leaving, but only while a bout runs: the result screen has its own Escape (Leave)
  let fighting = false;
  leaveFightOnEscape(() => fighting);
  void (async () => {
    for (;;) {
      const start = createCombat(seed,
        {
          name: player.name, attributes: career?.attributes ?? player.attributes,
          level: career?.level ?? player.level,
          // the saved gladiator fights with the gear screen's gear (#197): weapon, forge levels, enchantments
          equipment: career ? careerLoadout(career) : devLoadout(player.look, 'weapon'),
          // skills learned on the skill screen (#54) work in the fight
          skills: career?.skills,
          // the Masters' techniques learned in the story (#295); a direct visit may hand them out: `&techniques=all`
          techniques: career ? learnedTechniques(storyOf(career)) : player.techniques ?? parseTechniques(params.get('techniques')),
          // health carries over between bouts and potions from the temple sit in the combat slots (#191)
          ...(career && { health: boutStartHealth(career.health), slots: templeCombatSlots(career.inventory) }),
        },
        {
          name: enemy.name, attributes: enemy.attributes, level: enemy.level, equipment: enemy.equipment ?? devLoadout(enemy.look, 'eweapon'),
          techniques: enemy.techniques ?? (career ? [] : parseTechniques(params.get('etechniques'))),
        });
      presenter.reset(start);
      menu.setVisible(true);
      fighting = true;
      const outcome = await runFight(start, {
        pickers: { player: playerPicker, enemy: enemy.nemesis ? nemesisPicker(enemy.nemesis, seed ^ 0x85ebca6b) : aiPicker(enemy.bout?.profile ?? enemy.profile ?? profile, seed ^ 0x85ebca6b) },
        present: (events, after) => presenter.present(events, after),
        pause: (next: FighterSide) => (next === 'enemy' ? pause(ENEMY_PAUSE) : Promise.resolve()),
      });
      fighting = false;
      menu.close();
      menu.setVisible(false);
      // let the death and victory poses land before the result covers them
      await pause(1.2);
      let progress: FightProgress | undefined;
      let story: StoryScene | undefined;
      let payout: FightPayout | undefined;
      if (career) {
        // health after the bout and the potions left (#191) go to the save with the XP
        // and a bout takes a day of the story calendar (#291)
        const afterSand = settleTempleCombat(career, outcome.state.fighters.player);
        // a defeat leaves half health (#45), so the next bout can always be fought
        const settled = passTime(outcome.state.winner === 'enemy' ? recoverFromDefeat(afterSand) : afterSand, 'fight');
        // achievements (#203): the bout first, then the level it ended on; the result screen keeps working on `after`
        const fightId = `${Date.now().toString(36)}-${seed}`;
        // the nemesis (#209): a victor becomes one, beating it ends the feud; a rematch fights the updated one
        const feud = afterBout(settled, enemy, seed, fightId, outcome.state, outcome.events);
        if (feud.notice) showNotice(feud.notice.kicker, feud.notice.title, feud.notice.text);
        if (enemy.nemesis) enemy = { ...enemy, nemesis: feud.character.nemesis };
        // a league bout won goes on the ladder (#58); the champion's fall clears the league
        const leagueWon = outcome.state.winner === 'player' && enemy.bout ? recordLeagueWin(feud.character, enemy.bout.id) : feud.character;
        // a champion beaten for the first time opens the next page of the story (#64), after the result is saved
        if (leagueWon !== feud.character && enemy.bout) story = sceneAfter(enemy.bout.id);
        if (leagueWon !== feud.character) {
          const next = nextBout(leagueWon);
          showNotice('League', `${enemy.name} is beaten`, next ? `Next on the ladder: ${next.bout.name}.` : 'Every league with fighters is cleared.');
        }
        // the tavern's tasks (#65): a bout may finish one; it is paid in the tavern
        const tasks = recordQuestBout(leagueWon, tallyBout(outcome.state, outcome.events));
        for (const q of tasks.completed) showNotice('Tavern', `${q.title} done`, 'Collect your pay at the tavern.');
        const fought = recordForCareer(tasks.character, { type: 'fight', id: fightId, state: outcome.state, events: outcome.events });
        // gold, XP and forge materials go to the save at once (#43); a prize weapon waits for the reward scroll
        const reward = getFightReward(outcome.state, fightId, championPrizeId(enemy.bout?.id));
        if (reward) payout = payFightReward(fought.character, reward);
        progress = payout?.progress ?? { earned: 0, before: fought.character, after: fought.character };
        const leveled = recordForCareer(progress.after, { type: 'level', level: progress.after.level });
        progress = { ...progress, after: leveled.character };
        career = progress.after;
        showAchievements([...fought.unlocked, ...leveled.unlocked]);
        // the bar still shows the XP if saving fails; the next fight starts from it again
        await saveGame(career).catch(() => undefined);
      }
      if (story) {
        await playStory(story);
        story = undefined;
      }
      // a won fight shows its spoils; a defeat pays no gold, so it goes straight to the result
      if (career && progress && payout && outcome.state.winner === 'player') {
        const { offer } = payout;
        if (await openRewardScroll(payout.reward, offer) && offer) {
          career = takePrizeWeapon(career, offer.id);
          progress = { ...progress, after: career };
          await saveGame(career).catch(() => undefined);
        }
      }
      const choice = await openFightResult(context, {
        player, enemy, summary: summarizeFight(outcome.events), progress, spendPoints: career ? spendPoints : undefined,
        nextOpponent: true,
      });
      if (choice === 'leave') {
        // a career fight goes back to the town (#30); a quick bout to the title
        location.search = career ? '?view=town' : '?view=title';
        return;
      }
      // after a won league bout "Next opponent" is the next fighter on the ladder (#45)
      const ladder = choice === 'next' && enemy.bout && career && outcome.state.winner === 'player' ? nextBout(career) : undefined;
      if (ladder) {
        location.search = boutUrl(ladder.bout.id);
        return;
      }
      if (choice === 'next') {
        // #187: same gear, at most 5% stronger, at most one level above the player
        enemy = enemy.successor
          ?? { ...nextOpponent(enemy, career?.level ?? player.level ?? 1), nemesis: undefined, bout: undefined, equipment: undefined, profile: undefined };
        await E.setLook(drawableLook(context.kit, enemy.look));
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
    const gap = hud.panelGap;
    const s = world.scale.x;
    const links = ui.getBoundingClientRect();
    menu.place({
      left: world.position.x + gap.left * s, right: world.position.x + gap.right * s, bottom: world.position.y + gap.bottom * s,
      ceiling: (links.top < 60 ? links.bottom : 0) + 6,
      floor: world.position.y + (FEET_Y - FIGHTER_HEIGHT * Math.max(P.stature, E.stature)) * s,
    });
    for (const [rig, g] of [[P, shadows[0]], [E, shadows[1]]] as const) {
      // a taller fighter's pelvis rests higher (stature): that is not a jump
      const lift = Math.max(0, (FEET_Y - PELVIS_ABOVE_FEET * rig.scale - rig.view.y) / UNIT);
      g.position.set(rig.view.x + 0.35 * UNIT * rig.facing, FEET_Y);
      g.alpha = Math.max(0.25, 1 - lift * 0.18);
      g.width = 5.2 * rig.scale * Math.max(0.6, 1 - lift * 0.08);
    }
  };
}
