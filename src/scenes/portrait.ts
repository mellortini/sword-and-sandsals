import { Container, Graphics } from 'pixi.js';
import type { Look, PaperRig } from '../rig/PaperRig';
import { fittedText } from '../ui/paperWidgets';
import type { SceneContext } from './common';

export const PORTRAIT_W = 420;
export const PORTRAIT_H = 500;
const PORTRAIT_SCALE = 56;
/** top of the portrait window in rig units above the pelvis (room for crests and plumes) */
const PORTRAIT_TOP = 8.6;

export interface PortraitSubject {
  readonly name: string;
  readonly look: Look;
}

/**
 * Framed head-and-shoulders cut of a still puppet at (x, y) with a name plate under it.
 * The puppet goes into `context.rigs`; the caller removes it when the screen closes.
 * Placeholder for the portrait component (#25).
 */
export async function portraitCard(root: Container, add: SceneContext['add'], who: PortraitSubject, subtitle: string,
  x: number, y: number, facing: 1 | -1): Promise<PaperRig> {
  const frame = new Graphics()
    .roundRect(x - 10, y - 10, PORTRAIT_W + 20, PORTRAIT_H + 20, 18)
    .fill({ color: 0x332124, alpha: 0.94 })
    .stroke({ color: 0x815a46, width: 3 })
    .roundRect(x, y, PORTRAIT_W, PORTRAIT_H, 12)
    .fill(0x4b3a44);
  root.addChild(frame);

  const wu = PORTRAIT_W / PORTRAIT_SCALE;
  const hu = PORTRAIT_H / PORTRAIT_SCALE;
  // a mirrored sprite grows to the left of its position, so the enemy is anchored at the frame's right edge
  const rig = await add(who.look, facing === 1 ? x : x + PORTRAIT_W, y, PORTRAIT_SCALE, facing, root, 0, true);
  rig.crop(0.3 - wu / 2, PORTRAIT_TOP - hu, 0.3 + wu / 2, PORTRAIT_TOP);

  const cx = x + PORTRAIT_W / 2;
  const plateY = y + PORTRAIT_H + 26;
  root.addChild(
    new Graphics()
      .roundRect(x + 10, plateY, PORTRAIT_W - 20, 96, 8)
      .fill(0x694630)
      .stroke({ color: 0xb58758, width: 3 }),
    fittedText(who.name, cx, plateY + 32, PORTRAIT_W - 60, { fontSize: 38, fontWeight: 'bold', fill: '#fff0cb' }),
    fittedText(subtitle, cx, plateY + 72, PORTRAIT_W - 60, { fontSize: 24, fill: '#f4d3a7' }),
  );
  return rig;
}

/** Takes the puppets a screen added out of the shared ticker list. */
export function removeRigs<T>(rigs: T[], added: readonly T[]) {
  for (const r of added) {
    const i = rigs.indexOf(r);
    if (i >= 0) rigs.splice(i, 1);
  }
}
