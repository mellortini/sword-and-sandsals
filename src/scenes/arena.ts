import { Container, Sprite } from 'pixi.js';
import { CombatHud } from '../ui/hud';
import { FEET_Y, H, PELVIS_ABOVE_FEET, UNIT, W, groundShadowTexture, randomLook } from './common';
import type { SceneContext } from './common';
import type { Look } from '../rig/PaperRig';

export interface ArenaFighter {
  readonly look: Look;
  readonly name: string;
}

/** `fighters` (player, enemy) come from the pre-fight screen; without them the arena shows two random gladiators. */
export async function showArena({ world, bgTex, params, ui, add }: SceneContext, fighters?: readonly [ArenaFighter, ArenaFighter]) {
  const arena = new Container();
  world.addChild(arena);
  arena.addChild(new Sprite(bgTex));
  const gsh = groundShadowTexture();
  const tp = params.get('tier');
  const looks = fighters?.map((f) => f.look) ?? [randomLook(tp ? +tp : undefined), randomLook(tp ? +tp : undefined)];
  for (const [i, x] of [[0, 640], [1, 1290]] as const) {
    const g = new Sprite(gsh);
    g.anchor.set(0.5); g.blendMode = 'multiply'; g.tint = 0x8a5a48;
    g.width = 5.2 * UNIT; g.height = 1.3 * UNIT;
    g.position.set(x + 0.35 * UNIT * (i ? -1 : 1), FEET_Y);
    arena.addChild(g);
    await add(looks[i], x, FEET_Y - PELVIS_ABOVE_FEET * UNIT, UNIT, i ? -1 : 1, arena, i * 0.7);
  }
  // The arena preview opens with full meters. The turn loop will pass live fighter state to the same HUD.
  const full = { health: 70, energy: 40, stats: { maxHealth: 70, maxEnergy: 40 } };
  const hud = new CombatHud({
    fighters: { player: { ...full, name: fighters?.[0].name ?? 'Player' }, enemy: { ...full, name: fighters?.[1].name ?? 'Opponent' } },
  }, W, H);
  arena.addChild(hud);
  ui.innerHTML = '<a href="?view=wardrobe">garderoba</a> · <a href="?view=lineup">10 zestawów</a> · <a href="?view=faces">twarze</a> · <a href="?">losuj</a>';
  return (dt: number) => hud.update(dt);
}
