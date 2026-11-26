import type { AiProfile } from '../src/core/ai';
import { equipmentTotals } from '../src/core/inventory';
import type { EquipmentLoadout } from '../src/core/types';
import { ITEMS } from '../src/data/equipment';
import { compareContenders } from './balance';
import type { Contender } from './balance';

const PROFILES: readonly AiProfile[] = ['aggressor', 'defender'];
const SCENARIOS = [{ level: 5, tier: 3 }, { level: 12, tier: 6 }, { level: 25, tier: 9 }];

function armourSet(tier: number, weapon: string): EquipmentLoadout {
  return { helmet: tier, armor: tier, shoulders: tier, greaves: tier, boots: tier, weapon };
}

export function simulateArmourBalance(pairs = 250) {
  if (!Number.isSafeInteger(pairs) || pairs < 1) throw new RangeError('Expected at least one mirrored pair.');
  return SCENARIOS.flatMap(({ level, tier }) => {
    const lowerTier = tier - 1;
    const weapon = `sword${tier}`;
    const higher = armourSet(tier, weapon);
    const lower = armourSet(lowerTier, weapon);
    const mixed = { ...higher, helmet: lowerTier, shoulders: lowerTier, boots: lowerTier };
    const growth = Math.floor((level - 1) / 4);
    const attributes = { might: 5 + growth, guard: 5 + growth, precision: 5 + growth, vitality: 5 + growth, stamina: 5 + growth };
    const fullTotals = equipmentTotals(higher);
    const baseArmour = ITEMS.filter((item) => item.tier === tier).reduce((total, item) => total + item.armor, 0);
    const lightWeight = Math.max(0, fullTotals.weight - 4);

    return PROFILES.map((profile) => {
      const contender = (equipment: EquipmentLoadout): Contender => ({ profile, setup: { level, attributes, equipment } });
      const full = contender(higher);
      return {
        level, lowerTier, tier, profile,
        protection: { higher: fullTotals, lower: equipmentTotals(lower), mixed: equipmentTotals(mixed), baseArmour, lightWeight },
        adjacent: compareContenders(full, contender(lower), pairs),
        mixed: compareContenders(full, contender(mixed), pairs),
        setBonus: compareContenders(full, { ...full, statsOverride: { armour: baseArmour } }, pairs),
        weightOnly: compareContenders(full, { ...full, statsOverride: { weight: lightWeight } }, pairs),
      };
    });
  });
}
