import { readWeaponEnchantment } from '../core/enchant';
import { forgePresentation, readForgedItem } from '../core/forge';
import { equipmentLoadout, equipmentTotals, equipItem, unequipItem } from '../core/inventory';
import type { Inventory } from '../core/inventory';
import type { SavedCharacter } from '../core/save';
import type { EquipmentLoadout, EquipmentSlot } from '../core/types';
import { combatWeapon } from '../core/weapons';
import { ITEMS } from '../data/equipment';
import { WEAPONS } from '../data/weapons';
import type { ArmourImprovements } from '../core/types';
import { EQUIP_SLOTS } from '../rig/PaperRig';

/** The worn slots in the order the gear screen lists them (#197). */
export const GEAR_SLOTS: readonly EquipmentSlot[] = [...EQUIP_SLOTS, 'weapon', 'offHand'];

export const SLOT_NAMES: Readonly<Record<EquipmentSlot, string>> = {
  helmet: 'Helmet', armor: 'Armour', shoulders: 'Shoulders', greaves: 'Greaves', boots: 'Boots', weapon: 'Main hand', offHand: 'Off hand',
};

const isCatalogWeapon = (id?: string) => id !== undefined && WEAPONS.some((w) => w.id === weaponBase(id));
/** `sword3^+2~fire~1` → `sword3` */
export const weaponBase = (id: string) => readForgedItem(readWeaponEnchantment(id).baseId).baseId ?? id;

/**
 * The save as the core's inventory: worn armour comes from the puppet's look (tier per slot) with the forge level
 * from `armourImprovements`, the hands from `hands`. An older save without `hands` that shows a catalogue weapon on
 * the puppet holds that weapon.
 */
export function savedInventory(character: SavedCharacter): Inventory {
  const equipped: Partial<Record<EquipmentSlot, string>> = {};
  for (const slot of EQUIP_SLOTS) {
    const tier = character.look[slot];
    if (tier <= 0) continue;
    const level = character.armourImprovements?.[slot] ?? 0;
    equipped[slot] = level > 0 ? `${slot}${tier}^+${level}` : `${slot}${tier}`;
  }
  const weapon = character.hands?.weapon ?? (character.hands === undefined && isCatalogWeapon(character.look.weapon) ? character.look.weapon : undefined);
  if (weapon !== undefined) equipped.weapon = weapon;
  if (character.hands?.offHand !== undefined) equipped.offHand = character.hands.offHand;
  return { backpack: character.inventory, equipped };
}

/** The character wearing `inventory`: look tiers and puppet weapon follow, forge levels and hands are kept. */
export function applyInventory(character: SavedCharacter, inventory: Inventory): SavedCharacter {
  const look = { ...character.look };
  const improvements: ArmourImprovements = {};
  for (const slot of EQUIP_SLOTS) {
    const id = inventory.equipped[slot];
    const { baseId, level } = readForgedItem(id);
    look[slot] = ITEMS.find((piece) => piece.id === baseId)?.tier ?? 0;
    if (level > 0) improvements[slot] = level;
  }
  const { weapon, offHand } = inventory.equipped;
  // the puppet shows the weapon's family and tier; with empty hands it keeps the starting gladius
  look.weapon = weapon !== undefined ? weaponBase(weapon) : 'gladius';
  const next: SavedCharacter = {
    ...character, look, inventory: [...inventory.backpack],
    hands: { ...(weapon !== undefined && { weapon }), ...(offHand !== undefined && { offHand }) },
  };
  if (Object.keys(improvements).length) next.armourImprovements = improvements;
  else delete next.armourImprovements;
  return next;
}

/** What combat reads for the saved gladiator: tiers, forge levels, weapon (with its upgrade and enchantment). */
export function careerLoadout(character: SavedCharacter): EquipmentLoadout {
  return equipmentLoadout(savedInventory(character).equipped);
}

/** One line about an item: name with +N and the number that matters (armour or damage), or undefined for non-gear. */
export function gearItem(id: string): { name: string; slot: EquipmentSlot | 'hand'; stat: string; minLevel: number; minMight: number } | undefined {
  const forged = readForgedItem(id);
  const armour = ITEMS.find((piece) => piece.id === forged.baseId);
  if (armour) {
    return { name: forgePresentation(id)?.label ?? armour.name, slot: armour.slot, stat: `Armour ${armour.armor + forged.level}`, minLevel: armour.minLevel, minMight: 0 };
  }
  const weapon = WEAPONS.find((w) => w.id === weaponBase(id));
  if (!weapon) return undefined;
  const { enchantment } = readWeaponEnchantment(id);
  const level = readForgedItem(readWeaponEnchantment(id).baseId).level;
  const name = `${weapon.name}${level > 0 ? ` +${level}` : ''}${enchantment ? ` (${enchantment.element} ${enchantment.power})` : ''}`;
  return { name, slot: 'hand', stat: `Damage ${combatWeapon(id)?.damage ?? weapon.damage}`, minLevel: weapon.minLevel, minMight: weapon.minMight };
}

/** Why an item cannot be worn now, in words, or undefined when it can. */
export function wearProblem(character: SavedCharacter, id: string): string | undefined {
  const item = gearItem(id);
  if (!item) return 'not wearable';
  if (character.level < item.minLevel) return `needs level ${item.minLevel}`;
  if (character.attributes.might < item.minMight) return `needs Might ${item.minMight}`;
  return undefined;
}

export type GearResult = { ok: true; character: SavedCharacter } | { ok: false; character: SavedCharacter; problem: string };

export function wear(character: SavedCharacter, id: string): GearResult {
  const result = equipItem(savedInventory(character), id, { level: character.level, might: character.attributes.might });
  return result.ok ? { ok: true, character: applyInventory(character, result.inventory) }
    : { ok: false, character, problem: wearProblem(character, id) ?? 'cannot be worn' };
}

export function takeOff(character: SavedCharacter, slot: EquipmentSlot): GearResult {
  const result = unequipItem(savedInventory(character), slot);
  return result.ok ? { ok: true, character: applyInventory(character, result.inventory) } : { ok: false, character, problem: 'nothing worn there' };
}

/** Armour, weight and whether the five armour pieces form one set. */
export const gearTotals = (character: SavedCharacter) => equipmentTotals(careerLoadout(character));
