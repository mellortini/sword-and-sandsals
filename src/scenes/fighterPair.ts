/** Two idle gladiators standing large on the sand at both sides of a poster (title and pre-fight screens). */
import { Sprite } from 'pixi.js';
import type { Container } from 'pixi.js';
import type { Look } from '../rig/PaperRig';
import { PELVIS_ABOVE_FEET, groundShadowTexture } from './common';
import type { SceneContext } from './common';

/** px of the 1920x1080 arena: where the feet are, and a gladiator's size in px per rig unit */
const FEET = 1000;
const SCALE = 52;

export interface PairPlace {
  readonly x: number;
  readonly facing: 1 | -1;
}

/**
 * Adds the two puppets (and their ground shadows) to `parent`. The returned function takes the puppets off the scene's
 * ticker: call it before destroying `parent`.
 */
export async function addFighterPair(
  { add, rigs }: SceneContext, parent: Container, looks: readonly [Look, Look], places: readonly [PairPlace, PairPlace],
): Promise<() => void> {
  const shadow = groundShadowTexture();
  const added: unknown[] = [];
  for (const [i, { x, facing }] of places.entries()) {
    const g = new Sprite(shadow);
    g.anchor.set(0.5); g.blendMode = 'multiply'; g.tint = 0x8a5a48;
    g.width = 5.2 * SCALE; g.height = 1.3 * SCALE;
    g.position.set(x + 0.35 * SCALE * facing, FEET);
    parent.addChild(g);
    added.push(await add(looks[i], x, FEET - PELVIS_ABOVE_FEET * SCALE, SCALE, facing, parent, i * 0.7));
  }
  return () => {
    for (let i = rigs.length - 1; i >= 0; i--) if (added.includes(rigs[i].rig)) rigs.splice(i, 1);
  };
}
