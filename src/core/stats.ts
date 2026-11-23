import { ITEMS } from '../data/equipment';
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
  const equipped = ITEMS.filter(({ slot, tier }) => equipment[slot] === tier);
  const armour = equipped.reduce((total, item) => total + item.armor, 0);
  const weight = equipped.reduce((total, item) => total + item.weight, 0);
  const fullSet = equipped.length === 5 && equipped.every(({ tier }) => tier === equipped[0].tier);

  return {
    maxHealth: 40 + attributes.vitality * 6,
    maxEnergy: 20 + attributes.stamina * 4,
    armour: Math.round(armour * (fullSet ? 1.1 : 1)),
    weight,
  };
}
