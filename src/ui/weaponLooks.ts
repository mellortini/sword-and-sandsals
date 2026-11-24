import { WEAPON_FAMILIES, weapon } from '../data/weapons';
import type { WeaponFamily } from '../data/weapons';

/** Weapon tiers the wardrobe offers (#182, #185): 0 = the starting gladius, 1 = wood and bone … 10 = gold, like the armour sets. */
export const WEAPON_TIERS = 10;
export { WEAPON_FAMILIES };

/** A wardrobe choice: a weapon family and a tier (tier 0 is the gladius whatever the family). */
export interface WeaponChoice {
  readonly family: WeaponFamily;
  readonly tier: number;
}

/** `Look.weapon` of a choice: 'gladius', or the catalogue id 'sword3', 'axe7'… (sprites `weapon_<family><tier>`, #36 / #184). */
export const weaponId = ({ family, tier }: WeaponChoice) => (tier === 0 ? 'gladius' : `${family}${tier}`);

/** The weapon tier that matches a full armour set of this tier (0 = no set: the gladius). */
export const tierForSet = (setTier: number) => Math.max(0, Math.min(WEAPON_TIERS, setTier));

/**
 * What the puppet can show for a choice: the weapon itself when its sprite is in the kit, otherwise the gladius,
 * so the hand is never empty while the art for that weapon is still missing.
 */
export function shownWeapon(choice: WeaponChoice, hasSprite: (key: string) => boolean): { weapon: string; missing: boolean } {
  const id = weaponId(choice);
  return hasSprite(`weapon_${id}`) ? { weapon: id, missing: false } : { weapon: 'gladius', missing: choice.tier !== 0 };
}

/** Family name for the wardrobe row. */
export const familyName = (family: WeaponFamily) => family[0].toUpperCase() + family.slice(1);

/** Name for the wardrobe's tier row: the catalogue weapon of that family and tier, or the gladius. */
export function weaponName(choice: WeaponChoice): string {
  if (choice.tier === 0) return 'Gladius';
  return `${choice.tier}. ${weapon(choice.family, choice.tier)?.name ?? familyName(choice.family)}`;
}
