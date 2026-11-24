import { WEAPONS } from '../data/weapons';
import type { SavedCharacter } from './save';
import type { StatusKind } from './status';

export const ENCHANT_ELEMENTS = ['fire', 'water', 'ink', 'wind'] as const;
export type EnchantElement = (typeof ENCHANT_ELEMENTS)[number];
export type EnchantPower = 1 | 2 | 3;

export interface WeaponEnchantment {
  readonly element: EnchantElement;
  readonly power: EnchantPower;
}

const DAMAGE = { 1: 2, 2: 4, 3: 7 };
const PRICE_SHARE = { 1: 0.4, 2: 0.8, 3: 1.2 };
const STATUS: Readonly<Partial<Record<EnchantElement, StatusKind>>> = { fire: 'burning', water: 'soaked', ink: 'feared' };

export function readWeaponEnchantment(id?: string): { baseId?: string; enchantment?: WeaponEnchantment } {
  const [baseId, element, power, extra] = id?.split('~') ?? [];
  if (!baseId || !ENCHANT_ELEMENTS.some((entry) => entry === element) || !['1', '2', '3'].includes(power) || extra !== undefined) {
    return { baseId: id };
  }
  return { baseId, enchantment: { element: element as EnchantElement, power: Number(power) as EnchantPower } };
}

export function enchantmentEffect({ element, power }: WeaponEnchantment): { damage: number; knockback: number; status?: StatusKind } {
  return { damage: DAMAGE[power], knockback: element === 'wind' ? 0.5 + power * 0.5 : 0, status: STATUS[element] };
}

export function enchantmentPrice(id: string, power: EnchantPower): number | undefined {
  const { baseId } = readWeaponEnchantment(id);
  const weapon = WEAPONS.find((entry) => entry.id === baseId);
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
