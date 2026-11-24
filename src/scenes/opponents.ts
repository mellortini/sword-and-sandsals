import { resolveAttributes } from '../core/stats';
import type { Attributes } from '../core/types';
import { EQUIP_SLOTS } from '../rig/PaperRig';
import type { Look } from '../rig/PaperRig';

export const ENEMY_NAMES = ['Crixus Fold', 'Varro the Creased', 'Spiculus', 'Flamma Pulp', 'Tetraites', 'Priscus Vellum'];

/** At most this much stronger than the opponent just fought, counted on the sum of attributes (#187). */
export const NEXT_MAX_GAIN = 0.05;

export interface Opponent {
  readonly name: string;
  readonly look: Look;
  readonly attributes: Attributes;
  readonly level: number;
}

/**
 * The opponent after "Next opponent" (#187): the same gear (armour and weapon) as the one just fought, a new face and
 * name, the same attributes or up to 5% more in total (extra points land on random attributes, Arcana excepted),
 * and a level of at most the player's level + 1.
 */
export function nextOpponent(
  current: { name: string; look: Look; attributes?: Partial<Attributes>; level?: number },
  playerLevel: number,
  random: () => number = Math.random,
): Opponent {
  const pick = (n: number) => Math.floor(random() * n);
  const base = resolveAttributes(current.attributes);
  const keys = (Object.keys(base) as (keyof Attributes)[]).filter((k) => k !== 'arcana');
  const total = Object.values(base).reduce((a, b) => a + b, 0);
  const extra = Math.floor(total * NEXT_MAX_GAIN * random());
  const attributes = { ...base };
  for (let i = 0; i < extra; i++) attributes[keys[pick(keys.length)]]++;

  const look: Look = {
    ...current.look, skin: pick(10), face: pick(10), hair: pick(10), hairColor: pick(10), beard: pick(10),
  };
  for (const slot of EQUIP_SLOTS) look[slot] = current.look[slot];

  const others = ENEMY_NAMES.filter((n) => n !== current.name);
  const level = Math.max(1, Math.min(current.level ?? playerLevel, playerLevel + 1));
  return { name: others[pick(others.length)], look, attributes, level };
}
