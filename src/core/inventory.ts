import { ITEMS } from '../data/equipment';
import { findShield } from '../data/shields';
import type { WeaponFamily } from '../data/weapons';
import { readWeaponEnchantment } from './enchant';
import { readForgedItem } from './forge';
import type { EquipmentLoadout, EquipmentSlot, HandSlot } from './types';
import { findWeapon } from './weapons';

export interface Inventory {
  readonly backpack: readonly string[];
  readonly equipped: Readonly<Partial<Record<EquipmentSlot, string>>>;
}

interface EquipRequirements {
  readonly level: number;
  readonly might: number;
}

type InventoryChange =
  | { ok: true; inventory: Inventory }
  | { ok: false; inventory: Inventory; reason: 'not-owned' | 'unknown-item' | 'level' | 'might' | 'empty-slot' };

// Starting weights in the same units as armour. Each equipped hand contributes separately.
const WEAPON_WEIGHT: Readonly<Record<WeaponFamily, number>> = {
  sword: 1,
  axe: 1.5,
  spear: 1.5,
  hammer: 2,
};

export function equipItem(inventory: Inventory, id: string, character: EquipRequirements, hand: HandSlot = 'weapon'): InventoryChange {
  const index = inventory.backpack.indexOf(id);
  if (index === -1) return { ok: false, inventory, reason: 'not-owned' };

  const armour = ITEMS.find((piece) => piece.id === readForgedItem(id).baseId);
  const { baseId } = readForgedItem(readWeaponEnchantment(id).baseId);
  const weapon = findWeapon(baseId);
  // a shield (#273) always goes on the off hand
  const shield = findShield(id);
  const item = armour ?? weapon ?? shield;
  if (!item) return { ok: false, inventory, reason: 'unknown-item' };
  if (character.level < item.minLevel) return { ok: false, inventory, reason: 'level' };
  if (weapon && character.might < weapon.minMight) return { ok: false, inventory, reason: 'might' };

  const slot = armour?.slot ?? (shield ? 'offHand' : hand);
  const previous = inventory.equipped[slot];
  const backpack = inventory.backpack.slice();
  if (previous === undefined) backpack.splice(index, 1);
  else backpack[index] = previous;

  return { ok: true, inventory: { backpack, equipped: { ...inventory.equipped, [slot]: id } } };
}

export function unequipItem(inventory: Inventory, slot: EquipmentSlot): InventoryChange {
  const id = inventory.equipped[slot];
  if (id === undefined) return { ok: false, inventory, reason: 'empty-slot' };

  const equipped = { ...inventory.equipped };
  delete equipped[slot];
  return { ok: true, inventory: { backpack: [...inventory.backpack, id], equipped } };
}

/** Convert item IDs into the slot tiers and hand IDs that combat reads. */
export function equipmentLoadout(equipped: Inventory['equipped']): EquipmentLoadout {
  const loadout: EquipmentLoadout = {};
  for (const { id, slot, tier } of ITEMS) {
    const { baseId, level } = readForgedItem(equipped[slot]);
    if (baseId !== id) continue;
    loadout[slot] = tier;
    if (level > 0) (loadout.improvements ??= {})[slot] = level;
  }
  if (equipped.weapon !== undefined) loadout.weapon = equipped.weapon;
  if (equipped.offHand !== undefined) loadout.offHand = equipped.offHand;
  return loadout;
}

export function equipmentTotals(loadout: Readonly<EquipmentLoadout>): { armour: number; weight: number; fullSet: boolean } {
  const equipped = ITEMS.filter(({ slot, tier }) => loadout[slot] === tier);
  const armour = equipped.reduce((total, piece) => total + piece.armor + (loadout.improvements?.[piece.slot] ?? 0), 0);
  const armourWeight = equipped.reduce((total, piece) => total + piece.weight, 0);
  const handWeight = [loadout.weapon, loadout.offHand].reduce((total, id) => {
    if (id === undefined) return total;
    const shield = findShield(id);
    if (shield) return total + shield.weight;
    const { baseId } = readForgedItem(readWeaponEnchantment(id).baseId);
    const weapon = findWeapon(baseId);
    return total + (weapon ? WEAPON_WEIGHT[weapon.family] : 0);
  }, 0);
  const fullSet = equipped.length === 5 && equipped.every(({ tier }) => tier === equipped[0].tier);

  return { armour: Math.round(armour * (fullSet ? 1.1 : 1)), weight: armourWeight + handWeight, fullSet };
}
