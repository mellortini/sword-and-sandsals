import { equipmentTotals } from './inventory';
import type { Attributes, EquipmentLoadout, FighterStats } from './types';

const DEFAULT_ATTRIBUTES: Readonly<Attributes> = {
  might: 5,
  agility: 5,
  precision: 5,
  guard: 5,
  vitality: 5,
  stamina: 5,
  charm: 5,
  arcana: 5,
};

export function resolveAttributes(overrides: Partial<Attributes> = {}): Attributes {
  const attributes = { ...DEFAULT_ATTRIBUTES, ...overrides };
  if (!Object.values(attributes).every((value) => Number.isSafeInteger(value) && value >= 0)) {
    throw new RangeError('Combat attributes must be non-negative safe integers.');
  }
  return attributes;
}

export function deriveStats(attributes: Readonly<Attributes>, equipment: EquipmentLoadout = {}): FighterStats {
  const { armour, weight } = equipmentTotals(equipment);

  return {
    maxHealth: 40 + attributes.vitality * 6,
    maxEnergy: 20 + attributes.stamina * 4,
    armour,
    weight,
  };
}
