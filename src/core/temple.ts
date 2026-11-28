import type { SavedCharacter } from './save';
import type { CombatSlots } from './spells';
import { deriveStats } from './stats';
import type { Fighter } from './types';

const REMEDY_PRICES = {
  'glue-tonic': 6,
  'repair-tape': 10,
  staples: 14,
} as const;

export type TempleRemedy = keyof typeof REMEDY_PRICES;
export const TEMPLE_REMEDIES = Object.entries(REMEDY_PRICES).map(([id, price]) => ({ id: id as TempleRemedy, price }));

type TempleResult =
  | { ok: true; character: SavedCharacter; price: number }
  | { ok: false; character: SavedCharacter; reason: 'insufficient-gold' | 'already-healed' };

export function templeHealingQuote(character: SavedCharacter): { health: number; maxHealth: number; price: number } {
  const { maxHealth } = deriveStats(character.attributes);
  const health = Math.min(maxHealth, character.health ?? maxHealth);
  const missing = maxHealth - health;
  return { health, maxHealth, price: missing > 0 ? 2 + Math.ceil(missing / 5) : 0 };
}

export function healAtTemple(character: SavedCharacter): TempleResult {
  const { maxHealth, price } = templeHealingQuote(character);
  if (price === 0) return { ok: false, character, reason: 'already-healed' };
  if (character.gold < price) return { ok: false, character, reason: 'insufficient-gold' };
  return { ok: true, character: { ...character, health: maxHealth, gold: character.gold - price }, price };
}

export function buyTempleRemedy(character: SavedCharacter, id: TempleRemedy): TempleResult {
  const price = REMEDY_PRICES[id];
  if (character.gold < price) return { ok: false, character, reason: 'insufficient-gold' };
  const updated = { ...character, gold: character.gold - price, inventory: [...character.inventory, id] };
  return { ok: true, character: updated, price };
}

/** The share of full health a beaten gladiator is back to when leaving the sand (#45). */
export const DEFEAT_RECOVERY = 0.5;

/**
 * A beaten gladiator is patched up to half health for free. Without it a loss with an empty purse locked the game:
 * every later bout started at 1 HP, so there was no way to earn the temple's price. The rest still costs gold.
 */
export function recoverFromDefeat(character: SavedCharacter): SavedCharacter {
  const { health, maxHealth } = templeHealingQuote(character);
  const floor = Math.ceil(maxHealth * DEFEAT_RECOVERY);
  return health < floor ? { ...character, health: floor } : character;
}

export function templeCombatSlots(inventory: readonly string[]): CombatSlots {
  const potion = (id: TempleRemedy) => {
    const quantity = inventory.filter((item) => item === id).length;
    return quantity ? { id, quantity } : null;
  };
  return [potion('glue-tonic'), potion('repair-tape'), potion('staples'), null];
}

/** Use with the fighter prepared via templeCombatSlots after the bout ends. */
export function settleTempleCombat(character: SavedCharacter, fighter: Pick<Fighter, 'health' | 'slots'>): SavedCharacter {
  const remaining = new Map<TempleRemedy, number>();
  for (const slot of fighter.slots) {
    if (slot && 'quantity' in slot) remaining.set(slot.id, (remaining.get(slot.id) ?? 0) + slot.quantity);
  }
  const inventory = character.inventory.filter((id) => {
    if (!Object.hasOwn(REMEDY_PRICES, id)) return true;
    const remedy = id as TempleRemedy;
    const quantity = remaining.get(remedy) ?? 0;
    if (quantity === 0) return false;
    remaining.set(remedy, quantity - 1);
    return true;
  });
  return { ...character, health: fighter.health, inventory };
}
