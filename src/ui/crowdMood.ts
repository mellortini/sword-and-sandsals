/**
 * How the HUD names the crowd's favour (0-100, src/core/crowd.ts). The two thresholds mirror the core:
 * above 65 the crowd adds damage and gold, from 80 it may throw gifts.
 */
export const CROWD_BONUS_FROM = 65;
export const CROWD_GIFTS_FROM = 80;

export type CrowdTier = 'jeering' | 'restless' | 'watching' | 'cheering' | 'roaring';

export interface CrowdMood {
  readonly tier: CrowdTier;
  /** the word under the meter */
  readonly label: string;
}

const MOODS: readonly (CrowdMood & { readonly from: number })[] = [
  { from: CROWD_GIFTS_FROM, tier: 'roaring', label: 'Roaring' },
  { from: CROWD_BONUS_FROM, tier: 'cheering', label: 'Cheering' },
  { from: 40, tier: 'watching', label: 'Watching' },
  { from: 20, tier: 'restless', label: 'Restless' },
  { from: -Infinity, tier: 'jeering', label: 'Jeering' },
];

export function crowdMood(favour: number): CrowdMood {
  const { tier, label } = MOODS.find((m) => favour >= m.from)!;
  return { tier, label };
}

/** meter fill 0..1 */
export function crowdFraction(favour: number): number {
  return Math.min(1, Math.max(0, favour / 100));
}

/** the floating note for a gift from the stands: a bouquet heals, a coin adds to the fight's gold */
export function crowdGiftText(gift: 'bouquet' | 'coin', amount: number): string {
  return gift === 'bouquet' ? `Bouquet +${amount} HP` : `Coin +${amount} gold`;
}
