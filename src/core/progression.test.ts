import { describe, expect, it } from 'vitest';
import { applyCombatStatus, createCombat, performAction } from './combat';
import { awardExperience, experienceForLevel, fightExperience, MAX_LEVEL } from './progression';

describe('character progression', () => {
  it('starts at zero XP and requires increasing XP for each of the 59 level-ups', () => {
    expect(experienceForLevel(1)).toBe(0);
    expect(experienceForLevel(2)).toBe(100);
    let previousCost = 0;
    for (let level = 2; level <= MAX_LEVEL; level++) {
      const cost = experienceForLevel(level) - experienceForLevel(level - 1);
      expect(cost).toBeGreaterThan(previousCost);
      previousCost = cost;
    }
    expect(() => experienceForLevel(61)).toThrow(RangeError);
  });

  it('grants five attributes per level and one skill for each multiple of three crossed', () => {
    const start = { level: 1, experience: 0, attributePoints: 2, skillPoints: 1 };
    expect(awardExperience(start, 99)).toEqual({ ...start, experience: 99 });
    const experience = experienceForLevel(7);
    expect(awardExperience(start, experience)).toEqual({ level: 7, experience, attributePoints: 32, skillPoints: 3 });
    expect(start.level).toBe(1);
  });

  it('supports saves without point balances and caps experience at level 60', () => {
    const previous = { level: 59, experience: 0 };
    expect(awardExperience(previous, 1)).toEqual({
      level: 59, experience: experienceForLevel(59) + 1, attributePoints: 0, skillPoints: 0,
    });
    expect(awardExperience(previous, Number.MAX_SAFE_INTEGER)).toEqual({
      level: 60, experience: experienceForLevel(60), attributePoints: 5, skillPoints: 1,
    });
    expect(() => awardExperience(previous, -1)).toThrow(RangeError);
  });

  it('awards XP on the winning combat result and scales it by the opponent level', () => {
    expect(fightExperience('player', 10, 12)).toBeGreaterThan(fightExperience('player', 10, 10));
    expect(fightExperience('player', 10, 10)).toBeGreaterThan(fightExperience('player', 10, 8));
    expect(fightExperience('enemy', 10, 12)).toBe(0);
    const ready = createCombat(1, { position: 4, level: 10, attributes: { might: 1_000 } }, { position: 5, level: 12 });
    expect(performAction(ready, 'rest').state.rewards).toBeUndefined();
    const finish = performAction(ready, 'normal');
    expect(finish.state).toMatchObject({ winner: 'player', rewards: { experience: fightExperience('player', 10, 12) } });
    expect(performAction(finish.state, 'rest').ok).toBe(false);
  });
  it('awards the same XP when damage over time decides the duel', () => {
    const start = applyCombatStatus(createCombat(1, { level: 5 }, { level: 7 }), 'enemy', 'burning');
    const fighters = { ...start.fighters, enemy: { ...start.fighters.enemy, health: 3 } };
    const result = performAction({ ...start, fighters }, 'rest');
    expect(result.state).toMatchObject({ winner: 'player', rewards: { experience: fightExperience('player', 5, 7) } });
  });
});
