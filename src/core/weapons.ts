import { WEAPONS } from '../data/weapons';
import type { Weapon } from '../data/weapons';
import { readForgedItem } from './forge';
import type { StatusKind } from './status';
import type { AttackKind } from './types';

export interface CombatWeapon {
  readonly id: string;
  readonly family: Weapon['family'] | 'daggers';
  readonly damage: number;
  readonly range: number;
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
  const { baseId, level } = readForgedItem(id);
  const weapon = WEAPONS.find((entry) => entry.id === baseId);
  return weapon && id && level > 0 ? { ...weapon, id, damage: weapon.damage + level } : weapon;
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
