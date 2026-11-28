import { Container } from 'pixi.js';
import { deriveStats, resolveAttributes } from '../core/stats';
import type { Attributes, EquipmentLoadout } from '../core/types';
import { EQUIP_SLOTS } from '../rig/PaperRig';
import { isShieldTier } from '../rig/shield';
import type { Look } from '../rig/PaperRig';
import { goToTitle } from '../ui/backKey';
import { playBanner } from '../ui/banner';
import { showPreFightPoster } from '../ui/preFightPoster';
import type { PreFightChoice, PreFightPrize } from '../ui/preFightPoster';
import { comparisonRows } from '../ui/statRows';
import type { ComparedFighter } from '../ui/statRows';
import { boutStartHealth, showArena } from './arena';
import { careerLoadout } from '../ui/gearRules';
import { nemesisLine, nemesisRival } from '../ui/nemesisRules';
import { boutLook, findBout } from '../ui/leagueRules';
import { ROOKIE_ATTRIBUTES, isFirstBout } from '../ui/rookieRules';
import type { NemesisMemory } from '../core/nemesis';
import { H, W, randomLook } from './common';
import { loadSavedGladiator } from './savedGladiator';
import type { SceneContext, SceneUpdate } from './common';
import { buildArenaStage } from './arenaStage';
import { addFighterPair } from './fighterPair';
import { liveCrowd } from './liveCrowd';
import { ENEMY_NAMES } from './opponents';

export interface PreFightFighter extends ComparedFighter {
  readonly look: Look;
}

export type { PreFightChoice };

/** Equipment tiers worn on the puppet are the same numbers the combat core reads; a shield on the puppet is a real one (#273). */
export function loadoutFromLook(look: Look): EquipmentLoadout {
  const loadout: EquipmentLoadout = {};
  for (const slot of EQUIP_SLOTS) if (look[slot] > 0) loadout[slot] = look[slot];
  if (isShieldTier(look.shield)) loadout.offHand = `shield${look.shield}`;
  return loadout;
}

export function preFightFighter(
  name: string, level: number, look: Look, attributes: Partial<Attributes> = {}, loadout: EquipmentLoadout = loadoutFromLook(look),
): PreFightFighter {
  const resolved = resolveAttributes(attributes);
  return { name, level, look, attributes: resolved, stats: deriveStats(resolved, loadout) };
}

/** the two gladiators stand at both sides of the poster */
const FIGHTERS = [{ x: 255, facing: 1 }, { x: 1665, facing: -1 }] as const;

export interface PreFightLabels {
  readonly title?: string;
  /** a line under the opponent's name: the nemesis (#209) gets one about the feud */
  readonly enemyNote?: string;
  /** a champion speaks before the bout and puts a prize up */
  readonly quote?: string;
  readonly prize?: PreFightPrize;
  /** where the way back leads */
  readonly back?: string;
}

/**
 * Pre-fight comparison: the two gladiators on the sand and the fight poster between them (src/ui/preFightPoster.ts).
 * Resolves with Fight or Leave and removes everything it added; the arena behind is the caller's.
 */
export async function openPreFight(
  context: SceneContext, player: PreFightFighter, enemy: PreFightFighter, labels: PreFightLabels = {},
): Promise<PreFightChoice> {
  const root = new Container();
  context.world.addChild(root);
  const release = await addFighterPair(context, root, [player.look, enemy.look], FIGHTERS);
  const choice = await showPreFightPoster({
    title: labels.title ?? 'Arena bout', player: player.name, enemy: enemy.name, enemyNote: labels.enemyNote,
    quote: labels.quote, prize: labels.prize, rows: comparisonRows(player, enemy), back: labels.back ?? 'Menu',
  });
  release();
  root.destroy({ children: true });
  return choice;
}


/** Placeholder opponent until the enemy generator (#41): gear tier sets the level, a few extra attribute points. */
function randomEnemy(tier: number): PreFightFighter {
  const look = randomLook(tier);
  const level = Math.max(1, tier * 3 - 2 + Math.floor(Math.random() * 3));
  const bump = () => 5 + Math.floor(Math.random() * (2 + tier));
  const attributes: Attributes = {
    might: bump(), agility: bump(), precision: bump(), guard: bump(),
    vitality: bump(), stamina: bump(), charm: bump(), arcana: 5,
  };
  return preFightFighter(ENEMY_NAMES[Math.floor(Math.random() * ENEMY_NAMES.length)], level, look, attributes);
}

