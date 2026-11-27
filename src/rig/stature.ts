/**
 * Might makes a gladiator taller: the whole puppet, gear and weapon included, is drawn bigger. Looks only - reach,
 * steps and every number of the fight stay the same.
 */
export const STATURE = {
  /** the Might everybody starts with: normal height */
  base: 5,
  perMight: 0.015,
  /** the tallest, reached at Might 17: taller would crowd the arena */
  max: 1.18,
} as const;

/** height factor for a Might score (1 = normal) */
export const statureFor = (might: number) => Math.min(STATURE.max, 1 + STATURE.perMight * Math.max(0, might - STATURE.base));
