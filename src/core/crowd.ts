import { nextRandom } from './rng';
import type { CombatAction } from './types';

export interface CrowdStanding {
  readonly favour: number;
  readonly lastAction?: CombatAction;
  readonly streak: number;
  readonly giftCooldown: number;
  readonly giftGold: number;
  readonly rngState: number;
}

export type CrowdGift = 'bouquet' | 'coin';

const ACTION_FAVOUR: Readonly<Record<CombatAction, number>> = {
  quick: 1,
  normal: 2,
  power: 4,
  charge: 7,
  step_forward: 0,
  step_back: -4,
  jump: 5,
  block: 0,
  rest: -3,
  taunt: 6,
  net: 5,
};

export function createCrowdStanding(seed: number): CrowdStanding {
  return { favour: 50, streak: 0, giftCooldown: 0, giftGold: 0, rngState: seed >>> 0 };
}

export function crowdDamageMultiplier(standing: CrowdStanding): number {
  return 1 + 0.15 * Math.max(0, standing.favour - 65) / 35;
}

export function crowdGoldReward(baseGold: number, standing: CrowdStanding): number {
  const bonus = 0.25 * Math.max(0, standing.favour - 65) / 35;
  return Math.round(baseGold * (1 + bonus)) + standing.giftGold;
}

export function scoreCrowdAction(
  standing: CrowdStanding, action: CombatAction, charm: number, hit?: boolean, critical = false,
): { standing: CrowdStanding; gift?: CrowdGift } {
  const streak = action === standing.lastAction ? standing.streak + 1 : 1;
  const variety = streak === 1 && standing.lastAction !== undefined && ACTION_FAVOUR[action] > 0 ? 2 : 0;
  const repetition = Math.min(12, 3 * (streak - 1));
  const charmBonus = action === 'taunt' ? Math.min(5, Math.floor(charm / 3)) : 0;
  const attackBonus = critical ? 8 : hit === false ? -3 : 0;
  const change = ACTION_FAVOUR[action] + variety + charmBonus + attackBonus - repetition;
  const favour = Math.min(100, Math.max(0, standing.favour + change));
  const updated = { ...standing, favour, lastAction: action, streak, giftCooldown: Math.max(0, standing.giftCooldown - 1) };
  if (favour < 80 || change <= 0 || standing.giftCooldown > 0) return { standing: updated };

  const roll = nextRandom(updated.rngState);
  const chance = 0.1 + (favour - 80) / 100;
  if (roll.value >= chance) return { standing: { ...updated, rngState: roll.state } };

  const gift: CrowdGift = roll.value < chance / 2 ? 'bouquet' : 'coin';
  return {
    gift,
    standing: { ...updated, rngState: roll.state, giftCooldown: 3, giftGold: updated.giftGold + (gift === 'coin' ? 5 : 0) },
  };
}
