/// <reference types="vite/client" />
/**
 * Pictures of goods for the shop boards (#267): the kit's own sprites (assets/chars/kit/sprites), so what is on the
 * board is exactly what the gladiator will wear. Weapons lie horizontally in the kit (hilt left): boards stand them up.
 * The armourer's mannequin is the puppet in carved wood, with no face, hair or beard (PaperRig `mannequin`).
 */
import type { Renderer } from 'pixi.js';
import { readWeaponEnchantment } from '../core/enchant';
import { readForgedItem } from '../core/forge';
import { ITEMS } from '../data/equipment';
import { WEAPONS } from '../data/weapons';
import { DEFAULT_LOOK, PaperRig } from '../rig/PaperRig';
import type { EquipSlot, Kit, Look } from '../rig/PaperRig';

const SPRITES = () => `${import.meta.env.BASE_URL}chars/kit/sprites/`;

/** which piece of a set shows it best on a card */
const PIECE: Readonly<Record<EquipSlot, string>> = { helmet: '', shoulders: '', armor: '_torso', greaves: '_shin', boots: '_foot' };

/** the plain catalogue id under a forged or enchanted one ("sword3" for an enchanted, upgraded sword3) */
export function baseId(id: string): string {
  const unenchanted = readWeaponEnchantment(id).baseId ?? id;
  return readForgedItem(unenchanted).baseId ?? unenchanted;
}

/** picture of an item; `blade` = a weapon lying flat, to be turned upright */
export function itemPicture(id: string): { src: string; blade: boolean } | undefined {
  const base = baseId(id);
  if (WEAPONS.some((w) => w.id === base)) return { src: `${SPRITES()}weapon_${base}.png`, blade: true };
  const piece = ITEMS.find((i) => i.id === base);
  if (piece) return { src: `${SPRITES()}${piece.slot}${piece.tier}${PIECE[piece.slot]}.png`, blade: false };
  return undefined;
}

/** carved wood, a shade lighter than the shop's furniture */
export const MANNEQUIN_WOOD = '#c99a62';
/** window around the pelvis (rig units, y up): feet to the top of a crest */
export const MANNEQUIN_CROP = { x0: -3.6, y0: -5.4, x1: 4.4, y1: 8.2 } as const;
/** where each part's label sits on the mannequin, in the same units */
export const MANNEQUIN_PARTS: Readonly<Record<EquipSlot, readonly [number, number]>> = {
  helmet: [0.4, 7.4], shoulders: [-1.6, 5.2], armor: [0.6, 3.0], greaves: [-0.6, -2.4], boots: [1.0, -4.9],
};

/**
 * One wooden mannequin that redraws on request, wearing the armour pieces of `look` and nothing in its hands.
 * Calls queue up, so the newest look comes out last.
 */
export function mannequin(kit: Kit, renderer: Renderer, scale = 60): (look: Partial<Look>) => Promise<HTMLCanvasElement> {
  const rig = new PaperRig(kit, { scale, facing: 1, mannequin: MANNEQUIN_WOOD });
  rig.crop(MANNEQUIN_CROP.x0, MANNEQUIN_CROP.y0, MANNEQUIN_CROP.x1, MANNEQUIN_CROP.y1);
  let queue: Promise<unknown> = Promise.resolve();
  return (look) => {
    const job = queue.then(async () => {
      await rig.setLook({ ...DEFAULT_LOOK, beard: 0, hair: 0, weapon: '', shield: 0, ...look });
      rig.render(renderer);
      return renderer.extract.canvas({ target: rig.view }) as HTMLCanvasElement;
    });
    queue = job.catch(() => undefined);
    return job;
  };
}
