import { Container, Sprite } from 'pixi.js';
import { FEET_Y, PELVIS_ABOVE_FEET, UNIT, groundShadowTexture, randomLook } from './common';
import type { SceneContext } from './common';

export async function showArena({ world, bgTex, params, ui, add }: SceneContext) {
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
