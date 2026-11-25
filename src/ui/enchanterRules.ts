import { ENCHANT_ELEMENTS, enchantWeapon, enchantmentEffect, enchantmentPrice, readWeaponEnchantment } from '../core/enchant';
import type { EnchantElement, EnchantPower, WeaponEnchantment } from '../core/enchant';
import type { SavedCharacter } from '../core/save';
import { gearItem, weaponBase } from './gearRules';
import { WEAPONS } from '../data/weapons';

export const POWERS: readonly EnchantPower[] = [1, 2, 3];
export const ELEMENT_NAMES: Readonly<Record<EnchantElement, string>> = { fire: 'Fire', water: 'Water', ink: 'Ink', wind: 'Wind' };
const STATUS_TEXT = { burning: 'sets the foe burning', soaked: 'soaks the foe', feared: 'frightens the foe' } as const;

/** A weapon the enchanter can work on: held in a hand or lying in the pack (#199). */
export interface EnchantTarget {
  readonly key: string;
  readonly id: string;
  readonly source: 'weapon' | 'offHand' | 'backpack';
  readonly name: string;
  readonly where: string;
  readonly current?: WeaponEnchantment;
}

export function enchantTargets(character: SavedCharacter): EnchantTarget[] {
  const targets: EnchantTarget[] = [];
  const add = (id: string, source: EnchantTarget['source'], where: string, key: string) => {
    if (!WEAPONS.some((w) => w.id === weaponBase(id))) return;
    targets.push({ key, id, source, where, name: gearItem(id)?.name ?? id, current: readWeaponEnchantment(id).enchantment });
  };
  if (character.hands?.weapon) add(character.hands.weapon, 'weapon', 'main hand', 'hand:weapon');
  if (character.hands?.offHand) add(character.hands.offHand, 'offHand', 'off hand', 'hand:offHand');
  character.inventory.forEach((id, i) => add(id, 'backpack', 'pack', `pack:${i}`));
  return targets;
}

/** "+4 damage on a hit, sets the foe burning" */
export function effectText(enchantment: WeaponEnchantment): string {
  const { damage, knockback, status } = enchantmentEffect(enchantment);
  const parts = [`+${damage} damage on a hit`];
  if (status && status in STATUS_TEXT) parts.push(STATUS_TEXT[status as keyof typeof STATUS_TEXT]);
  if (knockback > 0) parts.push(`knocks the foe back ${knockback}`);
  return parts.join(', ');
}

export const enchantPrice = (target: EnchantTarget, power: EnchantPower) => enchantmentPrice(target.id, power);

/** Enchant the target; an enchantment already on it is replaced. */
export function applyEnchantment(character: SavedCharacter, target: EnchantTarget, enchantment: WeaponEnchantment) {
  return enchantWeapon(character, target.id, target.source, enchantment);
}

export { ENCHANT_ELEMENTS };
