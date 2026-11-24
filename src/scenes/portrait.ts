import { Container, Graphics } from 'pixi.js';
import type { Look } from '../rig/PaperRig';
import { fittedText } from '../ui/paperWidgets';
import { Portrait } from '../ui/portrait';
import type { SceneContext } from './common';

export const PORTRAIT_W = 420;
export const PORTRAIT_H = 500;

export interface PortraitSubject {
  readonly name: string;
  readonly look: Look;
}

/**
 * Framed head-and-shoulders portrait (#25) at (x, y) with a name plate under it. The puppet is drawn once,
 * not every frame; destroying `root` frees it.
 */
export async function portraitCard(root: Container, { kit, app }: Pick<SceneContext, 'kit' | 'app'>, who: PortraitSubject,
  subtitle: string, x: number, y: number, facing: 1 | -1): Promise<Portrait> {
  const portrait = await Portrait.create(kit, app.renderer, who.look, { width: PORTRAIT_W, height: PORTRAIT_H, facing });
  portrait.position.set(x, y);
  root.addChild(portrait);

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
  return portrait;
}
