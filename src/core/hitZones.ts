import { ITEMS } from '../data/equipment';
import type { Item } from '../data/equipment';
import { equipmentTotals } from './inventory';
import type { ActionOption, AttackKind, EquipmentLoadout } from './types';

export const HIT_ZONES = ['head', 'torso', 'legs'] as const;
export type HitZone = (typeof HIT_ZONES)[number];

export interface TargetedAttack {
  readonly action: AttackKind;
  readonly zone: HitZone;
}

export type AttackZoneOption = ActionOption & TargetedAttack & { hitChance: number };
export type ZonedArmour = Readonly<Record<HitZone, number>>;

export const ZONE_ACCURACY_PENALTY: Readonly<Record<HitZone, number>> = { head: 20, torso: 0, legs: 10 };
const ZONE_BY_SLOT: Readonly<Record<Item['slot'], HitZone>> = {
  helmet: 'head', armor: 'torso', shoulders: 'torso', greaves: 'legs', boots: 'legs',
};

export function armourByZone(loadout: EquipmentLoadout = {}): ZonedArmour {
  const armour: Record<HitZone, number> = { head: 0, torso: 0, legs: 0 };
  for (const piece of ITEMS) {
    if (loadout[piece.slot] === piece.tier) armour[ZONE_BY_SLOT[piece.slot]] += piece.armor;
  }
  if (equipmentTotals(loadout).fullSet) {
    for (const zone of HIT_ZONES) armour[zone] = Math.round(armour[zone] * 1.1);
  }
  return armour;
}
