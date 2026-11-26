import type { SavedCharacter } from '../core/save';
import { resolveAttributes } from '../core/stats';
import { trainerResetQuote } from '../core/trainer';
import { ATTRIBUTE_INFO } from './creatorRules';

const BASE = resolveAttributes();

/** What the trainer screen shows (#193). */
export interface TrainerView {
  /** each attribute with its value and how much of it was trained above the base */
  readonly rows: readonly { key: (typeof ATTRIBUTE_INFO)[number]['key']; label: string; value: number; trained: number }[];
  /** saved, not yet placed */
  readonly points: number;
  readonly price: number;
  readonly refund: number;
  /** why the reset cannot be bought now, or undefined when it can */
  readonly resetBlocked?: 'nothing-to-reset' | 'insufficient-gold';
}

export function trainerView(character: SavedCharacter): TrainerView {
  const { price, refund } = trainerResetQuote(character);
  return {
    rows: ATTRIBUTE_INFO.map(({ key, label }) => ({
      key, label, value: character.attributes[key], trained: Math.max(0, character.attributes[key] - BASE[key]),
    })),
    points: character.attributePoints ?? 0,
    price, refund,
    resetBlocked: refund === 0 ? 'nothing-to-reset' : character.gold < price ? 'insufficient-gold' : undefined,
  };
}

export const pointsText = (n: number) => `${n} ${n === 1 ? 'point' : 'points'}`;
