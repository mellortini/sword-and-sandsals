/**
 * Shields (#273): the off-hand item that makes a block cost something. Ten tiers that follow the armour sets (sprites
 * `shield1..10`, #38): a round parma up to tier 4, a scutum from the legion era on. A block stops the blow as before,
 * but the shield takes the blow's raw force (`shieldDamage` in core/stats) off its own health; at 0 it breaks for the
 * rest of the bout. Health is back to full after the fight.
 * First-pass balance: a shield takes about four normal blows of a same-tier opponent.
 */
import { ITEMS, SET_NAMES } from './equipment';

export interface Shield {
  readonly id: string;
  readonly tier: number;
  readonly name: string;
  readonly set: string;
  /** what the shield can take before it breaks */
  readonly health: number;
  readonly weight: number;
  readonly price: number;
  readonly minLevel: number;
}

const NAMES = ['Wicker Parma', 'Hide Parma', 'Linen Parma', 'Studded Parma', 'Bronze Scutum', 'Iron Scutum',
  'Veteran Scutum', 'Legion Scutum', "Champion's Scutum", 'Gilded Scutum'];
const HEALTH = [24, 32, 42, 56, 72, 92, 112, 138, 168, 204];
/** a shield costs this share of its tier's full armour set */
const PRICE_SHARE = 0.25;
const WEIGHT_SHARE = 0.25;

export const SHIELDS: readonly Shield[] = NAMES.map((name, i) => {
  const tier = i + 1;
  const set = ITEMS.filter((piece) => piece.tier === tier);
  const setPrice = set.reduce((total, piece) => total + piece.price, 0);
  const setWeight = set.reduce((total, piece) => total + piece.weight, 0);
  return {
    id: `shield${tier}`, tier, name, set: SET_NAMES[i], health: HEALTH[i],
    weight: Math.max(0.5, Math.round(setWeight * WEIGHT_SHARE * 2) / 2),
    price: Math.round((setPrice * PRICE_SHARE) / 5) * 5,
    minLevel: Math.max(...set.map((piece) => piece.minLevel)),
  };
});

export function findShield(id?: string): Shield | undefined {
  return id === undefined ? undefined : SHIELDS.find((shield) => shield.id === id);
}