/** The easy opponent of a new gladiator's first bout: bare, level 1, weak attributes. */
function rookieEnemy(): PreFightFighter {
  const look = randomLook(1);
  for (const slot of EQUIP_SLOTS) look[slot] = 0;
  return preFightFighter(ENEMY_NAMES[Math.floor(Math.random() * ENEMY_NAMES.length)], 1, look, ROOKIE_ATTRIBUTES);
}

/**
 * `?view=prefight[&tier=N]`: the saved gladiator (or a random one) before a bout: a league bout picked on the ladder,
 * else a waiting nemesis, else a random opponent. Fight → arena with the same two gladiators; back → town for a saved
 * gladiator, the title for a random one.
 */
export async function showPreFight(context: SceneContext): Promise<SceneUpdate> {
  // the saved gladiator fights unless the address asks for a random one (a test bout)
  const saved = context.params.get('gladiator') === 'random' ? null : await loadSavedGladiator();
  const tp = context.params.get('tier');
  // a saved gladiator meets opponents of the first tier until the leagues (#41) pick them
  const tier = tp ? Math.min(10, Math.max(1, +tp)) : saved ? 1 : 1 + Math.floor(Math.random() * 10);
  const player = saved
    ? { ...preFightFighter(saved.name, saved.level, saved.look, saved.attributes, careerLoadout(saved)), health: boutStartHealth(saved.health) }
    : preFightFighter('Player', 1, randomLook(tier));
  context.ui.innerHTML = '';

  let update: SceneUpdate | undefined;
  void (async () => {
    // the arena of the fight, its crowd already cheering; the title banner (#15) runs over it, then the poster
    const arena = new Container();
    context.world.addChild(arena);
    const tickCrowd = liveCrowd(await buildArenaStage(arena));
    update = tickCrowd;
    await playBanner(context.world, context.app.ticker, ['Arena', 'Battle'], { width: W, y: H * 0.46 });

    const back = saved ? 'Town' : 'Menu';
    // a league bout chosen on the ladder (#58) comes first, then a waiting nemesis (#209)
    const bout = saved && context.params.get('bout') ? findBout(saved, context.params.get('bout')!) : undefined;
    const nemesis: NemesisMemory | undefined = bout ? undefined : saved?.nemesis;
    // a gladiator fresh from the creator starts against a rookie; an asked-for tier skips it
    const rookie = !bout && !nemesis && !tp && !!saved && isFirstBout(saved);
    let enemy: PreFightFighter;
    let labels: PreFightLabels = { back };
    if (bout) {
      enemy = preFightFighter(bout.name, bout.level, boutLook(bout), bout.setup.attributes, bout.setup.equipment);
      const champion = bout.champion;
      labels = champion ? {
        back, title: 'Champion bout', quote: champion.line,
        prize: { name: champion.weapon.name, damage: champion.weapon.damage, picture: `weapons/${champion.weapon.family}${champion.weapon.tier}.png` },
      } : { back, title: 'League bout' };
    } else if (nemesis && saved) {
      const rival = nemesisRival(nemesis, saved.level);
      enemy = preFightFighter(rival.name, rival.level, rival.look, rival.attributes, rival.equipment);
      labels = { back, title: 'Nemesis bout', enemyNote: nemesisLine(nemesis) };
    } else enemy = rookie ? rookieEnemy() : randomEnemy(tier);

    if (await openPreFight(context, player, enemy, labels) === 'leave') {
      if (saved) location.search = '?view=town';
      else goToTitle();
      return;
    }
    // the fight builds its own arena
    update = undefined;
    arena.destroy({ children: true });
    update = (await showArena(context, [
      { look: player.look, name: player.name, attributes: player.attributes, level: player.level },
      {
        look: enemy.look, name: enemy.name, attributes: enemy.attributes, level: enemy.level, nemesis,
        ...(bout && { bout: { id: bout.id, profile: bout.profile }, equipment: bout.setup.equipment }),
        // "Next opponent" after the rookie is an ordinary one, not another near-rookie
        ...(rookie && { profile: 'defender' as const, successor: randomEnemy(tier) }),
      },
    ], { career: saved ?? undefined })) ?? undefined;
  })();
  return (dt) => update?.(dt);
}
