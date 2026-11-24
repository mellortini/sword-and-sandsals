import type { StatusKind } from './status';
import type { FighterSide } from './types';

type SpellId = 'ember' | 'drench';
type PotionId = 'glue-tonic' | 'repair-tape';

export type CombatItemId = SpellId | PotionId;

type CombatItem =
  | { readonly id: SpellId }
  | { readonly id: PotionId; readonly quantity: number };

export type CombatSlots = readonly [CombatItem | null, CombatItem | null, CombatItem | null, CombatItem | null];

export interface CombatSlotAction {
  readonly slot: number;
  readonly target: FighterSide;
}

export interface CombatSlotOption extends CombatSlotAction {
  readonly id: CombatItemId;
  readonly name: string;
  readonly energyCost: number;
  readonly minArcana: number;
  readonly quantity?: number;
  readonly unavailable?: 'energy' | 'arcana';
}

interface ItemDefinition {
  readonly name: string;
  readonly target: 'self' | 'opponent';
  readonly energyCost: number;
  readonly minArcana: number;
  readonly health?: number | 'spellPower';
  readonly status?: StatusKind;
}

export const COMBAT_ITEMS: Readonly<Record<CombatItemId, ItemDefinition>> = {
  ember: { name: 'Ember', target: 'opponent', energyCost: 8, minArcana: 4, health: 'spellPower', status: 'burning' },
  drench: { name: 'Drench', target: 'opponent', energyCost: 5, minArcana: 3, status: 'soaked' },
  'glue-tonic': { name: 'Glue Tonic', target: 'self', energyCost: 2, minArcana: 0, health: 12 },
  'repair-tape': { name: 'Repair Tape', target: 'self', energyCost: 2, minArcana: 0, status: 'taped' },
};

const SLOT_INDEXES = [0, 1, 2, 3] as const;
const EMPTY_SLOTS: CombatSlots = [null, null, null, null];

export function createCombatSlots(slots: CombatSlots = EMPTY_SLOTS): CombatSlots {
  const copy = (entry: CombatItem | null) => {
    if (entry && 'quantity' in entry && (!Number.isSafeInteger(entry.quantity) || entry.quantity < 1)) {
      throw new RangeError('A slotted potion needs a positive quantity.');
    }
    return entry ? { ...entry } : null;
  };
  return [copy(slots[0]), copy(slots[1]), copy(slots[2]), copy(slots[3])];
}

export function combatSlotOptions(
  slots: CombatSlots, actor: FighterSide, opponent: FighterSide, energy: number, arcana: number,
): CombatSlotOption[] {
  const options: CombatSlotOption[] = [];
  for (const slot of SLOT_INDEXES) {
    const entry = slots[slot];
    if (!entry) continue;
    const { id } = entry;
    const { name, target, energyCost, minArcana } = COMBAT_ITEMS[id];
    const unavailable = arcana < minArcana ? 'arcana' : energy < energyCost ? 'energy' : undefined;
    options.push({
      slot, id, name, target: target === 'self' ? actor : opponent, energyCost, minArcana, unavailable,
      ...('quantity' in entry ? { quantity: entry.quantity } : {}),
    });
  }
  return options;
}

export function consumeSlotItem(slots: CombatSlots, slot: number): CombatSlots {
  const entry = slots[slot];
  if (!entry || !('quantity' in entry)) return slots;
  const updated: [CombatItem | null, CombatItem | null, CombatItem | null, CombatItem | null] = [...slots];
  updated[slot] = entry.quantity > 1 ? { ...entry, quantity: entry.quantity - 1 } : null;
  return updated;
}
