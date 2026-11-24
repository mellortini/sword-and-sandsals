import { describe, expect, it } from 'vitest';
import { createCrowdStanding, crowdDamageMultiplier, scoreCrowdAction } from '../core/crowd';
import { CROWD_BONUS_FROM, CROWD_GIFTS_FROM, crowdFraction, crowdGiftText, crowdMood } from './crowdMood';

describe('crowdMood', () => {
  it('names every band of the meter', () => {
    expect(crowdMood(0).tier).toBe('jeering');
    expect(crowdMood(25).tier).toBe('restless');
    expect(crowdMood(50).label).toBe('Watching');
    expect(crowdMood(CROWD_BONUS_FROM).tier).toBe('cheering');
    expect(crowdMood(CROWD_GIFTS_FROM).tier).toBe('roaring');
    expect(crowdMood(100).label).toBe('Roaring');
  });

  it('starts a fight watching, as the core starts every crowd at 50', () => {
    expect(crowdMood(createCrowdStanding(1).favour).tier).toBe('watching');
  });

  it('cheers exactly where the core starts adding damage', () => {
    const at = (favour: number) => ({ ...createCrowdStanding(1), favour });
    expect(crowdDamageMultiplier(at(CROWD_BONUS_FROM))).toBe(1);
    expect(crowdDamageMultiplier(at(CROWD_BONUS_FROM + 1))).toBeGreaterThan(1);
  });

  it('rises with taunts and falls with rests', () => {
    let up = createCrowdStanding(1);
    let down = createCrowdStanding(1);
    for (const action of ['taunt', 'charge', 'taunt', 'power'] as const) up = scoreCrowdAction(up, action, 10).standing;
    for (let i = 0; i < 4; i++) down = scoreCrowdAction(down, 'rest', 0).standing;
    expect(crowdMood(up.favour).tier).toBe('roaring');
    expect(crowdMood(down.favour).tier).toBe('restless');
  });

  it('clamps the fill and words the gifts', () => {
    expect(crowdFraction(-5)).toBe(0);
    expect(crowdFraction(42)).toBeCloseTo(0.42);
    expect(crowdFraction(140)).toBe(1);
    expect(crowdGiftText('bouquet', 12)).toBe('Bouquet +12 HP');
    expect(crowdGiftText('coin', 5)).toBe('Coin +5 gold');
  });
});
