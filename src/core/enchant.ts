import { findWeapon } from '../data/weaponLookup';
import { readForgedItem } from './forge';
import type { SavedCharacter } from './save';
import type { StatusKind } from './status';
import { ENCHANT_ELEMENTS, readWeaponEnchantment } from './weaponEnchantmentId';
import type { EnchantElement, EnchantPower, WeaponEnchantment } from './weaponEnchantmentId';

export { ENCHANT_ELEMENTS, readWeaponEnchantment } from './weaponEnchantmentId';
export type { EnchantElement, EnchantPower, WeaponEnchantment } from './weaponEnchantmentId';

const DAMAGE = { 1: 2, 2: 4, 3: 7 };
const PRICE_SHARE = { 1: 0.4, 2: 0.8, 3: 1.2 };
const STATUS: Readonly<Partial<Record<EnchantElement, StatusKind>>> = { fire: 'burning', water: 'soaked', ink: 'feared' };

export function enchantmentEffect({ element, power }: WeaponEnchantment): { damage: number; knockback: number; status?: StatusKind } {
  return { damage: DAMAGE[power], knockback: element === 'wind' ? 0.5 + power * 0.5 : 0, status: STATUS[element] };
}

export function enchantmentPrice(id: string, power: EnchantPower): number | undefined {
  const { baseId } = readForgedItem(readWeaponEnchantment(id).baseId);
  const weapon = findWeapon(baseId);
  return weapon && Object.hasOwn(PRICE_SHARE, power) ? Math.ceil(weapon.price * PRICE_SHARE[power]) : undefined;
}

type WeaponSource = 'backpack' | 'weapon' | 'offHand';
type EnchantResult =
  | { ok: true; character: SavedCharacter; price: number; id: string }
  | { ok: false; character: SavedCharacter; reason: 'not-owned' | 'unavailable' | 'insufficient-gold' };

export function enchantWeapon(character: SavedCharacter, id: string, source: WeaponSource, enchantment: WeaponEnchantment): EnchantResult {
  const index = character.inventory.indexOf(id);
  const owned = source === 'backpack' ? index >= 0 : character.hands?.[source] === id;
  if (!owned) return { ok: false, character, reason: 'not-owned' };
  const price = enchantmentPrice(id, enchantment.power);
  if (price === undefined || !ENCHANT_ELEMENTS.includes(enchantment.element)) return { ok: false, character, reason: 'unavailable' };
  if (character.gold < price) return { ok: false, character, reason: 'insufficient-gold' };

  const updatedId = `${readWeaponEnchantment(id).baseId}~${enchantment.element}~${enchantment.power}`;
  const updated = { ...character, gold: character.gold - price };
  if (source === 'backpack') {
    updated.inventory = character.inventory.slice();
    updated.inventory[index] = updatedId;
  } else updated.hands = { ...character.hands, [source]: updatedId };

  return { ok: true, character: updated, price, id: updatedId };
}
