import { findWeapon } from '../data/weaponLookup';
import type { Weapon } from '../data/weapons';
import { readWeaponEnchantment } from './enchant';
import type { WeaponEnchantment } from './enchant';
import { readForgedItem } from './forge';
import type { StatusKind } from './status';
import type { AttackKind } from './types';

export { findWeapon } from '../data/weaponLookup';

export interface CombatWeapon {
  readonly id: string;
  readonly family: Weapon['family'] | 'daggers';
  readonly damage: number;
  readonly range: number;
  readonly enchantment?: WeaponEnchantment;
}

interface WeaponMove {
  readonly strikes: number;
  readonly damageMultiplier: number;
  readonly armourMultiplier: number;
  readonly knockback: number;
  readonly status?: StatusKind;
}

// Starting pair for the combat prototype. Shop tiers for daggers are separate data.
const DAGGERS: CombatWeapon = { id: 'daggers', family: 'daggers', damage: 4, range: 1.5 };
export const DEFAULT_WEAPON_REACH = 2;
const STANDARD: WeaponMove = { strikes: 1, damageMultiplier: 1, armourMultiplier: 1, knockback: 0 };

export function combatWeapon(id?: string): CombatWeapon | undefined {
  if (id === DAGGERS.id) return DAGGERS;
  // an id is `<weapon>[^+<level>][~<element>~<power>]`: forge upgrade inside, enchantment outside
  const { baseId: forgedId, enchantment } = readWeaponEnchantment(id);
  const { baseId, level } = readForgedItem(forgedId);
  const weapon = findWeapon(baseId);
  if (!weapon || !id || (!enchantment && level === 0)) return weapon;
  return { ...weapon, id, damage: weapon.damage + level, ...(enchantment && { enchantment }) };
}

/**
 * Spears and hammers take both hands (sprite `grip2`, #36): no hand is left for a shield. A dagger is one-handed.
 * The trident's other hand holds the net (#258).
 */
export function leavesHandForShield(weapon?: CombatWeapon): boolean {
  return weapon?.family !== 'spear' && weapon?.family !== 'hammer' && weapon?.family !== 'trident';
}

/** a trident comes to the bout with a net in the other hand (#258), thrown once */
export function carriesNet(weapon?: CombatWeapon): boolean {
  return weapon?.family === 'trident';
}

export function weaponReach(weapon?: CombatWeapon): number {
  return weapon?.range ?? DEFAULT_WEAPON_REACH;
}

export function weaponMove(kind: AttackKind, weapon?: CombatWeapon): WeaponMove {
  if (weapon?.family === 'daggers') return { ...STANDARD, strikes: 2, damageMultiplier: 0.6 };
  if (weapon?.family === 'axe' && (kind === 'power' || kind === 'charge')) return { ...STANDARD, status: 'torn' };
  if (kind === 'power' && weapon?.family === 'hammer') return { ...STANDARD, armourMultiplier: 0.65, status: 'stunned' };
  if (kind === 'power' && weapon?.family === 'spear') return { ...STANDARD, knockback: 1.6 };
  return STANDARD;
}
