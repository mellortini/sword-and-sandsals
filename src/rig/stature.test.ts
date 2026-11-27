import { describe, expect, it } from 'vitest';
import { STATURE, statureFor } from './stature';

describe('stature from Might', () => {
  it('is normal at the starting Might and never shorter', () => {
    expect(statureFor(5)).toBe(1);
    expect(statureFor(0)).toBe(1);
  });

  it('grows with every point of Might up to the cap', () => {
    for (let might = 6; might <= 17; might++) expect(statureFor(might)).toBeGreaterThan(statureFor(might - 1));
    expect(statureFor(12)).toBeCloseTo(1.105);
    expect(statureFor(17)).toBe(STATURE.max);
    expect(statureFor(200)).toBe(STATURE.max);
  });
});
