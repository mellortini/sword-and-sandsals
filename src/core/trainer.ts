import type { SavedCharacter } from './save';
import { resolveAttributes } from './stats';
import type { Attributes } from './types';

const BASE_ATTRIBUTES = resolveAttributes();
const ATTRIBUTES = Object.keys(BASE_ATTRIBUTES) as (keyof Attributes)[];

type TrainingResult =
  | { ok: true; character: SavedCharacter }
  | { ok: false; character: SavedCharacter; reason: 'invalid-allocation' | 'insufficient-points' | 'insufficient-gold' | 'nothing-to-reset' | 'point-limit' };

export function spendAttributePoints(character: SavedCharacter, attribute: keyof Attributes, points: number): TrainingResult {
  if (!Object.hasOwn(BASE_ATTRIBUTES, attribute) || !Number.isSafeInteger(points) || points < 1) {
    return { ok: false, character, reason: 'invalid-allocation' };
  }
  const available = character.attributePoints ?? 0;
  if (points > available) return { ok: false, character, reason: 'insufficient-points' };

  const value = character.attributes[attribute] + points;
  if (!Number.isSafeInteger(value)) return { ok: false, character, reason: 'point-limit' };
  const attributes = { ...character.attributes, [attribute]: value };
  return { ok: true, character: { ...character, attributes, attributePoints: available - points } };
}

export function trainerResetQuote(character: SavedCharacter): { price: number; refund: number } {
  const refund = ATTRIBUTES.reduce((total, key) => total + Math.max(0, character.attributes[key] - BASE_ATTRIBUTES[key]), 0);
  return { price: 25 + 5 * (character.level - 1), refund };
}

export function resetAttributes(character: SavedCharacter): TrainingResult {
  const { price, refund } = trainerResetQuote(character);
  if (refund === 0) return { ok: false, character, reason: 'nothing-to-reset' };
  if (character.gold < price) return { ok: false, character, reason: 'insufficient-gold' };

  const attributePoints = (character.attributePoints ?? 0) + refund;
  if (!Number.isSafeInteger(attributePoints)) return { ok: false, character, reason: 'point-limit' };
  const attributes = { ...character.attributes };
  for (const key of ATTRIBUTES) attributes[key] = Math.min(attributes[key], BASE_ATTRIBUTES[key]);

  return { ok: true, character: { ...character, gold: character.gold - price, attributes, attributePoints } };
}
