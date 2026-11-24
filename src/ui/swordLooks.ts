import { weapon } from '../data/weapons';

/** The swords the wardrobe offers (#182): the gladius, then one per armour tier, 1 = wood and bone … 10 = gold. */
export const SWORD_TIERS = 10;

/** `Look.weapon` of the n-th choice: 0 = 'gladius', 1–10 = 'sword1'…'sword10' (sprites `weapon_sword<tier>`, #36). */
export const swordId = (choice: number) => (choice === 0 ? 'gladius' : `sword${choice}`);

/** The sword that matches a full armour set of this tier (0 = no set: the gladius). */
export const swordForSet = (setTier: number) => Math.max(0, Math.min(SWORD_TIERS, setTier));

/**
 * What the puppet can show for a choice: the sword itself when its sprite is in the kit, otherwise the gladius,
 * so the hand is never empty while the art for that tier is still missing.
 */
export function shownSword(choice: number, hasSprite: (key: string) => boolean): { weapon: string; missing: boolean } {
  const id = swordId(choice);
  return hasSprite(`weapon_${id}`) ? { weapon: id, missing: false } : { weapon: 'gladius', missing: choice !== 0 };
}

/** Name for the wardrobe row: the catalogue sword of that tier, or the gladius. */
export function swordName(choice: number): string {
  if (choice === 0) return 'Gladius';
  return `${choice}. ${weapon('sword', choice)?.name ?? 'Sword'}`;
}
