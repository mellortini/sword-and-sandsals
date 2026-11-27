import type { Renderer } from 'pixi.js';
import { PaperRig } from '../rig/PaperRig';
import type { Kit, Look } from '../rig/PaperRig';
import { drawableLook } from './weaponLooks';

/** draws the gladiator in a look, standing, into a canvas for an HTML screen (the shop's try-on, #34) */
export type LookPreview = (look: Look) => Promise<HTMLCanvasElement>;

/** window around the pelvis (rig units, y up): feet to crest, sword arm and blade in front */
const CROP = { x0: -4.6, y0: -5.5, x1: 7.4, y1: 7.6 } as const;

/**
 * One still puppet that redraws on request. Calls queue up, so the newest look always comes out last; the puppet is
 * drawn only when asked, never per frame.
 */
export function lookPreview(kit: Kit, renderer: Renderer, scale = 40): LookPreview {
  const rig = new PaperRig(kit, { scale, facing: 1 });
  rig.crop(CROP.x0, CROP.y0, CROP.x1, CROP.y1);
  let queue: Promise<unknown> = Promise.resolve();
  return (look) => {
    const job = queue.then(async () => {
      await rig.setLook(drawableLook(kit, look));
      rig.render(renderer);
      return renderer.extract.canvas({ target: rig.view }) as HTMLCanvasElement;
    });
    queue = job.catch(() => undefined);
    return job;
  };
}
