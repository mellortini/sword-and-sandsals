import { equipmentTotals } from './inventory';
import { combatWeapon } from './weapons';
import type { AttackKind, Attributes, CombatAction, EquipmentLoadout, FighterStats } from './types';

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

const ATTACKS: Record<AttackKind, { accuracy: number; power: number }> = {
  quick: { accuracy: 80, power: 0.7 },
  normal: { accuracy: 70, power: 1 },
  power: { accuracy: 55, power: 1.6 },
  charge: { accuracy: 70, power: 1.2 },
};

export function isAttack(action: CombatAction): action is AttackKind {
  return Object.hasOwn(ATTACKS, action);
}

export function resolveAttributes(overrides: Partial<Attributes> = {}): Attributes {
  const attributes = { ...DEFAULT_ATTRIBUTES, ...overrides };
  if (!Object.values(attributes).every((value) => Number.isSafeInteger(value) && value >= 0)) {
    throw new RangeError('Combat attributes must be non-negative safe integers.');
  }
  return attributes;
}

/** Charm grants up to 25 percentage points off a shop purchase. */
export function shopDiscount(charm: number): number {
  return Math.min(25, Math.max(0, charm));
}

export function deriveStats(
  attributes: Readonly<Attributes>, equipment: EquipmentLoadout = {}, weaponDamage = combatWeapon(equipment.weapon)?.damage ?? 4,
): FighterStats {
  const { armour, weight } = equipmentTotals(equipment);

  return {
    maxHealth: 40 + attributes.vitality * 6,
    maxEnergy: 20 + attributes.stamina * 4,
    armour,
    weight,
    attackPower: weaponDamage + attributes.might,
    accuracyBonus: 3 * attributes.precision + 2 * DEFAULT_ATTRIBUTES.agility,
    evasionBonus: 3 * attributes.guard + 2 * attributes.agility,
    blockChance: Math.min(80, 25 + 4 * attributes.guard),
    criticalChance: Math.min(40, 5 + attributes.precision),
    jumpDistance: Math.min(6, 2 + 0.4 * attributes.agility),
    restRecovery: 8 + attributes.stamina,
    tauntPenalty: Math.min(20, 5 + attributes.charm),
    shopDiscount: shopDiscount(attributes.charm),
    spellPower: 4 + attributes.arcana,
  };
}

/** Accuracy, evasion and taunt are percentage points. Default Agility preserves the base chance. */
export function attackHitChance(kind: AttackKind, attacker: Readonly<FighterStats>, defender: Readonly<FighterStats>, tauntPenalty: number): number {
  const chance = ATTACKS[kind].accuracy + attacker.accuracyBonus - defender.evasionBonus - tauntPenalty;
  return Math.max(5, Math.min(95, chance));
}

/** What a blocked blow takes off the shield (#273): its raw force, no armour, no crit, at least 1. */
export function shieldDamage(kind: AttackKind, attacker: Readonly<FighterStats>): number {
  return Math.max(1, Math.round(attacker.attackPower * ATTACKS[kind].power));
}

/** A landed, unblocked attack always deals at least 1 HP. Armour has diminishing returns. */
export function attackDamage(kind: AttackKind, attacker: Readonly<FighterStats>, defender: Readonly<FighterStats>, critical = false): number {
  const raw = attacker.attackPower * ATTACKS[kind].power * (critical ? 1.5 : 1);
  return Math.max(1, Math.round(raw * 30 / (30 + defender.armour)));
}
