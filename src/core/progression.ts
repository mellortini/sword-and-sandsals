import type { FighterSide } from './types';

export const MAX_LEVEL = 60;
const ATTRIBUTE_POINTS_PER_LEVEL = 5;
const LEVELS_PER_SKILL_POINT = 3;

const LEVEL_XP = [0];
for (let level = 1; level < MAX_LEVEL; level++) {
  const steps = level - 1;
  LEVEL_XP.push(LEVEL_XP[steps] + 100 + 30 * steps + 3 * steps ** 2);
}

export interface CharacterProgress {
  readonly level: number;
  readonly experience: number;
  readonly attributePoints?: number;
  readonly skillPoints?: number;
}

export function experienceForLevel(level: number): number {
  if (!Number.isInteger(level) || level < 1 || level > MAX_LEVEL) throw new RangeError('Level must be from 1 to 60.');
  return LEVEL_XP[level - 1];
}

export function awardExperience(progress: CharacterProgress, earned: number): Required<CharacterProgress> {
  const { level, experience, attributePoints = 0, skillPoints = 0 } = progress;
  if (![experience, earned, attributePoints, skillPoints].every((value) => Number.isSafeInteger(value) && value >= 0)) {
    throw new RangeError('Experience and points must be non-negative safe integers.');
  }
  const floor = experienceForLevel(level);
  // Older saves could set a level without its cumulative experience.
  const total = Math.min(experienceForLevel(MAX_LEVEL), Math.max(experience, floor) + earned);
  let nextLevel = level;
  while (nextLevel < MAX_LEVEL && total >= LEVEL_XP[nextLevel]) nextLevel++;

  return {
    level: nextLevel,
    experience: total,
    attributePoints: attributePoints + (nextLevel - level) * ATTRIBUTE_POINTS_PER_LEVEL,
    skillPoints: skillPoints + Math.floor(nextLevel / LEVELS_PER_SKILL_POINT) - Math.floor(level / LEVELS_PER_SKILL_POINT),
  };
}

/** XP is awarded for a player victory. Level difference adjusts the opponent's base value. */
export function fightExperience(winner: FighterSide, playerLevel: number, opponentLevel: number): number {
  if (winner !== 'player') return 0;
  const scale = Math.min(2.5, Math.max(0.25, 1 + 0.15 * (opponentLevel - playerLevel)));
  return Math.round((50 + 5 * opponentLevel) * scale);
}
