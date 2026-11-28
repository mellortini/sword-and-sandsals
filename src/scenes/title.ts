import { Container } from 'pixi.js';
import { openSettings } from '../ui/settings';
import { startMusic } from '../audio/music';
import { openCredits, showTitleMenu } from '../ui/titleMenu';
import { titleEntries } from '../ui/titleRules';
import { buildArenaStage } from './arenaStage';
import { randomLook } from './common';
import type { SceneContext } from './common';
import { addFighterPair } from './fighterPair';
import { liveCrowd } from './liveCrowd';
import { loadSavedGladiator } from './savedGladiator';

/** the two gladiators stand to the right of the poster */
const FIGHTERS = [{ x: 1075, facing: 1 }, { x: 1655, facing: -1 }] as const;

/**
 * `?view=title`: the arena as in a fight (soft stands, vignette, a crowd that cheers), two idle gladiators and the fight
 * poster with the main menu (src/ui/titleMenu.ts).
 */
export async function showTitle(context: SceneContext) {
  const { world, ui } = context;
  const root = new Container();
  world.addChild(root);
  const tickCrowd = liveCrowd(await buildArenaStage(root));

  // the saved gladiator (if any) stands on the left of the pair
  const saved = await loadSavedGladiator();
  const strong = () => randomLook(5 + Math.floor(Math.random() * 6));
  await addFighterPair(context, root, [saved?.look ?? strong(), strong()], FIGHTERS);

  // the town's theme plays over the title (#73); the page changes view by reloading
  startMusic('town');
  ui.innerHTML = '';
  showTitleMenu(titleEntries(saved), async (entry) => {
    if (entry.view) location.search = `?view=${entry.view}`;
    else if (entry.id === 'settings') await openSettings();
    else await openCredits();
  });

  return tickCrowd;
}
