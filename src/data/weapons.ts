import { ITEMS } from './equipment';

export const WEAPON_FAMILIES = ['sword', 'axe', 'spear', 'hammer'] as const;
export type WeaponFamily = (typeof WEAPON_FAMILIES)[number];
export type DamageType = 'cut' | 'pierce' | 'crush';

export interface Weapon {
  readonly id: string;
  readonly family: WeaponFamily;
  readonly tier: number;
  readonly name: string;
  readonly damageType: DamageType;
  readonly damage: number;
  /** Attack speed multiplier, where 1 is the base speed. */
  readonly speed: number;
  /** Reach in logical combat units. */
  readonly range: number;
  readonly minLevel: number;
  readonly minMight: number;
  readonly price: number;
}

const TIERS = [
  { name: 'Scrapwood', damage: 4, minMight: 0 },
  { name: 'Pressed Pulp', damage: 6, minMight: 1 },
  { name: 'Layered Card', damage: 8, minMight: 2 },
  { name: 'Riveted Card', damage: 11, minMight: 3 },
  { name: 'Bronze Foil', damage: 14, minMight: 5 },
  { name: 'Iron Laminate', damage: 18, minMight: 7 },
  { name: 'Woven Steel', damage: 22, minMight: 9 },
  { name: 'Legion Plate', damage: 27, minMight: 11 },
  { name: 'Champion', damage: 33, minMight: 14 },
  { name: 'Gilded Legend', damage: 40, minMight: 18 },
];

interface FamilyBalance {
  name: string;
  damageType: DamageType;
  damageBonus: number;
  speed: number;
  range: number;
  mightBonus: number;
  armourPriceShare: number;
}

const FAMILIES: Record<WeaponFamily, FamilyBalance> = {
  sword: { name: 'Sword', damageType: 'cut', damageBonus: 0, speed: 1, range: 2, mightBonus: 0, armourPriceShare: 0.45 },
  axe: { name: 'Axe', damageType: 'cut', damageBonus: 2, speed: 0.88, range: 2, mightBonus: 2, armourPriceShare: 0.5 },
  spear: { name: 'Spear', damageType: 'pierce', damageBonus: 0, speed: 1.05, range: 3, mightBonus: 1, armourPriceShare: 0.55 },
  hammer: { name: 'Hammer', damageType: 'crush', damageBonus: 4, speed: 0.72, range: 1.5, mightBonus: 4, armourPriceShare: 0.6 },
};

export const WEAPONS: readonly Weapon[] = TIERS.flatMap((balance, index) => {
  const tier = index + 1;
  const armour = ITEMS.filter((piece) => piece.tier === tier);
  if (!armour.length) throw new Error(`Missing armour prices for weapon tier ${tier}`);

  const setPrice = armour.reduce((total, piece) => total + piece.price, 0);
  const minLevel = Math.max(...armour.map((piece) => piece.minLevel));
  return WEAPON_FAMILIES.map((family) => {
    const profile = FAMILIES[family];
    return {
      id: `${family}${tier}`,
      family,
      tier,
      name: `${balance.name} ${profile.name}`,
      damageType: profile.damageType,
      damage: balance.damage + profile.damageBonus,
      speed: profile.speed,
      range: profile.range,
      minLevel,
      minMight: balance.minMight + profile.mightBonus,
      // Price uses the actual sum of the five sold pieces and rounds to the same 5-gold increment.
      price: Math.round(setPrice * profile.armourPriceShare / 5) * 5,
    };
  });
});

export function weapon(family: WeaponFamily, tier: number): Weapon | undefined {
  return WEAPONS.find((entry) => entry.family === family && entry.tier === tier);
}
