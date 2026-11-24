import { Container, Sprite } from 'pixi.js';
import { deriveStats, resolveAttributes } from '../core/stats';
import type { Attributes, EquipmentLoadout } from '../core/types';
import { EQUIP_SLOTS } from '../rig/PaperRig';
import type { Look } from '../rig/PaperRig';
import { paperButton, screenTitle } from '../ui/paperWidgets';
import { StatPanel } from '../ui/statPanel';
import { comparisonRows } from '../ui/statRows';
import type { ComparedFighter } from '../ui/statRows';
import { showArena } from './arena';
import { W, randomLook } from './common';
import { loadSavedGladiator } from './savedGladiator';
import type { SceneContext, SceneUpdate } from './common';
import { PORTRAIT_W, portraitCard, removeRigs } from './portrait';

export interface PreFightFighter extends ComparedFighter {
  readonly look: Look;
}

export type PreFightChoice = 'fight' | 'retreat';

/** Equipment tiers worn on the puppet are the same numbers the combat core reads. */
export function loadoutFromLook(look: Look): EquipmentLoadout {
  const loadout: EquipmentLoadout = {};
  for (const slot of EQUIP_SLOTS) if (look[slot] > 0) loadout[slot] = look[slot];
  return loadout;
}

export function preFightFighter(name: string, level: number, look: Look, attributes: Partial<Attributes> = {}): PreFightFighter {
  const resolved = resolveAttributes(attributes);
  return { name, level, look, attributes: resolved, stats: deriveStats(resolved, loadoutFromLook(look)) };
}

const PANEL_W = 640;
const TOP = 170;

/**
 * Pre-fight comparison: two portraits, names, levels and a stat table, with Fight / Retreat.
 * Draws into `context.world`, resolves with the choice and removes everything it added.
 * Keyboard: Enter = Fight, Escape = Retreat.
 */
export async function openPreFight(context: SceneContext, player: PreFightFighter, enemy: PreFightFighter): Promise<PreFightChoice> {
  const { world, bgTex, rigs, add } = context;
  const root = new Container();
  world.addChild(root);

  const bg = new Sprite(bgTex);
  bg.tint = 0x6e5c58;
  root.addChild(bg, screenTitle('Arena bout', W / 2, 58));

  const rigsBefore = rigs.length;
  const sideX = (W - PANEL_W) / 2 - PORTRAIT_W - 60;
  await portraitCard(root, add, player, `Level ${player.level}`, sideX, TOP, 1);
  await portraitCard(root, add, enemy, `Level ${enemy.level}`, W - sideX - PORTRAIT_W, TOP, -1);
  // the shared ticker renders the portraits until the choice is made; then they are taken out of `rigs`
  const added = rigs.slice(rigsBefore);

  const panel = new StatPanel(comparisonRows(player, enemy), PANEL_W);
  panel.position.set((W - PANEL_W) / 2, TOP);
  root.addChild(panel);

  const buttonsY = TOP + panel.panelHeight + 44;
  return new Promise<PreFightChoice>((resolve) => {
    const keys = new AbortController();
    const done = (choice: PreFightChoice) => {
      keys.abort();
      removeRigs(rigs, added);
      root.destroy({ children: true });
      resolve(choice);
    };
    root.addChild(
      paperButton('Fight', W / 2 - 150, buttonsY, true, () => done('fight')),
      paperButton('Retreat', W / 2 + 150, buttonsY, false, () => done('retreat')),
    );
    window.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') done('fight');
      else if (e.key === 'Escape') done('retreat');
    }, { signal: keys.signal });
  });
}

const ENEMY_NAMES = ['Crixus Fold', 'Varro the Creased', 'Spiculus', 'Flamma Pulp', 'Tetraites', 'Priscus Vellum'];

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

/**
 * `?view=prefight[&tier=N]`: player (default attributes) against a random opponent.
 * Fight → arena with the same two gladiators; Retreat → a new opponent.
 */
export async function showPreFight(context: SceneContext): Promise<SceneUpdate> {
  // the saved gladiator fights unless the title's Quick bout asks for a random one
  const saved = context.params.get('gladiator') === 'random' ? null : await loadSavedGladiator();
  const tp = context.params.get('tier');
  // a saved gladiator meets opponents of the first tier until the leagues (#41) pick them
  const tier = tp ? Math.min(10, Math.max(1, +tp)) : saved ? 1 : 1 + Math.floor(Math.random() * 10);
  const player = saved
    ? preFightFighter(saved.name, saved.level, saved.look, saved.attributes)
    : preFightFighter('Player', 1, randomLook(tier));
  context.ui.innerHTML = '<a href="?view=arena">arena</a> · <a href="?view=wardrobe">garderoba</a>';

  let update: SceneUpdate | undefined;
  void (async () => {
    let choice: PreFightChoice;
    let enemy: PreFightFighter;
    do {
      enemy = randomEnemy(tier);
      choice = await openPreFight(context, player, enemy);
    } while (choice === 'retreat');
    context.ui.innerHTML = '';
    update = (await showArena(context, [
      { look: player.look, name: player.name, attributes: player.attributes, level: player.level },
      { look: enemy.look, name: enemy.name, attributes: enemy.attributes, level: enemy.level },
    ], { career: saved ?? undefined })) ?? undefined;
  })();
  return (dt) => update?.(dt);
}
